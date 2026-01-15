# DropSaaS Shopify App - Integration Instructions for External Software

## Overview
This document provides instructions for integrating your external software with the DropSaaS Shopify App to establish authenticated connections with Shopify stores.

## Architecture

```
Your Software
    ↓
    └─→ GET /api/validate-key?api_key=XXX (to authenticate store connection)
    ↓
DropSaaS Shopify App (React Router backend)
    ↓
    └─→ Supabase Database (stores, store_credentials, product_research tables)
    ↓
Shopify Admin API (using stored access tokens)
```

## Step 1: Store Connection Flow

### 1.1 When User Installs Shopify App on Their Store

The Shopify app automatically:
1. Generates a unique `api_key` for the store
2. Saves the store info to the `stores` table
3. Saves Shopify access tokens to `store_credentials` table
4. User should copy the `api_key` to use in your software

### 1.2 Display API Key to User (You Need to Implement)

Modify `app/routes/app.connection.tsx` to show the API key:

```typescript
// Fetch the store data including api_key
const storeId = "2c8a0fc6-24d5-4e44-afc8-3e5483b3718e"; // from session
const { data: store } = await supabaseAdmin
  .from("stores")
  .select("api_key")
  .eq("id", storeId)
  .single();

// Display to user: "Your API Key: {store.api_key}"
// User copies this and adds it to your software
```

## Step 2: API Key Validation Endpoint

### 2.1 Endpoint Details

**URL:** `GET /api/validate-key`

**Query Parameters:**
- `api_key` (required): The API key provided by the user

**Response (Success):**
```json
{
  "valid": true,
  "store": {
    "id": "2c8a0fc6-24d5-4e44-afc8-3e5483b3718e",
    "name": "store-test-5598516198465165211.myshopify.com",
    "store_id": "store-test-5598516198465165211",
    "user_id": "97154620-f8fe-429a-bff6-8bc023289303",
    "research_mode_enabled": false
  }
}
```

**Response (Invalid Key):**
```json
{
  "error": "Invalid api_key"
}
```

### 2.2 Example Implementation in Your Software

**Node.js/Express:**
```javascript
async function connectShopifyStore(apiKey, shopifyAppUrl) {
  const response = await fetch(
    `${shopifyAppUrl}/api/validate-key?api_key=${apiKey}`
  );
  
  if (!response.ok) {
    throw new Error("Invalid API key");
  }
  
  const { store } = await response.json();
  
  // Save to your database:
  await saveConnectedStore({
    shopify_app_store_id: store.id,
    shopify_store_id: store.store_id,
    shopify_store_name: store.name,
    research_mode_enabled: store.research_mode_enabled,
  });
  
  return store;
}
```

**Python:**
```python
import requests

def connect_shopify_store(api_key, shopify_app_url):
    response = requests.get(
        f"{shopify_app_url}/api/validate-key",
        params={"api_key": api_key}
    )
    
    if response.status_code != 200:
        raise Exception("Invalid API key")
    
    data = response.json()
    store = data["store"]
    
    # Save to your database
    save_connected_store(
        shopify_app_store_id=store["id"],
        shopify_store_id=store["store_id"],
        shopify_store_name=store["name"],
        research_mode_enabled=store["research_mode_enabled"],
    )
    
    return store
```

## Step 3: Database Tables Reference

### stores table
```sql
{
  id: UUID,                           -- Unique store ID
  api_key: TEXT UNIQUE,               -- API key for authentication
  user_id: UUID,                      -- Shopify user ID
  name: TEXT,                         -- Full domain (e.g., store-name.myshopify.com)
  store_id: TEXT,                     -- Short ID (e.g., store-name)
  research_mode_enabled: BOOLEAN,     -- Whether product capture is enabled
  updated_at: TIMESTAMP,
  ...other fields
}
```

