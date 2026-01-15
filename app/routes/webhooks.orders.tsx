import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getStoreByShopId, saveOrder } from "../utils/supabase.server";

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

        console.log("📦 FULL PAYLOAD:");
        console.dir(payload, { depth: null });
        console.log(JSON.stringify(payload, null, 2));


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

        // Processar eventos de pedidos
        if (topic === "ORDERS_CREATE") {
            console.log("Order created:", payload.id);
            console.log("Webhook topic:", topic);
            console.log("Order ID:", payload.id);
            console.log("Customer email:", payload.email);
            console.log("Customer name:", payload.customer?.first_name, payload.customer?.last_name);
            console.log("Payload size:", rawBody.length);
            await saveOrder(store.id, payload, store.user_id);
            console.log(`Pedido criado: ${payload.id}`);
        } else if (topic === "ORDERS_UPDATED") {
            console.log("Order updated:", payload.id);
            // await updateOrder(store.id, payload);
            console.log(`Pedido atualizado: ${payload.id}`);
        } else {
            console.log("Topic not recognized for order save:", topic);
        }

        return new Response("OK", { status: 200 });
    } catch (error) {
        console.error("Webhook error:", error);
        return new Response("Error", { status: 500 });
    }
};
