# Flought SaaS - Deployment & Setup Guide

This document contains a comprehensive record of the configuration settings required to deploy the Flought SaaS application across Vercel (Frontend), Render (Backend), Supabase (Database & Auth), and Meta (WhatsApp Cloud API).

Use this guide as a checklist if you ever need to migrate servers, set up a staging environment, or recreate the infrastructure from scratch.

---

## 1. Supabase (Database & Authentication)

When moving from local development to production, Supabase Authentication must be updated to redirect users back to the live domain after email verification.

**Configuration Location:** Supabase Dashboard -> Authentication -> URL Configuration
* **Site URL:** `https://flought.com` (or your active Vercel domain)
* **Redirect URLs:** Add `https://flought.com/**`

*Note on existing users:* If a user was created *before* the Site URL was updated, their verification email contains a broken `localhost` link. To fix this, manually confirm their account via the Supabase Dashboard (Auth -> Users -> `...` -> Confirm User).

---

## 2. Vercel (Frontend Hosting)

The frontend is a React + Vite application hosted on Vercel.

**Required Environment Variables:**
* `VITE_SUPABASE_URL`: Your Supabase Project URL
* `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Public Key
* `VITE_BACKEND_URL`: The URL of your live Render backend (e.g., `https://watsapp-saas-mg97.onrender.com`)

**Tailwind CSS Note:** We are using Tailwind v4. To support dynamic theme variables applied via React Context (e.g., swapping to a dark mode or changing the brand accent color), we have manually mapped the `.bg-brand-accent` utility classes in `src/index.css` using `!important` to bypass Tailwind's build-time parser limitations.

---

## 3. Render (Node.js Backend Hosting)

The backend handles incoming Webhooks from Meta and processes background tasks. 

**CORS Policy:**
The backend is configured in `src/index.ts` to strictly allow requests *only* from verified origins. If you change your frontend domain, you MUST update the `FRONTEND_URL` environment variable or the request will be blocked by CORS.

**Required Environment Variables in Render:**
* `DATABASE_URL`: The direct Postgres connection string from Supabase (e.g., `postgresql://postgres:[PASSWORD]@...:5432/postgres`)
* `SUPABASE_URL`: Your Supabase Project URL
* `SUPABASE_SERVICE_ROLE_KEY`: The Supabase Service Role Key (Required to bypass RLS for background jobs)
* `FRONTEND_URL`: A comma-separated list of allowed frontend domains (e.g., `https://flought.com,https://www.flought.com`)
* `DB_ENCRYPTION_KEY`: A 32+ character random string used for AES-256 Application-Level Encryption. (Required to safely encrypt Meta Access Tokens before saving to Supabase).
* `OPENAI_API_KEY`: API key for LLM generation
* `LLM_MODEL`: The designated model to use (e.g., `openai/gpt-4o-mini`)
* `META_APP_SECRET`: The actual App Secret from the Meta Developer Dashboard (Required in production to cryptographically verify incoming webhook signatures).
* `META_VERIFY_TOKEN`: A custom string used to verify the initial Webhook connection (e.g., `flought-meta-test`).

---

## 4. Meta Developer Portal (WhatsApp Cloud API)

To route WhatsApp messages into the SaaS, the Meta App must be connected to the Render backend via Webhooks.

**Configuration Location:** Meta Developer Portal -> WhatsApp -> Configuration -> Webhooks

1. **Callback URL:** `https://[YOUR_RENDER_URL]/webhooks/meta`
   * *Example:* `https://watsapp-saas-mg97.onrender.com/webhooks/meta`
2. **Verify Token:** This must perfectly match the `META_VERIFY_TOKEN` you set in your Render environment variables.
3. **Webhook Fields:** You MUST click "Manage" and subscribe to the `messages` event. If this is unchecked, WhatsApp will not forward incoming texts to the backend.

### User/Tenant Configuration (Inside Flought Dashboard)
When a tenant creates an account on Flought and wishes to connect their WhatsApp number, they must go to **Settings -> WhatsApp API** and provide:
* **WABA ID:** WhatsApp Business Account ID
* **Phone Number ID:** Their specific Phone Number ID
* **API Key / Access Token:** A System User Access Token generated from Meta.
* **Webhook Verify Token:** This field in the frontend generates a unique token for the tenant, but currently, the architecture relies on the global Platform Webhook (`/webhooks/meta`) for routing.
