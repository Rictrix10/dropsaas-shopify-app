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


        console.log(`Webhook autenticado! Tópico: ${topic}, Loja: ${shop}`);

        // Encaminhar para a Edge Function de Orders
        const edgeFunctionUrl = "https://zozipovqpcegezhbvvsg.supabase.co/functions/v1/order-webhook-handler";

        // Preparar headers
        const originalBody = rawBody;
        const hmacHeader = clonedRequest.headers.get("X-Shopify-Hmac-Sha256");
        const topicHeader = clonedRequest.headers.get("X-Shopify-Topic") || topic;
        const shopDomainHeader = clonedRequest.headers.get("X-Shopify-Shop-Domain") || shop;

        const response = await fetch(edgeFunctionUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Topic": topicHeader,
                "X-Shopify-Shop-Domain": shopDomainHeader,
                "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: originalBody
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Erro na Edge Function (Orders):", errorText);
            // Retorna 200 para não travar a fila da Shopify, mas loga o erro
            return new Response("Edge Function Error", { status: 200 });
        }

        const result = await response.text();
        console.log("Sucesso na Edge Function (Orders):", result);

        return new Response("OK", { status: 200 });
    } catch (error) {
        console.error("Webhook error:", error);
        return new Response("Error", { status: 500 });
    }
};
