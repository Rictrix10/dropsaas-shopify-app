import { Session } from "@shopify/shopify-api";
import { supabaseAdmin } from "../utils/supabase.server";

export class SupabaseSessionStorage {
    async storeSession(session: Session): Promise<boolean> {
        try {
            // Only store offline tokens in the 'stores' table for now, as requested.
            // Online tokens (if used) would overwrite this if we aren't careful, 
            // but typically apps use offline tokens for admin API access.

            const { shop, accessToken, scope, isOnline } = session;

            // We focus on offline tokens for Admin API access
            if (!isOnline && accessToken) {
                // Upsert into stores table
                const { error } = await supabaseAdmin
                    .from("stores")
                    .upsert(
                        {
                            shop_domain: shop,
                            store_id: shop.split(".")[0], // Fallback/Default
                            name: shop.split(".")[0], // Add default name to satisfy NOT NULL constraint
                            shopify_admin_api_token: accessToken,
                            scopes: scope,
                            updated_at: new Date(),
                            // Note: We're not setting user_id here as offline tokens 
                            // aren't tied to a specific dashboard user in this context.
                        },
                        { onConflict: "shop_domain" }
                    );

                if (error) {
                    console.error("SupabaseSessionStorage: Error storing session", error);
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error("SupabaseSessionStorage: Exception storing session", error);
            return false;
        }
    }

    async loadSession(id: string): Promise<Session | undefined> {
        try {
            // ID format is usually "offline_shop.myshopify.com" or "online_..."
            // We are primarily looking for offline sessions for Admin API.

            const isOffline = id.startsWith("offline_");
            if (!isOffline) {
                // If you need online session support, you might need a separate table 
                // or column strategy. For now, we return undefined to force re-auth
                // or focus on the offline token requirement.
                return undefined;
            }

            const shop = id.replace("offline_", "");

            const { data: store, error } = await supabaseAdmin
                .from("stores")
                .select("shopify_admin_api_token, scopes, shop_domain")
                .eq("shop_domain", shop)
                .single();

            if (error || !store || !store.shopify_admin_api_token) {
                return undefined;
            }

            const session = new Session({
                id,
                shop: store.shop_domain || shop,
                state: "",
                isOnline: false,
                accessToken: store.shopify_admin_api_token,
                scope: store.scopes || "",
            });

            return session;
        } catch (error) {
            console.error("SupabaseSessionStorage: Error loading session", error);
            return undefined;
        }
    }

    async deleteSession(id: string): Promise<boolean> {
        // Optional: Implement if you want to allow "logout" or uninstall cleanup
        return true;
    }

    async deleteSessions(ids: string[]): Promise<boolean> {
        return true;
    }

    async findSessionsByShop(shop: string): Promise<Session[]> {
        // Used by webhook processing to find valid sessions for a shop
        const session = await this.loadSession(`offline_${shop}`);
        return session ? [session] : [];
    }
}
