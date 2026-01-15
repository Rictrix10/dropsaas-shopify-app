import type { LoaderFunctionArgs } from "react-router";
import { supabaseAdmin } from "../utils/supabase.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    // Apenas aceita GET requests
    if (request.method !== "GET") {
        return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const storeId = url.searchParams.get("store_id");
    const apiKey = url.searchParams.get("api_key");

    if (!storeId && !apiKey) {
        return new Response(
            JSON.stringify({ error: "Missing store_id or api_key" }),
            {
                status: 400,
                headers: { "Content-Type": "application/json" },
            }
        );
    }

    try {
        let store;

        // Buscar a store por store_id ou api_key
        if (storeId) {
            const { data } = await supabaseAdmin
                .from("stores")
                .select("id")
                .eq("id", storeId)
                .single();
            store = data;
        } else {
            const { data } = await supabaseAdmin
                .from("stores")
                .select("id")
                .eq("api_key", apiKey)
                .single();
            store = data;
        }

        if (!store) {
            return new Response(JSON.stringify({ error: "Store not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Buscar as credenciais
        const { data: credentials, error } = await supabaseAdmin
            .from("store_credentials")
            .select("access_token, refresh_token, scopes, expires_at")
            .eq("store_id", store.id)
            .single();

        if (error || !credentials) {
            return new Response(
                JSON.stringify({ error: "Credentials not found" }),
                {
                    status: 404,
                    headers: { "Content-Type": "application/json" },
                }
            );
        }

        // Buscar o domínio da store
        const { data: storeData } = await supabaseAdmin
            .from("stores")
            .select("name, store_id")
            .eq("id", store.id)
            .single();

        return new Response(
            JSON.stringify({
                access_token: credentials.access_token,
                refresh_token: credentials.refresh_token,
                scopes: credentials.scopes,
                expires_at: credentials.expires_at,
                shop_domain: storeData?.name || "",
                store_id: storeData?.store_id || "",
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error fetching credentials:", error);
        return new Response(JSON.stringify({ error: "Server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};
