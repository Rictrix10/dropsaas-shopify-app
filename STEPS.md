A LOGICA DE NEGOCIO NAO PODE SER FEITA NA SHOPIFY APP

👉 A **tua lógica de negócio NÃO precisa ficar “dentro” da Shopify App**.

Na prática, **quase ninguém faz isso** 😉

Vou organizar a resposta por partes para ficar bem claro.

---

## 1️⃣ O que “é” a Shopify App, afinal?

Uma **Shopify App** é basicamente:

- Um **registo** dentro da Shopify (Client ID, Client Secret, scopes, webhooks)
- Um **processo de OAuth** para autorizar uma loja
- Um **conjunto de webhooks configurados**
- (Opcional) uma UI embedded no admin da loja

👉 **Ela não é um runtime fechado**

👉 **Ela não é onde a lógica “tem” de viver**

A app **aponta para endpoints teus**, hospedados onde quiseres.

---

## 2️⃣ Onde a lógica de negócio DEVE ficar?

### ✅ Arquitetura recomendada (padrão real)

```
Shopify
   |
   | (webhook HTTPS)
   v
TuaAPI(Node,Python,etc)
   |
   | lógica de negócio
   v
Supabase/DB/outrosserviços

```

✔️ **A lógica fica na tua API**

✔️ Escrita em **Node, Python, Go, etc**

✔️ Totalmente desacoplada da Shopify UI

A Shopify App só serve para:

- Autorizar lojas
- Registrar webhooks
- Garantir permissões

---

## 3️⃣ Então… quando um webhook dispara, o que acontece?

Exemplo: `products/update`

1. Shopify envia um **POST HTTPS** para:
    
    ```
    https://api.tudominio.com/webhooks/products/update
    
    ```
    
2. O payload vem com:
    - Dados do produto
    - Headers de segurança (HMAC)
3. A tua API:
    - Valida que veio da Shopify
    - Executa lógica
    - Atualiza Supabase

🔥 **Tudo fora da Shopify App UI**

---

## 4️⃣ Como os webhooks são AUTENTICADOS?

Esse é o ponto mais importante 👇

### 🔐 Shopify NÃO usa OAuth em webhooks

Em vez disso, ela usa **HMAC SHA256**.

### O que a Shopify envia:

Header:

```
X-Shopify-Hmac-Sha256

```

Payload:

```json
{ ...dados do produto ou order...}

```

### O que TU fazes:

1. Pegas o **raw body**
2. Assinas com o **App Secret**
3. Comparas com o header

Se bater → webhook válido.

---

## 5️⃣ Exemplo prático – Node.js (Express)

```jsx
import cryptofrom"crypto";

functionverifyShopifyWebhook(req, res, next) {
const hmac = req.headers["x-shopify-hmac-sha256"];
const body = req.rawBody;// IMPORTANTE: body bruto

const generatedHash = crypto
    .createHmac("sha256", process.env.SHOPIFY_APP_SECRET)
    .update(body,"utf8")
    .digest("base64");

if (generatedHash !== hmac) {
return res.status(401).send("Webhook inválido");
  }

next();
}

```

Depois:

```jsx
app.post(
"/webhooks/products/update",
  verifyShopifyWebhook,
async (req, res) => {
const product = req.body;

await supabase
      .from("products")
      .upsert({
shopify_id: product.id,
title: product.title,
updated_at: product.updated_at
      });

    res.status(200).send("OK");
  }
);

```

---

## 6️⃣ Exemplo prático – Python (FastAPI)

```python
import hmac
import hashlib
import base64

defverify_shopify_webhook(request: Request, body: bytes):
    shopify_hmac = request.headers.get("x-shopify-hmac-sha256")

    digest = hmac.new(
        key=SHOPIFY_APP_SECRET.encode(),
        msg=body,
        digestmod=hashlib.sha256
    ).digest()

    computed_hmac = base64.b64encode(digest).decode()

ifnot hmac.compare_digest(computed_hmac, shopify_hmac):
raise HTTPException(status_code=401, detail="Invalid webhook")

```

---

## 7️⃣ Onde ficam os tokens OAuth?

Boa pergunta 👇

- **Access Token da loja** → guardas no Supabase
- Usado quando:
    - Precisas chamar Admin API
    - Buscar dados adicionais

Exemplo:

```tsx
GET /admin/api/2024-10/orders/{id}.json
Authorization: X-Shopify-Access-Token

```

👉 Webhooks **não precisam do token**

👉 Só precisam do **App Secret**

---

## 8️⃣ Então resumindo bem direto

### ❌ ERRADO

> “A lógica tem de estar na Shopify App”
> 

### ✅ CERTO

- Shopify App:
    - OAuth
    - Permissões
    - Registo de webhooks
- **Tua API**:
    - Recebe webhooks
    - Valida HMAC
    - Executa lógica
    - Atualiza Supabase

---

## 9️⃣ Recomendo este setup mínimo

- Backend:
    - Node + Express **ou**
    - Python + FastAPI
- DB:
    - Supabase
- Webhooks:
    - `orders/create`
    - `orders/updated`
    - `fulfillments/create`
    - `fulfillments/update`
