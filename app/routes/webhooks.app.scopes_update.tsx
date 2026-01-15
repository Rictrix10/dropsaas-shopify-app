import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
    const { payload, session, topic, shop } = await authenticate.webhook(request);
    console.log(`Received ${topic} webhook for ${shop}`);

    const current = payload.current as string[];
    if (session) {
        // Scopes foram atualizados
        // Aqui você pode adicionar lógica para armazenar os scopes no Supabase se necessário
        console.log(`Scopes atualizados para ${shop}: ${current.toString()}`);
    }
    return new Response();
};
