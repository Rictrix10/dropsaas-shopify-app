import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { saveProduct, updateProduct, getStoreByShopId } from "../utils/supabase.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    try {
        // Clone the request so we can read the body
        const clonedRequest = request.clone();
        const rawBody = await clonedRequest.text();
        console.log("Webhook received with body length:", rawBody.length);

        // Now authenticate the webhook with the original request
        const { topic, shop } = await authenticate.webhook(request);

        if (!shop) {
            console.error("Webhook authentication failed - no shop");
            return new Response("Unauthorized", { status: 403 });
        }

        if (!rawBody) {
            console.error("No webhook body received");
            return new Response("No body", { status: 400 });
        }

        console.log("Processing webhook:", topic, "for shop:", shop);
        const payload = JSON.parse(rawBody);

        // Extrair o store_id sem o domínio
        const storeId = shop.split(".")[0];
        console.log("Extracted storeId:", storeId);

        // Obter a store do Supabase pelo store ID
        const store = await getStoreByShopId(storeId);
        console.log("Store lookup result:", store);

        if (!store) {
            console.error(`Store não encontrada: ${storeId}`);
            return new Response("Store not found", { status: 404 });
        }

        console.log("Store found with ID:", store.id, "User ID:", store.user_id);

        // Processar eventos de produtos
        if (topic === "PRODUCTS_CREATE") {
            console.log("📦 FULL PAYLOAD:");
            console.dir(payload, { depth: null });
            console.log("Checking research_mode_enabled for store:", store.id);
            if (!store.research_mode_enabled) {
                console.log(`Research mode disabled for store ${store.id}, skipping product creation`);
                return new Response("Research mode disabled", { status: 200 });
            }
            console.log("Saving product:", payload.title);
            await saveProduct(store.id, payload, store.user_id);
            console.log(`Produto criado: ${payload.title} (${payload.id})`);
        } else if (topic === "PRODUCTS_UPDATE") {
            console.log("📦 FULL PAYLOAD:");
            console.dir(payload, { depth: null });
            console.log("Updating product:", payload.title);
            await updateProduct(store.id, payload);
            console.log(`Produto atualizado: ${payload.title} (${payload.id})`);
        } else {
            console.log("Topic not recognized for product save:", topic);
        }

        return new Response("OK", { status: 200 });
    } catch (error) {
        console.error("Webhook error:", error);
        return new Response("Error", { status: 500 });
    }
};
