# Flought Sitemap & API Endpoints

This document maps out every available route in the system, both on the React Frontend and the Node.js Backend.

---

## 🖥 Frontend Routes (React + Vite)

All frontend routes are lazy-loaded via `src/App.tsx` using `React.lazy()` for aggressive bundle splitting.

### Public Routes
These routes do not require a Supabase Auth session.
- `/` — **Landing Page:** Public marketing site.
- `/login` — **Auth Entry:** Email/password login that sets the JWT.

### Tenant Dashboard (Protected)
These routes require a valid session and a `tenant_id`. Handled by the `Layout` wrapper.
- `/dashboard` — **Analytics Hub:** Key metrics (total messages, handover rate).
- `/inbox` — **Human Handover UI:** Real-time 3-pane chat interface for agents to take over from the bot.
- `/kb` — **Knowledge Base Manager:** UI to upload PDFs/Text and vectorize them into `pgvector` chunks.
- `/faq` — **Static FAQs:** Simple Q&A pairs that override the RAG AI if an exact keyword match is found.
- `/templates` — **WhatsApp Templates:** BSP-approved template messages (e.g., Marketing blasts).
- `/billing` — **Subscriptions:** View current plan (Standard/Growth/VIP), cap usage, and Razorpay integration.
- `/settings` — **Configuration:** Invite new team members (`admin` or `agent`) to the tenant.

### Platform Admin (Super Restricted)
These routes require the user to be listed in the `platform_admins` Postgres table.
- `/admin` — **Master Control:** A God-mode dashboard to provision new Tenants, assign tiers, and monitor global system health.

---

## 🔌 Backend Endpoints (Express API)

Base URL: `http://localhost:4000/api` (Dev) or `$VITE_API_URL` (Prod).

### Webhook Routes (Public/Unauthenticated)
- `POST /webhook/:provider`
  - **Purpose:** Ingests raw WhatsApp messages from the BSP (e.g., Gupshup, Meta).
  - **Logic:** `backend/src/routes/webhook.ts` -> `messageHandler.ts`

### Platform Admin Routes (Protected via JWT)
Requires `Authorization: Bearer <token>` and `platform_admins` verification.
- `GET /admin/check`
  - **Purpose:** Returns `{ isPlatformAdmin: true }` if authorized. Used by Frontend AuthContext.
- `GET /admin/tenants`
  - **Purpose:** Lists all businesses currently using Flought.
- `POST /admin/tenants`
  - **Payload:** `{ "business_name": "Acme", "region": "IN", "tier": "growth" }`
  - **Purpose:** Provisions a new database tenant and subscription record.

### Outbound Messaging (Protected via JWT)
Requires `Authorization: Bearer <token>` and standard tenant association.
- `POST /send`
  - **Payload:** `{ "tenantId": "uuid", "conversationId": "uuid", "text": "Hello", "providerName": "gupshup" }`
  - **Purpose:** Used by human agents in the `/inbox` UI to manually send a WhatsApp message back to the customer, bypassing the AI.
