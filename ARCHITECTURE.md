# Flought Architecture Map

Welcome to Flought! If you are a junior developer or an AI agent, this document will teach you exactly how the system is architected, how data flows through the application, and how multi-tenancy is secured.

---

## 1. System Overview

Flought is a multi-tenant B2B platform. We sell this software to individual businesses ("Tenants"), who then connect their WhatsApp phone numbers to our system. 
We act as the middleware between **WhatsApp (via Gupshup/BSP)** and the **Customer**, injecting AI (RAG) and Human Agent handovers.

### The Stack
- **Frontend:** React 18, Vite, React Router, Tailwind CSS v4, Radix UI.
- **Backend:** Node.js, Express (REST API).
- **Database & Auth:** Supabase (PostgreSQL, pgvector, Edge Auth).
- **AI Models:** Claude (via OpenAI SDK format) for generation, OpenAI for embeddings.

---

## 2. Core Data Flow (The WhatsApp Loop)

When a customer sends a WhatsApp message to a Flought Tenant, this is the exact execution path:

1. **Webhook Ingestion (`backend/src/routes/webhook.ts`):** 
   Gupshup POSTs a raw JSON payload to our `/api/webhook/:provider` endpoint.
2. **Normalization (`backend/src/services/messageHandler.ts`):** 
   We parse the proprietary Gupshup payload into a standard `NormalizedInboundMessage`. We identify which `tenant_id` this message belongs to based on the destination phone number.
3. **Session State (Postgres `conversations` table):** 
   We check the `status` of the conversation. 
   - If `status === 'handover_pending'` or `'handover_active'`, the AI is muted. The webhook returns 200 OK immediately, and the human agent relies on the React UI to reply.
   - If `status === 'bot'`, we proceed to AI automation.
4. **RAG Retrieval (`backend/src/services/kb/retrieval.ts`):** 
   We generate an embedding for the customer's question and execute the Postgres RPC `match_knowledge_chunks`. `pgvector` does native KNN matching and returns the top 3 most relevant knowledge snippets.
5. **LLM Generation (`backend/src/services/llm/generator.ts`):** 
   We build a strict prompt containing the knowledge chunks and ask Claude Haiku to answer. It returns a JSON object with a `confidence` score.
6. **Delivery or Handover (`backend/src/services/automation/pipeline.ts`):**
   - **High Confidence:** We POST the answer back to Gupshup via `provider.sendSessionMessage()`.
   - **Low Confidence:** We call `triggerHandover()`, which sets the conversation to `handover_pending` and flashes the React Inbox UI so a human can step in.

---

## 3. Database Schema & Multi-Tenancy

Because this is a multi-tenant application, one single Postgres database holds data for hundreds of different businesses. We strictly enforce isolation using **Postgres Row Level Security (RLS)**.

### Core Tables
1. **`tenants`:** The root table. Every business has a UUID.
2. **`tenant_users`:** A mapping table linking a Supabase `auth.users` ID to a `tenant_id`, with a specific role (`admin` or `agent`).
3. **`conversations`:** A chat thread between a Tenant and a Customer Phone Number.
4. **`messages`:** Individual chat bubbles linked to a Conversation.
5. **`knowledge_chunks`:** The vectorized FAQ data used for RAG, strictly partitioned by `tenant_id`.

### The RLS Strategy
Every table (except `tenants`) has an RLS policy that essentially says:
> *You can only SELECT/INSERT/UPDATE this row if the `tenant_id` matches the business you work for.*

This is enforced via a custom Postgres function: `is_tenant_member(tenant_id)`.

---

## 4. Platform Admin (Super Admin)

There is a special bypass in the system for Flought employees to manage the businesses themselves.
- **Table:** `platform_admins`
- **Backend Auth (`backend/src/routes/admin.ts`):** The `requirePlatformAdmin` middleware checks this table before allowing access to the `/api/admin/tenants` routes.
- **Frontend Auth (`src/contexts/AuthContext.tsx`):** The React context hits the `GET /api/admin/check` endpoint on mount. If true, the `isPlatformAdmin` boolean is set, and a hidden "Admin Dashboard" button appears in the sidebar.
