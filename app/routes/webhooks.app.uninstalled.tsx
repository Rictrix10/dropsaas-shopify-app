import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { supabaseAdmin } from "../utils/supabase.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    await supabaseAdmin
      .from("stores")
      .update({
        shopify_admin_api_token: null,
        scopes: null,
        updated_at: new Date(),
      })
      .eq("shop_domain", shop);

    console.log(`Revoked Shopify access for ${shop}`);
  } catch (error) {
    console.error(`Error revoking access for ${shop}:`, error);
  }

  return new Response(null, { status: 200 });
};

