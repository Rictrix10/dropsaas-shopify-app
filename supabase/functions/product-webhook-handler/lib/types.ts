// supabase/functions/product-webhook-handler/lib/types.ts

/**
 * Represents the structure of a Shopify product as received from the webhook.
 * This is not an exhaustive list of all fields, but it includes the ones
 * relevant to this function.
 */
export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  status: 'active' | 'archived' | 'draft';
  tags: string;
  variants: any[]; // Define a more specific type if variant details are needed
  options: any[]; // Define a more specific type if option details are needed
  images: { src: string }[];
  image: { src: string } | null;
}

/**
 * Represents the relevant fields of a store from the Supabase 'stores' table.
 */
export interface Store {
  id: string;
  user_id: string;
  research_mode_enabled: boolean;
}
