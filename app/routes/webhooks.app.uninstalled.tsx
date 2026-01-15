import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { supabaseAdmin } from "../utils/supabase.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // Se a app foi desinstalada, limpar dados do Supabase
  if (session) {
    try {
      // Opcional: Limpar dados da store do Supabase
      // await supabaseAdmin
      //   .from("stores")
      //   .delete()
      //   .eq("store_id", shop);

      console.log(`App uninstalled from ${shop}`);
    } catch (error) {
      console.error(`Error processing uninstall for ${shop}:`, error);
    }
  }

  return new Response();
};
