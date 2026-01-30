import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/* -------------------------------------------------------------------------- */
/*                                Types & Config                               */
/* -------------------------------------------------------------------------- */

interface Store {
    id: string;
    user_id: string;
}

const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

/* -------------------------------------------------------------------------- */
/*                                Helpers                                      */
/* -------------------------------------------------------------------------- */

async function verifyShopifyHmac(body: string, secret: string, hmacHeader: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const calculatedHmac = btoa(String.fromCharCode(...new Uint8Array(signature)));
    return calculatedHmac === hmacHeader;
}

async function getStoreByShopId(shopId: string): Promise<Store | null> {
    const { data, error } = await supabaseAdmin
        .from('stores')
        .select('id, user_id')
        .eq('store_id', shopId)
        .single();

    if (error) {
        console.error('Error fetching store:', error);
        return null;
    }
    return data;
}

async function saveOrder(storeId: string, payload: any, userId: string) {
    const createdAt = new Date(payload.created_at);
    const orderDate = createdAt.toISOString().split("T")[0];
    const orderTime = createdAt.toTimeString().split(" ")[0].substring(0, 5); // HH:MM

    // 1. Inserir Order
    const { data: orderData, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert({
            user_id: userId,
            store_id: storeId,
            order_number: String(payload.order_number),
            customer_email: payload.customer?.email ?? payload.email ?? null,
            order_date: orderDate,
            order_time: orderTime,
            internal_status: "Pending",
            shopify_id: String(payload.id),
            customer_first_name: payload.customer?.first_name ?? payload.billing_address?.first_name ?? null,
            customer_last_name: payload.customer?.last_name ?? payload.billing_address?.last_name ?? null,
        })
        .select()
        .single();

    if (orderError) {
        console.error("Error saving order:", orderError);
        // Se for erro de duplicidade (já existe), podemos considerar sucesso ou update
        // Mas throw para ver logs por enquanto
        throw orderError;
    }

    console.log("Order created successfully:", orderData.id);

    // 2. Inserir Order Shipment
    const { data: shipmentData, error: shipmentError } = await supabaseAdmin
        .from("order_shipments")
        .insert({
            order_id: orderData.id,
            status: "Unfulfilled",
        })
        .select()
        .single();

    if (shipmentError) {
        console.error("Error creating order shipment:", shipmentError);
        // Em produção, idealmente deletaríamos a ordem ou usaríamos transação (RPC)
        throw shipmentError;
    }

    console.log("Order shipment created successfully for order:", orderData.id);
    return { order: orderData, shipment: shipmentData };
}

/* -------------------------------------------------------------------------- */
/*                              Edge Function Handler                          */
/* -------------------------------------------------------------------------- */

serve(async (req: Request) => {
    try {
        if (req.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 });
        }

        const shopifySecret = Deno.env.get('SHOPIFY_API_SECRET');
        const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
        const topic = req.headers.get('x-shopify-topic');
        const shopDomain = req.headers.get('x-shopify-shop-domain');

        if (!topic || !shopDomain) {
            return new Response('Bad Request: Missing topic or shop domain', { status: 400 });
        }

        const bodyText = await req.text();

        // Lógica de Autenticação Híbrida (Trusted Proxy)
        let isValid = false;
        const authHeader = req.headers.get('Authorization');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (authHeader && serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) {
            console.log("Authenticated via Service Role Key (Trusted Proxy)");
            isValid = true;
        } else {
            if (shopifySecret && hmacHeader) {
                isValid = await verifyShopifyHmac(bodyText, shopifySecret, hmacHeader);
            } else {
                console.warn("HMAC fail: Credentials missing or header missing");
            }
        }

        if (!isValid) {
            return new Response('Unauthorized', { status: 401 });
        }

        const payload = JSON.parse(bodyText);
        console.log(`Webhook received: ${topic} | ${shopDomain}`);

        // Identificar loja
        const shopId = shopDomain.split('.')[0];
        const store = await getStoreByShopId(shopId);

        if (!store) {
            console.warn(`Store not found: ${shopId}`);
            return new Response('Store not found', { status: 404 });
        }

        // Router de Tópicos
        if (topic === 'orders/create') {
            await saveOrder(store.id, payload, store.user_id);
        } else {
            console.log(`Topic ${topic} not handled yet.`);
        }

        return new Response('OK', { status: 200 });

    } catch (error) {
        console.error('Webhook error:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
});
