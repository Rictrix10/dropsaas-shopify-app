// app/utils/supabase.server.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Usamos a Service Role Key para que o backend possa contornar 
// as políticas de RLS ao processar webhooks da Shopify.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function registerStore(
    userId: string,
    shopName: string,
    shopifyShopId: string,
    accessToken: string,
    refreshToken: string | null,
    scopes: string,
    expiresAt: Date | null = null
) {
    console.log("registerStore called with:", { userId, shopName, shopifyShopId, scopes, hasAccessToken: !!accessToken });

    // 1. Criar ou atualizar a store
    const { data: storeData, error: storeError } = await supabaseAdmin
        .from("stores")
        .upsert(
            {
                user_id: userId,
                name: shopName,
                store_id: shopifyShopId,
                updated_at: new Date(),
            },
            { onConflict: "store_id" }
        )
        .select()
        .single();

    if (storeError) {
        console.error("Store upsert error:", storeError);
        throw storeError;
    }

    console.log("Store created/updated with ID:", storeData.id, "API Key:", storeData.api_key);

    // 2. Guardar as credenciais de forma segura
    const { data: credentialData, error: credentialError } = await supabaseAdmin
        .from("store_credentials")
        .upsert(
            {
                store_id: storeData.id,
                access_token: accessToken,
                refresh_token: refreshToken,
                scopes: scopes,
                expires_at: expiresAt,
            },
            { onConflict: "store_id" }
        )
        .select()
        .single();

    if (credentialError) {
        console.error("Credentials upsert error:", credentialError);
        throw credentialError;
    }

    console.log("Credentials saved successfully");

    return { store: storeData, credentials: credentialData };

    return { store: storeData, credentials: credentialData };
}

export async function saveProduct(
    storeId: string,
    product: any,
    userId: string
) {
    const { data, error } = await supabaseAdmin
        .from("product_research")
        .insert(
            {
                user_id: userId,
                store_id: storeId,
                product_name: product.title,
                shopify_id: String(product.id),
                handle: product.handle,
                status: "Editing",
                finding_date: new Date().toISOString().split("T")[0],
                main_image_url: product.image?.src ?? null,
            }
        )
        .select()
        .single();

    if (error) {
        console.error("Error saving product:", error);
        throw error;
    }
    console.log("Product created successfully:", product.title);
    return data;
}

export async function updateProduct(
    storeId: string,
    product: any
) {
    // First check if product exists
    const { data: existingProduct, error: checkError } = await supabaseAdmin
        .from("product_research")
        .select("id")
        .eq("shopify_id", String(product.id))
        .eq("store_id", storeId)
        .single();

    if (checkError || !existingProduct) {
        console.log(`Product ${product.id} not found in database, skipping update`);
        return null;
    }

    // Product exists, update it
    const { data, error } = await supabaseAdmin
        .from("product_research")
        .update(
            {
                product_name: product.title,
                handle: product.handle,
                main_image_url: product.image?.src ?? null,
            }
        )
        .eq("shopify_id", String(product.id))
        .eq("store_id", storeId)
        .select()
        .single();

    if (error) {
        console.error("Error updating product:", error);
        throw error;
    }
    console.log("Product updated successfully:", product.title);
    return data;
}

export async function getStoreByShopId(shopId: string) {
    const { data, error } = await supabaseAdmin
        .from("stores")
        .select("id, user_id, research_mode_enabled")
        .eq("store_id", shopId);

    if (error) throw error;
    // Retornar o primeiro resultado ou null se não existe
    return data && data.length > 0 ? data[0] : null;
}

export async function getStoreCredentials(storeId: string) {
    const { data, error } = await supabaseAdmin
        .from("store_credentials")
        .select("access_token, refresh_token, scopes, expires_at")
        .eq("store_id", storeId);

    if (error) throw error;
    // Retornar o primeiro resultado ou null
    return data && data.length > 0 ? data[0] : null;
}

export async function saveOrder(
    storeId: string,
    payload: any,
    userId: string
) {
    const createdAt = new Date(payload.created_at);
    const orderDate = createdAt.toISOString().split("T")[0];
    const orderTime = createdAt.toTimeString().split(" ")[0].substring(0, 5); // HH:MM

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
        throw orderError;
    }

    console.log("Order created successfully:", orderData.id);

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
        // If this fails, should we roll back the order?
        // For now, just log and throw. A transaction would be better.
        throw shipmentError;
    }

    console.log("Order shipment created successfully for order:", orderData.id);

    return { order: orderData, shipment: shipmentData };
}