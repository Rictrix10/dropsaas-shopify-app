import type { LoaderFunctionArgs } from "react-router";
import { supabaseAdmin } from "../utils/supabase.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    // Apenas aceita GET requests
    if (request.method !== "GET") {
        return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);
    const apiKey = url.searchParams.get("api_key");
    const limit = url.searchParams.get("limit") || "50";
    const offset = url.searchParams.get("offset") || "0";

    if (!apiKey) {
        return new Response(JSON.stringify({ error: "Missing api_key" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        // Validar a chave e obter o store_id
        const { data: store, error: storeError } = await supabaseAdmin
            .from("stores")
            .select("id")
            .eq("api_key", apiKey)
            .single();

        if (storeError || !store) {
            return new Response(JSON.stringify({ error: "Invalid api_key" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Buscar produtos
        const { data: products, error: productsError } = await supabaseAdmin
            .from("product_research")
            .select("id, product_name, shopify_id, handle, status, finding_date")
            .eq("store_id", store.id)
            .order("finding_date", { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        if (productsError) {
            throw productsError;
        }

        // Buscar o total de produtos
        const { count } = await supabaseAdmin
            .from("product_research")
            .select("*", { count: "exact", head: true })
            .eq("store_id", store.id);

        return new Response(
            JSON.stringify({
                success: true,
                products: products || [],
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    total: count || 0,
                },
            }),
            {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error fetching products:", error);
        return new Response(JSON.stringify({ error: "Server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};
