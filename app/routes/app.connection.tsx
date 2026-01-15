import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getStoreByShopId } from "../utils/supabase.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const { session } = await authenticate.admin(request);

    if (!session) {
        return { status: "error", shopName: null, error: "No session" };
    }

    try {
        // Extrair o store_id sem o domínio
        const storeId = session.shop.split(".")[0];

        // Procurar a store no Supabase usando o store_id
        const store = await getStoreByShopId(storeId);

        if (store) {
            return {
                status: "connected",
                shopName: session.shop,
                storeId: store.id,
                userId: store.user_id,
            };
        } else {
            // Store não encontrada = estado inicial (não foi ainda conectada)
            return {
                status: "pending",
                shopName: session.shop,
                message: "Store not yet registered. Installing the app will connect it automatically.",
            };
        }
    } catch (error) {
        console.error("Error checking store connection:", error);
        return {
            status: "error",
            shopName: session?.shop,
            error: (error as Error).message,
        };
    }
};

export default function ConnectionStatus() {
    const data = useLoaderData<typeof loader>();

    return (
        <s-page heading="Connection Status">
            <s-section heading="DropSaaS App - Store Connection">
                {data.status === "connected" && (
                    <div style={{ padding: "20px", backgroundColor: "#d4edda" }}>
                        <s-heading level="2">✅ Store Connected!</s-heading>
                        <s-paragraph>
                            Your store <strong>{data.shopName}</strong> is successfully connected to
                            DropSaaS.
                        </s-paragraph>
                        <s-paragraph>
                            Store ID: <code>{data.storeId}</code>
                        </s-paragraph>
                        <s-paragraph>
                            You can now start using DropSaaS features. Check your main software
                            dashboard to manage this store and enable Product Research Mode.
                        </s-paragraph>
                    </div>
                )}

                {data.status === "pending" && (
                    <div style={{ padding: "20px", backgroundColor: "#fff3cd" }}>
                        <s-heading level="2">⏳ Connection Pending</s-heading>
                        <s-paragraph>
                            Store: <strong>{data.shopName}</strong>
                        </s-paragraph>
                        <s-paragraph>
                            {data.message}
                        </s-paragraph>
                        <s-paragraph style={{ marginTop: "10px", fontSize: "12px", color: "#666" }}>
                            The app has been installed but the connection to your DropSaaS account is still
                            being set up. This should happen automatically within a few moments.
                        </s-paragraph>
                    </div>
                )}

                {data.status === "error" && (
                    <div style={{ padding: "20px", backgroundColor: "#f8d7da" }}>
                        <s-heading level="2">❌ Connection Error</s-heading>
                        <s-paragraph>
                            Store: <strong>{data.shopName}</strong>
                        </s-paragraph>
                        <s-paragraph style={{ color: "red" }}>Error: {data.error}</s-paragraph>
                        <s-paragraph>
                            Please contact support or try uninstalling and reinstalling the app.
                        </s-paragraph>
                    </div>
                )}
            </s-section>

            <s-section heading="Next Steps">
                <s-list>
                    {data.status === "connected" && (
                        <>
                            <li>
                                Visit your <strong>DropSaaS Software Dashboard</strong> to configure
                                this store
                            </li>
                            <li>Enable Product Research Mode to start capturing products</li>
                            <li>Products will be automatically saved to your database</li>
                        </>
                    )}
                    {data.status === "pending" && (
                        <>
                            <li>Please wait for the connection to complete</li>
                            <li>Refresh this page in a few moments</li>
                        </>
                    )}
                    {data.status === "error" && (
                        <>
                            <li>Check your internet connection</li>
                            <li>Verify the app was installed correctly</li>
                            <li>Try reinstalling the app</li>
                        </>
                    )}
                </s-list>
            </s-section>
        </s-page>
    );
}
