
import { type LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
    return Response.json({
        status: "ok",
        hasShopifyKey: !!process.env.SHOPIFY_API_KEY,
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        timestamp: new Date().toISOString()
    });
}
