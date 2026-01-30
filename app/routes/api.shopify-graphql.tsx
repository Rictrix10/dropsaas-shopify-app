
import { type LoaderFunctionArgs } from "react-router";
import { supabaseAdmin } from "../utils/supabase.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // 1. Identifique a loja (exemplo: a partir de um query param ?shop=minha-loja.myshopify.com)
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop");

  if (!shopDomain) {
    return Response.json({ error: "O parâmetro 'shop' é obrigatório." }, { status: 400 });
  }

  // 2. Busque o token no Supabase (usando a coluna shopify_admin_api_token)
  // Usamos shop_domain para garantir exatidão
  const { data: store, error } = await supabaseAdmin
    .from('stores')
    .select('shopify_admin_api_token')
    .eq('shop_domain', shopDomain)
    .single();

  if (error || !store || !store.shopify_admin_api_token) {
    // Tenta fallback com store_id se shop_domain estiver vazio (caso de dados antigos)
    // Mas o ideal é usar shop_domain.
    console.warn(`Token não encontrado para ${shopDomain}. Verifique se a app foi instalada.`);
    return Response.json({ error: "Loja não encontrada ou token de acesso ausente." }, { status: 404 });
  }

  const accessToken = store.shopify_admin_api_token;
  const apiVersion = "2024-04"; // Use a versão que seu app suporta
  const shopifyApiUrl = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;

  const graphqlQuery = `
    query {
      shop {
        name
        email
      }
      products(first: 3) {
        edges {
          node {
            id
            title
          }
        }
      }
    }
  `;

  // 3. Faça a chamada para a API Admin da Shopify
  try {
    const response = await fetch(shopifyApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query: graphqlQuery }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Erro da API da Shopify:", errorBody);
      return Response.json({ error: "Falha ao buscar dados da Shopify.", details: errorBody }, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);

  } catch (apiError) {
    console.error("Erro na requisição:", apiError);
    return Response.json({ error: "Falha na requisição para a API da Shopify." }, { status: 500 });
  }
}
