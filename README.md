# Flought — WhatsApp AI Support SaaS

Multi-tenant B2B SaaS that connects businesses to **WhatsApp** (Meta Cloud API and optional Gupshup BSP), automates replies with **RAG**, and hands complex conversations to human agents. One codebase supports **cloud deployment (Vercel + Render)** and **self-hosted Docker Compose / Coolify** on a VPS.

---

## Overview

**Flought** (this repo) is the full stack for a WhatsApp Business Solution Provider style product:

- Tenants connect WhatsApp numbers, upload knowledge, configure flows, and manage an agent inbox.
- Inbound messages hit an Express API, run through a **waterfall automation pipeline** (FAQ → flows → hybrid retrieval → LLM), and optionally escalate to humans.
- **Supabase** provides Auth, Postgres, Row Level Security (RLS), Storage, Realtime, and **pgvector** for embeddings.
- Background work (campaigns, KB ingest, SLA, auto-FAQ mining) runs via **pg-boss** inside the backend process.

For deeper internals, see [ARCHITECTURE.md](./ARCHITECTURE.md) and [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, React Router, Tailwind CSS v4, Radix UI, TanStack Query |
| Backend | Node.js 20+, Express, TypeScript |
| Data & auth | Supabase (Postgres, RLS, Auth, Storage, Realtime, pgvector) |
| Queue / workers | pg-boss (same Node process as API) |
| WhatsApp | Meta Cloud API (MetaProvider); Gupshup supported in BSP layer |
| AI | OpenAI-compatible API (chat, embeddings); optional Cohere rerank |
| Billing | Razorpay subscriptions and webhooks |
| Deploy (cloud) | Vercel (SPA), Render (Node backend) — see ercel.json, 
ender.yaml |
| Deploy (VPS) | Docker Compose: Nginx frontend + Node/ffmpeg backend — see [Coolify dual-deploy plan](./docs/superpowers/plans/2026-07-25-coolify-dual-deploy.md) |

---

## Features

- **Knowledge base & RAG** — PDF/TXT ingest workers, chunking, embeddings, optional rerank; hybrid **vector + BM25 (RRF)** via Postgres RPC.
- **Semantic cache** — pgvector-backed similarity cache to cut LLM cost on repeated questions.
- **FAQ matcher** — Published FAQs short-circuit the pipeline; auto-FAQ miner drafts candidates from chat logs.
- **Automation flows** — Visual flow matching for structured bot paths.
- **Human handover** — Regex/intent gates, SLA worker, agent inbox with Realtime updates.
- **Campaigns** — Outbound campaign worker via pg-boss.
- **Embeddable web chat widget** — Configurable widget with tenant-scoped tokens.
- **Billing & tiers** — Razorpay plans, webhooks, quota enforcement in the pipeline.
- **Optional voice** — STT for inbound audio; TTS + ffmpeg for voice-note replies when enabled.
- **Integrations** — Shopify webhooks, CRM/marketing hooks (see backend routes).

---

## Architecture — inbound message waterfall

External WhatsApp traffic enters /webhooks/meta. Messages are normalized, tenant-scoped, and stored; if the conversation is in bot mode, processAutomationPipeline runs a **cheap-first waterfall**:

`mermaid
flowchart TD
  WH[WhatsApp webhook] --> MH[messageHandler normalize + persist]
  MH --> BOT{Conversation bot mode?}
  BOT -->|no| INBOX[Human inbox / Realtime]
  BOT -->|yes| P[Automation pipeline]
  P --> G1[Human intent / handover regex]
  G1 -->|escalate| HO[triggerHandover]
  G1 -->|continue| G2[Quota reserve]
  G2 --> FAQ[FAQ match]
  FAQ -->|hit| SEND[Send via BSP]
  FAQ -->|miss| FLOW[Flow matcher]
  FLOW -->|handled| SEND
  FLOW -->|miss| CACHE[Semantic cache]
  CACHE -->|hit| SEND
  CACHE -->|miss| RAG[Hybrid KB retrieval + optional rerank]
  RAG --> LLM[LLM generator + confidence]
  LLM -->|high confidence| SEND
  LLM -->|low confidence| HO
  SEND --> META[Meta / Gupshup outbound API]
`

Supabase stays **external** on both cloud and VPS paths (no self-hosted Postgres in the Compose plan).

---

## Deployment paths

### Cloud (default)

1. **Supabase** — Create project; run migrations from supabase/migrations/.
2. **Render** — Deploy ackend/ using 
ender.yaml (Node 20, health check GET /health).
3. **Vercel** — Deploy root Vite app; set build-time VITE_* variables.
4. Point Meta WhatsApp webhook to https://<api-host>/webhooks/meta.

Details: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

### VPS — Docker Compose / Coolify

From repo root (after copying .env.example → .env and filling values):

`ash
docker compose up --build
`

- Frontend: http://localhost:8080
- Backend: http://localhost:4000 (GET /health)

Full dual-path playbook (staging domains, env matrix, ffmpeg for TTS):

**[docs/superpowers/plans/2026-07-25-coolify-dual-deploy.md](./docs/superpowers/plans/2026-07-25-coolify-dual-deploy.md)**

Related RAG docs: [2026-07-25-rag-implementation.md](./docs/superpowers/plans/2026-07-25-rag-implementation.md), [2026-07-25-rag-redesign.md](./docs/superpowers/plans/2026-07-25-rag-redesign.md).

---

## Prerequisites

- **Node.js 20+**
- **npm**
- **Supabase** project (URL, anon key, service role key, Postgres connection string for pg-boss)
- **Meta** WhatsApp Cloud API app (or Gupshup credentials if using that BSP)
- **OpenAI-compatible** API key for chat + embeddings
- Optional: Razorpay, Cohere (rerank), ffmpeg (TTS OGG on VPS — included in ackend/Dockerfile)

---

## Local development

`ash
# Frontend (repo root) — default Vite port 5173
npm install
npm run dev

# Backend (separate terminal)
cd backend
npm install
cp .env.example .env   # fill values locally; never commit .env
npm run dev            # default http://localhost:4000
`

**Database migrations** (Supabase CLI linked to your project):

`ash
supabase db push
# or apply SQL from supabase/migrations/ via Supabase Dashboard SQL editor
`

Health check: curl http://127.0.0.1:4000/health

---

## Project structure

`
.
├── src/                    # React SPA (dashboard, inbox, KB, flows, widget config)
├── backend/
│   ├── src/
│   │   ├── bsp/            # Meta / Gupshup providers
│   │   ├── routes/         # REST API, billing, widget, admin
│   │   ├── services/
│   │   │   ├── automation/ # Pipeline, handover, flows, FAQ, SLA
│   │   │   ├── kb/         # Retrieval, ingest, chunking, parsers
│   │   │   └── llm/        # Generator, STT, TTS
│   │   └── index.ts        # Express app + worker bootstrap
│   └── Dockerfile          # Node 20 + ffmpeg (Coolify/local)
├── frontend/               # Nginx + Docker build for SPA
├── supabase/migrations/    # Postgres schema, RLS, pgvector RPCs
├── docker-compose.yml      # frontend + backend (Supabase external)
├── vercel.json             # Vercel SPA config
├── render.yaml             # Render backend config
└── docs/superpowers/plans/ # Implementation & deploy plans
`

---

## Environment variables

**Do not commit secrets.** Use templates only:

| File | Purpose |
|------|---------|
| [.env.example](./.env.example) | Docker Compose / Coolify checklist (VITE_* build args + pointers to backend) |
| [backend/.env.example](./backend/.env.example) | Full backend runtime list |

**Frontend (build-time, VITE_ prefix):**

- VITE_API_URL — Public API origin (no trailing slash)
- VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
- VITE_META_APP_ID — Meta embedded signup / OAuth UI

**Backend (runtime, summary):**

- **Required:** SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, OPENAI_API_KEY, DB_ENCRYPTION_KEY (32 chars in prod), PORT, NODE_ENV, FRONTEND_URL
- **WhatsApp Meta:** META_ACCESS_TOKEN, META_PHONE_NUMBER_ID, META_APP_SECRET, META_VERIFY_TOKEN
- **Gupshup (optional):** GUPSHUP_*
- **Billing:** RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, plan IDs
- **Optional AI / media:** LLM_MODEL, ENABLE_RERANK, COHERE_*, TTS_*, FFMPEG_PATH, OPENAI_BASE_URL
- **Dev only:** SKIP_WEBHOOK_VERIFY=true (bypass Meta HMAC — never in production)

**Note:** 	enant.ts may call the public API using VITE_API_URL on the **backend** env — set it to the same public API base URL on Render/Coolify.

---

## Webhooks & public endpoints

| Endpoint | Purpose |
|----------|---------|
| GET/POST /webhooks/meta | Meta WhatsApp verification + inbound events (HMAC via META_APP_SECRET) |
| POST /api/billing/webhook | Razorpay subscription/payment events |
| POST /api/shopify/webhook | Shopify app events |
| POST /api/integrations/shopify/webhook/:pathToken | Per-tenant Shopify integration |
| GET /health | Load balancer / Compose health check |

Configure Meta callback URL: https://<your-api-domain>/webhooks/meta.

---

## Scripts

| Location | Command | Description |
|----------|---------|-------------|
| Root | 
pm run dev | Vite dev server |
| Root | 
pm run build | Production frontend build |
| ackend/ | 
pm run dev | Express + workers (tsx watch) |
| ackend/ | 
pm run build / 
pm start | Compiled production server |
| Root | docker compose up --build | Full stack locally |

---

## License

No license file is included in this repository. All rights reserved unless you add an explicit LICENSE file.

---

## Repository

**Remote:** [https://github.com/Jun-ai-d/Flought-watsapp-saas.git](https://github.com/Jun-ai-d/Flought-watsapp-saas.git)
