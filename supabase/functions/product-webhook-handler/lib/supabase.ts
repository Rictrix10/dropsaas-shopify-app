// supabase/functions/product-webhook-handler/lib/supabase.ts
import { createClient } from 'npm:@supabase/supabase-js@2';

// Ensure the environment variables are available
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is not set in the function's environment variables.");
}
if (!supabaseServiceKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set in the function's environment variables.");
}

// Create and export the Supabase client
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