### store_credentials table
```sql
{
  id: UUID,
  store_id: UUID,              -- Foreign key to stores.id
  access_token: TEXT,          -- Shopify Admin API access token
  refresh_token: TEXT,         -- Refresh token (if applicable)
  scopes: TEXT,                -- List of granted scopes
  expires_at: TIMESTAMP,       -- Token expiration date
  created_at: TIMESTAMP
}
```

### product_research table
```sql
{
  id: UUID,
  store_id: UUID,              -- Foreign key to stores.id
  user_id: UUID,
  product_name: TEXT,          -- Product title
  shopify_id: TEXT,            -- Shopify product ID
  handle: TEXT,                -- Product URL handle
  status: TEXT,                -- 'Editing', 'To Import', 'Testing', etc.
  finding_date: DATE,          -- When product was found
  ...other fields
}
```

## Step 4: Webhook Events

The Shopify app automatically:

### Products/Create Event
- **When:** User creates a new product in their store
- **Condition:** Only saves if `research_mode_enabled = true`
- **Fields Saved:** 
  - product_name (from product.title)
  - shopify_id (from product.id)
  - handle (from product.handle)
  - status: 'Editing'

### Products/Update Event
- **When:** User updates an existing product
- **Behavior:** Only updates if product already exists in product_research table
- **Fields Updated:**
  - product_name
  - handle
- **Fields NOT Changed:**
  - status (remains as user set it)
  - other custom fields

### App/Uninstalled Event
- **When:** User uninstalls the app
- **Action:** Cascades delete all related records

## Step 5: Using Shopify Access Tokens

Once you have the store connected, you can use the stored access token to call Shopify Admin API:

```javascript
async function getProductDetails(storeId, productId, shopifyAppUrl) {
  // 1. Get credentials from app
  const credResponse = await fetch(
    `${shopifyAppUrl}/api/store-credentials?store_id=${storeId}`
  );
  const { access_token, shop_domain } = await credResponse.json();
  
  // 2. Call Shopify Admin API
  const response = await fetch(
    `https://${shop_domain}/admin/api/2025-01/products/${productId}.json`,
    {
      headers: {
        "X-Shopify-Access-Token": access_token,
      }
    }
  );
  
  return response.json();
}
```

**Note:** You'll need to create an endpoint for this in the Shopify app. The endpoint should be:
```
GET /api/store-credentials?store_id=XXX
```

## Step 6: Environment Variables

Your software needs:
- `SHOPIFY_APP_URL`: Base URL of the DropSaaS Shopify App
  - Example: `https://cameras-she-mono-loan.trycloudflare.com`
  - This changes every time you run `shopify app dev`

## Step 7: User Flow in Your Software

1. **User installs Shopify app** → Gets `api_key`
2. **User opens your software** → Navigates to "Connect Store"
3. **User pastes API key** → Your software calls `/api/validate-key`
4. **Validation successful** → Store is now connected
5. **Your software saves**:
   - The Shopify store ID
   - The store name
   - Research mode status
6. **Products automatically flow** → Webhooks send products to Supabase
7. **Your software queries** → Fetches from `product_research` table

## Step 8: Security Notes

- ✅ API keys are unique per store
- ✅ Shopify tokens are stored securely in Supabase
- ✅ Webhooks are authenticated via HMAC signatures
- ✅ Your software validates API keys before trusting data
- ⚠️ Never expose `access_tokens` or `SUPABASE_SERVICE_ROLE_KEY` to frontend

## Step 9: Testing

```bash
# Test the validation endpoint
curl "https://cameras-she-mono-loan.trycloudflare.com/api/validate-key?api_key=YOUR_API_KEY"

# Should return:
# {"valid": true, "store": {...}}
```

## Support

If you encounter issues:
1. Check the Shopify app logs: `npm run dev` terminal
2. Verify the `api_key` was generated: Check `stores` table in Supabase
3. Verify credentials were saved: Check `store_credentials` table
4. Ensure `research_mode_enabled = true` for product capture to work

---

**Created:** January 2026
**Framework:** React Router 7.9.3
**Database:** Supabase PostgreSQL
**API Version:** Shopify 2025-01
