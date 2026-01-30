import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    try {
        console.log("Recebendo webhook de produtos via Remix...");
        // 1. Autenticar o webhook (Isso garante que é realmente da Shopify)
        // O authenticate.webhook consome o body, então precisamos ter cuidado se formos reenviar o body raw.
        // Felizmente, authenticate.webhook retorna o request original processado ou podemos clonar antes se necessário,
        // mas o metodo padrão da Shopify já valida HMAC.

        // Clonamos para garantir que temos o texto bruto para reenvio se necessário, 
        // mas authenticate.webhook deve ser chamado primeiro para segurança.
        const requestClone = request.clone();
        const { topic, shop, session, admin } = await authenticate.webhook(request);

        if (!shop) {
            return new Response("Unauthorized", { status: 401 });
        }

        console.log(`Webhook autenticado! Tópico: ${topic}, Loja: ${shop}`);

        // 2. Encaminhar para a Edge Function
        // URL da sua Edge Function
        const edgeFunctionUrl = "https://zozipovqpcegezhbvvsg.supabase.co/functions/v1/product-webhook-handler";

        // Headers originais importantes para a validação HMAC na Edge Function, se ela fizer revalidação.
        // A sua Edge Function ATUAL verifica HMAC novamente. Então precisamos passar os headers originais
        // e o corpo original inalterado.

        const originalBody = await requestClone.text();
        const hmacHeader = requestClone.headers.get("X-Shopify-Hmac-Sha256");
        const topicHeader = requestClone.headers.get("X-Shopify-Topic") || topic; // Fallback para o tópico do authenticate
        const shopDomainHeader = requestClone.headers.get("X-Shopify-Shop-Domain") || shop;

        const response = await fetch(edgeFunctionUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // Passamos os headers de metadados para a função usar
                "X-Shopify-Topic": topicHeader,
                "X-Shopify-Shop-Domain": shopDomainHeader,
                // Autenticação via Service Role para "confiar" nesta chamada e pular validação HMAC lá
                "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: originalBody
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Erro na Edge Function:", errorText);
            // Retornamos 200 para a Shopify não ficar tentando reenviar infinitamente se o erro for do nosso lado
            // (A menos que você queira retry da Shopify)
            return new Response("Edge Function Error", { status: 200 });
        }

        const result = await response.text();
        console.log("Sucesso na Edge Function:", result);

        return new Response("OK", { status: 200 });
    } catch (error) {
        console.error("Erro no processamento do webhook:", error);
        return new Response("Internal Error", { status: 500 });
    }
};