- Segurança:
    - HMAC obrigatório
    - Raw body preservado


Perfeito — **Fly.io é uma ótima escolha para o teu caso**, e sim: **dá para usar em free / quase-free**, estável, sem sleep, HTTPS automático 👍
Vou guiar **passo a passo**, já pensado **para Shopify apps**, sem quebrar `npm run dev`.

Vou assumir:

* app criada com **Shopify CLI (Node/Remix ou Node/Express)**
* já funciona localmente com `npm run dev`
* vais usar Fly **como produção “privada”** por agora

---

# 🎯 Objetivo final

* Backend **sempre online**
* URL estável: `https://dropsaas.fly.dev`
* OAuth Shopify funcional
* Webhooks 100% confiáveis
* Local dev continua a funcionar

---

# 🧠 Antes de começar (importante)

### Sobre o “Free plan” do Fly

O Fly **já não tem free eterno**, mas:

* dá **créditos grátis**
* uma app pequena (Shopify backend) → **$0 ou <$2/mês**
* sem sleep
* muito mais estável que Render free

👉 Para uso pessoal/dev: **perfeito**

---

# 1️⃣ Preparar o projeto local

Na raiz do projeto Shopify app:

```bash
git status
```

Se ainda não tens repo:

```bash
git init
git add .
git commit -m "Initial Shopify app"
```

> ✔️ **Sim, cria repo GitHub**
> Mesmo sendo pessoal:

* facilita deploy
* backups
* futuro App Store

---

# 2️⃣ Instalar Fly CLI

```bash
curl -L https://fly.io/install.sh | sh
```

Depois:

```bash
fly auth login
```

---

# 3️⃣ Launch da app (passo chave)

Na raiz do projeto:

```bash
fly launch
```

Responde assim 👇

### Perguntas importantes

**App name**

```
dropsaas
```

**Region**

```
fra (ou mad)
```

**Dockerfile**

```
Yes (autodetect)
```

**Deploy now?**

```
NO ❌
```

> Não queremos deploy antes de configurar envs

---

# 4️⃣ Ajustar `Dockerfile` (CRÍTICO)

Shopify apps precisam disto:

### Se NÃO existir `Dockerfile`, cria:

```Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV NODE_ENV=production
ENV PORT=8080

RUN npm run build

EXPOSE 8080

CMD ["npm", "run", "start"]
```

👉 Confirma:

* `npm run build`
* `npm run start` existem

---

# 5️⃣ Configurar variáveis de ambiente no Fly

### Ver `.env` local

Normalmente tens algo como:

```
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SCOPES=
DATABASE_URL=
```

Agora seta no Fly:

```bash
fly secrets set \
SHOPIFY_API_KEY=xxx \
SHOPIFY_API_SECRET=yyy \
SCOPES=write_products,read_orders,write_orders \
NODE_ENV=production
```

❗ **Nunca uses `.env` em produção**

---

# 6️⃣ Ajustar `shopify.app.toml`

### Antes (dev)

```toml
application_url = "https://method-gif-borough-photography.trycloudflare.com"
```

### Depois (produção)

```toml
application_url = "https://dropsaas.fly.dev"
```

E:

```toml
[auth]
redirect_urls = [
  "https://dropsaas.fly.dev/auth/callback"
]
```

⚠️ Isto é **obrigatório**, senão OAuth falha

---

# 7️⃣ Deploy 🚀

Agora sim:

```bash
fly deploy
```

No fim vais ver algo como:

```
https://dropsaas.fly.dev
```

Testa no browser.

---

# 8️⃣ Reinstalar a app na store

❗ MUITO IMPORTANTE

Sempre que mudas:

* `application_url`
* scopes
* webhooks

👉 **Reinstala a app**

Usa:

```
Custom distribution link
```

Ou:

```
/oauth/install_custom_app
```

---

# 9️⃣ Webhooks (agora ficam estáveis)

Os teus webhooks:

```toml
[[webhooks.subscriptions]]
topics = [ "orders/create", "orders/updated" ]
uri = "/webhooks/orders"
```

Agora vão bater em:

```
https://dropsaas.fly.dev/webhooks/orders
```

✔️ Mesmo com o PC desligado
✔️ Mesmo sem npm run dev

---

# 10️⃣ Dev vs Produção (sem dores)

### Local dev

```bash
npm run dev
```

* cloudflare/ngrok
* testes
* logs rápidos

### Produção

```bash
fly logs
```

App:

* estável
* real
* pronta para SaaS

---

# 🔐 Segurança (Shopify)

Não te esqueças de:

* validar HMAC dos webhooks
* usar session storage (DB / Redis)
* nunca confiar no payload sem verificação

---

# TL;DR

✔️ Fly.io é a escolha certa
✔️ Não precisas publicar a app
✔️ Não precisas manter npm run dev ligado
✔️ Webhooks + OAuth ficam estáveis
✔️ Setup serve agora e no futuro App Store

---

Se quiseres, no próximo passo posso:

* rever **teu código de webhooks**
* ajudar a ligar **Shopify → Supabase**
* validar **HMAC + idempotência**

👉 diz só: **“seguimos para webhooks + supabase”**
