import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { supabaseAdmin } from './lib/supabase.ts';
import type { ShopifyProduct, Store } from './lib/types.ts';

/* -------------------------------------------------------------------------- */
/*                         Shopify HMAC Verification                           */
/* -------------------------------------------------------------------------- */

async function verifyShopifyHmac(
  body: string,
  secret: string,
  hmacHeader: string,
): Promise<boolean> {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(body),
  );

  const calculatedHmac = btoa(
    String.fromCharCode(...new Uint8Array(signature)),
  );

  return calculatedHmac === hmacHeader;
}

/* -------------------------------------------------------------------------- */
/*                           Database Helper Functions                         */
/* -------------------------------------------------------------------------- */

async function getStoreByShopId(shopId: string): Promise<Store | null> {
  const { data, error } = await supabaseAdmin
    .from('stores')
    .select('id, user_id, research_mode_enabled')
    .eq('store_id', shopId)
    .single();

  if (error) {
    console.error('Error fetching store:', error);
    return null;
  }

  return data;
}

async function saveProduct(
  storeId: string,
  product: ShopifyProduct,
  userId: string,
) {
  const { data, error } = await supabaseAdmin
    .from('product_research')
    .insert({
      user_id: userId,
      store_id: storeId,
      product_name: product.title,
      shopify_id: String(product.id),
      handle: product.handle,
      status: 'Editing',
      finding_date: new Date().toISOString().split('T')[0],
      main_image_url: product.image?.src ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving product:', error);
    throw error;
  }

  console.log('Product created:', product.title);
  return data;
}

async function updateProduct(storeId: string, product: ShopifyProduct) {
  const { data: existingProduct } = await supabaseAdmin
    .from('product_research')
    .select('id')
    .eq('shopify_id', String(product.id))
    .eq('store_id', storeId)
    .maybeSingle();

  if (!existingProduct) {
    console.log(`Product ${product.id} not found. Skipping update.`);
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('product_research')
    .update({
      product_name: product.title,
      handle: product.handle,
      main_image_url: product.image?.src ?? null,
    })
    .eq('shopify_id', String(product.id))
    .eq('store_id', storeId)
    .select()
    .single();

  if (error) {
    console.error('Error updating product:', error);
    throw error;
  }

  console.log('Product updated:', product.title);
  return data;
}

/* -------------------------------------------------------------------------- */
/*                              Edge Function                                  */
/* -------------------------------------------------------------------------- */

serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const shopifySecret = Deno.env.get('SHOPIFY_API_SECRET');
    if (!shopifySecret) {
      console.error('SHOPIFY_API_SECRET is missing');
      return new Response('Internal Server Error', { status: 500 });
    }

    const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
    const topic = req.headers.get('x-shopify-topic');
    const shopDomain = req.headers.get('x-shopify-shop-domain');

    if (!topic || !shopDomain) {
      return new Response('Bad Request: Missing topic or shop domain', { status: 400 });
    }

    const bodyText = await req.text();

    // Estratégia de Autenticação Híbrida:
    // 1. Se vier com Authorization: Bearer SERVICE_KEY, confiamos (vem do nosso backend Remix).
    // 2. Se não, tentamos validar o HMAC da Shopify (chamada direta da Shopify, se configurado assim).

    let isValid = false;
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Verificação via Service Role Key (Trusted Source)
    if (authHeader && serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) {
      console.log("Authenticated via Service Role Key (Trusted Proxy)");
      isValid = true;
    } else {
      // Fallback: Tentativa de validação HMAC
      if (shopifySecret && hmacHeader) {
        isValid = await verifyShopifyHmac(bodyText, shopifySecret, hmacHeader);
      } else {
        console.warn("Missing credentials for HMAC check and no Service Key provided");
      }
    }

    if (!isValid) {
      console.error("Authentication failed. Invalid HMAC or missing Service Key.");
      return new Response('Unauthorized', { status: 401 });
    }

    const payload: ShopifyProduct = JSON.parse(bodyText);

    console.log(`Webhook received: ${topic} | ${shopDomain}`);

    const shopId = shopDomain.split('.')[0];
    const store = await getStoreByShopId(shopId);

    if (!store) {
      console.warn(`Store not found: ${shopDomain}`);
      return new Response('Store not found', { status: 404 });
    }

    if (topic === 'products/create') {
      if (!store.research_mode_enabled) {
        console.log(`Research mode disabled for store ${store.id}`);
        return new Response('OK', { status: 200 });
      }

      await saveProduct(store.id, payload, store.user_id);
    }

    if (topic === 'products/update') {
      await updateProduct(store.id, payload);
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
});
