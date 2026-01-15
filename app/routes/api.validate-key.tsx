import type { LoaderFunctionArgs } from "react-router";
import { supabaseAdmin } from "../utils/supabase.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    // Apenas aceita GET requests
    if (request.method !== "GET") {
        return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const apiKey = url.searchParams.get("api_key");

    if (!apiKey) {
        return new Response(JSON.stringify({ error: "Missing api_key" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        // Validar a chave
        const { data: store, error } = await supabaseAdmin
            .from("stores")
            .select("id, name, store_id, user_id, research_mode_enabled")
            .eq("api_key", apiKey)
            .single();

        if (error || !store) {
            return new Response(JSON.stringify({ error: "Invalid api_key" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Retornar informações da loja
        return new Response(
            JSON.stringify({
                valid: true,
                store: {
                    id: store.id,
                    name: store.name,
                    store_id: store.store_id,
                    user_id: store.user_id,
                    research_mode_enabled: store.research_mode_enabled,
                },
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error validating api key:", error);
        return new Response(JSON.stringify({ error: "Server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};
