
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { registerStore } from "../utils/supabase.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  console.log("Auth route loader called with path:", request.url);

  try {
    const { session } = await authenticate.admin(request);
    console.log("Auth authenticate.admin returned, session:", !!session);

    if (session) {
      console.log("Auth callback - session received:", {
        shop: session.shop,
        userId: session.user?.id,
        hasAccessToken: !!session.accessToken,
      });

      // Extrair o store_id sem o domínio (.myshopify.com)
      const storeId = session.shop.split(".")[0];

      // Guardar a store no Supabase com as credenciais
      await registerStore(
        session.user?.id || "",
        session.shop,
        storeId,
        session.accessToken,
        null, // refresh_token (null por enquanto)
        process.env.SCOPES || ""
      );
      console.log(`Store registada: ${storeId}`);
    } else {
      console.log("No session in auth callback");
    }
  } catch (error) {
    console.error("Erro ao registar store:", error);
  }

  return null;
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
