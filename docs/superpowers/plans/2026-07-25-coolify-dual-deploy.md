# Coolify Dual-Deploy Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Constraint:** Ponytail / YAGNI — **plan + minimal Docker Compose only**. Do not move Supabase to the VPS. Do not force-migrate off Vercel/Render. Staging Coolify first.
>
> **Related (do not rewrite):** RAG work is independent and keeps Supabase external — see [`2026-07-25-rag-implementation.md`](./2026-07-25-rag-implementation.md) and [`2026-07-25-rag-redesign.md`](./2026-07-25-rag-redesign.md). Coolify hosts the Express API (incl. `kb-ingest` / pg-boss workers + optional ffmpeg TTS); vector DB stays on Supabase. Hygiene plan: [`2026-07-25-hygiene-and-bugfixes.md`](./2026-07-25-hygiene-and-bugfixes.md).

**Goal:** Deploy Flought WhatsApp SaaS via **two paths from one Git repo**: keep **Vercel FE + Render BE** working, and add a **Coolify VPS path** using **one Docker Compose** (`frontend` + `backend`), matching the GST SaaS Coolify pattern — with staging-first cutover and optional DNS/webhook flip.

**Architecture:** One Compose stack for VPS: Vite static assets behind Nginx + Node Express (API + pg-boss workers in-process) with **ffmpeg** installed for optional TTS OGG conversion. **Supabase stays external** on both paths (Auth, Postgres, Storage, pgvector). Cloud path remains Vercel + Render (native Node). Same repo; env/domain matrices differ. Azure credits cover ~3 months cloud; then VPS can become primary.

**Tech stack (locked):**

| Layer | Cloud path (current) | VPS path (target) | Notes |
|-------|----------------------|-------------------|-------|
| Frontend | Vercel (Vite SPA) | Coolify → `frontend` Nginx | Build args inject `VITE_*` |
| Backend | Render (`env: node`, `rootDir: backend`) | Coolify → `backend` Node 20 + ffmpeg | Same `npm run build` / `npm start` |
| DB / Auth / Storage / pgvector | Supabase (external) | Supabase (external) | **Do not** self-host Postgres on VPS in this plan |
| Queue / workers | pg-boss inside Render process | pg-boss inside Compose `backend` | Needs `DATABASE_URL` (Supabase Postgres) |
| TTS media | Optional ffmpeg on Render (often missing) | ffmpeg in backend image | Graceful text fallback if missing |
| Orchestration | `vercel.json` + `render.yaml` | Root `docker-compose.yml` | No second repo |

---

## Locked decisions

1. **One Compose file** at repo root: services `frontend` + `backend` only (no local Postgres/Redis).
2. **Supabase remains SaaS** for both paths.
3. **Do not force** migration off Vercel/Render in Phases 0–4.
4. **Render stays native Node** (`render.yaml` already `env: node`) — do **not** switch Render to Docker in this plan (YAGNI). Backend Dockerfile is for Coolify/local Compose; optionally reusable later.
5. **Staging domains first** (`app-staging.*` / `api-staging.*`), then optional production DNS + Meta webhook flip.
6. **Shared VPS** with GST SaaS: 16GB RAM / 64GB SSD; set memory limits so both Compose stacks coexist.
7. **Explicit `0.0.0.0` bind** on Express listen (today: `app.listen(PORT)` without host — Node usually accepts all interfaces, but Docker/Coolify should be explicit).

---

## File map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/Dockerfile` | Node 20 + ffmpeg; `npm ci` → `npm run build` → `npm start` |
| Create | `backend/.dockerignore` | Exclude `node_modules`, `.env`, tests, scripts noise |
| Create | `Dockerfile` (repo root) **or** `frontend/Dockerfile` | Prefer root `Dockerfile` named clearly — **use `frontend/Dockerfile`** for clarity |
| Create | `frontend/Dockerfile` | Multi-stage: `node` build Vite → `nginx:alpine` serve `dist` |
| Create | `frontend/nginx.conf` | SPA fallback to `index.html`; proxy optional (default: FE calls absolute `VITE_API_URL`) |
| Create | `frontend/.dockerignore` | Exclude `node_modules`, `dist`, `.env*` |
| Create | `docker-compose.yml` (repo root) | `frontend` + `backend`; ports; env_file / environment |
| Create | `.env.example` (repo root) | Coolify/local Compose checklist (no secrets); FE `VITE_*` + BE vars |
| Modify | `backend/.env.example` | Add missing `DATABASE_URL`, `FRONTEND_URL`, optional `VITE_API_URL` (backend self-call quirk), `FFMPEG_PATH`, TTS/rerank flags |
| Modify | `backend/src/index.ts` | Bind `0.0.0.0`; keep existing `GET /health` |
| Modify | `render.yaml` | Document-only comments: health path `/health`, env checklist (optional) |
| Keep | `vercel.json` | SPA rewrites + asset cache (unchanged) |
| Keep | Supabase / RAG code | External; Coolify only runs API workers |
| Docs | This plan | Dual-path + cutover playbook |

**Do not create in this plan:** Kubernetes, Traefik custom stacks, self-hosted Postgres, separate worker containers (workers stay in-process with Express — same as today).

---

## Phase 0 — Preconditions

Complete before writing Dockerfiles. No product behavior change except the minimal listen bind if you choose to land it early.

### Task 0.1: Inventory env vars (FE + BE)

**Files:** read-only — `backend/.env.example`, `backend/src/index.ts`, `backend/src/lib/supabase.ts`, `backend/src/services/jobQueue.ts`, `src/lib/supabase.ts`, `render.yaml`, Vercel/Render dashboards

- [x] **Step 1:** Confirm frontend build-time vars used in code:
  - `VITE_API_URL` — API origin (no trailing slash); default fallback `http://localhost:4000`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_META_APP_ID` — Meta embedded signup / Settings OAuth
- [x] **Step 2:** Confirm backend runtime vars (from `.env.example` + code):
  - **Required:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (pg-boss — **missing from `.env.example` today**), `OPENAI_API_KEY` (or `OPENAI_STT_KEY`), `DB_ENCRYPTION_KEY` (32 chars in prod), `PORT`, `NODE_ENV`, `FRONTEND_URL` (CORS for Coolify domains)
  - **WhatsApp / Meta:** `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_APP_ID` (OAuth)
  - **Gupshup (if used):** `GUPSHUP_API_KEY`, `GUPSHUP_APP_NAME`, `GUPSHUP_VERIFY_TOKEN`
  - **Billing:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_STANDARD_PLAN_ID`, `RAZORPAY_PRO_PLAN_ID`
  - **Optional AI:** `OPENAI_BASE_URL`, `LLM_MODEL`, `TTS_MODEL`, `TTS_VOICE`, `FFMPEG_PATH`, `ENABLE_RERANK`, `COHERE_API_KEY`, `COHERE_RERANK_MODEL`, `SKIP_WEBHOOK_VERIFY` (dev only)
  - **Quirk:** `backend/src/routes/tenant.ts` uses `process.env.VITE_API_URL` for internal `fetch` to `/api/topics/extract` — set this on the **backend** env to the public API base URL on Coolify/Render (or fix later to `PUBLIC_API_URL`; out of scope unless blocking)
- [x] **Step 3:** Fill the matrix (ops note — copy into root `.env.example` comments in Phase 1):

| Variable | Vercel (FE) | Render (BE) | Coolify FE | Coolify BE |
|----------|-------------|-------------|------------|------------|
| `VITE_API_URL` | Build env → Render URL | — (also set if using tenant self-fetch quirk) | Build arg → `https://api-staging…` | Same value for self-fetch |
| `VITE_SUPABASE_URL` | Build env | — | Build arg | — |
| `VITE_SUPABASE_ANON_KEY` | Build env | — | Build arg | — |
| `VITE_META_APP_ID` | Build env | — | Build arg | — |
| `SUPABASE_*` / `DATABASE_URL` | — | Dashboard | — | Coolify env |
| `FRONTEND_URL` | — | `https://flought.com,…` | — | Staging + prod app origins |
| `PORT` | — | Injected by Render | — | Compose/Coolify (e.g. `4000`) |
| Meta / Razorpay / OpenAI / encryption | — | Dashboard | — | Coolify env |

**Verify:** List is complete vs dashboards; no secrets written into the plan file.

**Depends on:** nothing.

### Task 0.2: Confirm PORT bind + health

**Files:** `backend/src/index.ts` (~lines 28, 103–106, 127–142)

- [x] **Step 1:** Confirm health already exists:

```bash
# With backend running locally:
curl -s http://127.0.0.1:4000/health
```

Expected JSON: `{"status":"ok","timestamp":"..."}`.

- [x] **Step 2:** Note gap: `app.listen(PORT, async () => {…})` has **no host**. For Docker/Coolify, plan Phase 1 Task 1.5 to change to:

```ts
app.listen(Number(PORT), '0.0.0.0', async () => {
  console.log(`🚀 Backend server running on http://0.0.0.0:${PORT}`);
  // … existing worker init unchanged
});
```

- [x] **Step 3:** Confirm `trust proxy` is already `1` (good for Coolify/Render TLS terminators).

**Verify:** `/health` and `/` both return 200 locally.

**Depends on:** Task 0.1.

### Task 0.3: Confirm ffmpeg need for TTS

**Files:** `backend/src/services/llm/tts.ts`

- [x] Confirm TTS uses `FFMPEG_PATH || 'ffmpeg'` to convert MP3 → mono OGG/Opus; if ffmpeg missing, logs warning and returns `null` (text fallback).
- [x] Decision (locked): **install ffmpeg in `backend/Dockerfile`** via apt (`ffmpeg`). Do not require ffmpeg on Render native path for this plan.
- [x] RAG Phase 6 TTS remains optional / off by default — Coolify image still includes ffmpeg so enabling voice later does not need a rebuild policy change.

**Verify:** On a machine with ffmpeg: `ffmpeg -version` exits 0. On Render without ffmpeg: TTS falls back (acceptable for cloud path).

**Depends on:** Task 0.2.

### Task 0.4: Webhook / domain cutover notes (inventory only)

**Files:** `backend/src/routes/webhooks.ts`, `backend/src/index.ts`, Settings UI webhook display

- [ ] Meta WhatsApp webhook URL pattern: `https://<API_HOST>/webhooks/meta` (GET verify + POST events). Mounted at `/webhooks` before CORS.
- [ ] Razorpay webhook: `https://<API_HOST>/api/billing/webhook`
- [ ] Shopify (tenant): `https://<API_HOST>/api/integrations/shopify/webhook?tenant_id=…` (shown via `VITE_API_URL` in Settings)
- [ ] Record current production API host (Render URL or custom domain) for Phase 5 rollback.

**Verify:** Meta App Dashboard shows current callback URL; document it in your private ops notes (not in git).

**Depends on:** Task 0.1.

---

## Phase 1 — Docker artifacts (shared foundation)

Minimal files so `docker compose up --build` works locally and Coolify can pull the same compose.

### Task 1.1: Backend Dockerfile + dockerignore

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`

- [x] **Step 1:** Create `backend/.dockerignore`:

```
node_modules
dist
.env
.env.*
coverage
**/*.test.ts
**/__tests__
.git
```

- [x] **Step 2:** Create `backend/Dockerfile` (production, Node 20, ffmpeg):

```dockerfile
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build \
  && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["npm", "start"]
```

- [x] **Step 3:** Confirm scripts in `backend/package.json`: `"build": "tsc"`, `"start": "node dist/index.js"`, `engines.node >= 20`.

**Verify:**

```bash
docker build -t flought-backend ./backend
```

Expected: image builds; no secrets copied.

**Depends on:** Phase 0.

### Task 1.2: Frontend Dockerfile + nginx SPA config

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Create: `frontend/.dockerignore`

Note: App source lives at **repo root** (`src/`, `index.html`, `vite.config.ts`, root `package.json`), not under a `frontend/` package. The Dockerfile context must be **repo root** with `-f frontend/Dockerfile`, **or** place `Dockerfile` at root named via compose `dockerfile: frontend/Dockerfile` + `context: .`.

- [ ] **Step 1:** Create `frontend/.dockerignore` is unused if context is root — instead create root-friendly ignore via compose build context `.dockerignore` at **repo root**:

Create: `.dockerignore` (repo root)

```
node_modules
backend/node_modules
dist
backend/dist
.git
.env
.env.*
docs
supabase/.temp
**/*.md
!README.md
```

- [x] **Step 2:** Create `frontend/nginx.conf`:

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

- [x] **Step 3:** Create `frontend/Dockerfile` (context = repo root):

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS build
WORKDIR /app

ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_META_APP_ID

ENV VITE_API_URL=$VITE_API_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_META_APP_ID=$VITE_META_APP_ID

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig*.json ./
COPY src ./src
COPY public ./public
# add any other root assets the Vite build needs (e.g. components.json) if present

RUN npm run build

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Adjust `COPY` lines if the repo has extra config files required by `tsc -b` / Vite (inspect root before implementing).

**Verify:**

```bash
docker build -f frontend/Dockerfile \
  --build-arg VITE_API_URL=http://localhost:4000 \
  --build-arg VITE_SUPABASE_URL=https://example.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=eyJhbGciOi... \
  --build-arg VITE_META_APP_ID= \
  -t flought-frontend .
```

Expected: build succeeds; image serves on `:80`.

**Depends on:** Task 1.1.

### Task 1.3: Root docker-compose.yml

**Files:**
- Create: `docker-compose.yml`

- [x] **Step 1:** Create compose (local + Coolify-compatible):

```yaml
services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "4000:4000"
    environment:
      PORT: "4000"
      NODE_ENV: production
      # Inject the rest via Coolify UI or env_file (never commit secrets)
    env_file:
      - path: .env
        required: false
    restart: unless-stopped
    # Suggested limits on shared 16GB VPS (tune vs GST):
    mem_limit: 2g
    cpus: "1.5"
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
      args:
        VITE_API_URL: ${VITE_API_URL:-http://localhost:4000}
        VITE_SUPABASE_URL: ${VITE_SUPABASE_URL}
        VITE_SUPABASE_ANON_KEY: ${VITE_SUPABASE_ANON_KEY}
        VITE_META_APP_ID: ${VITE_META_APP_ID:-}
    ports:
      - "8080:80"
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped
    mem_limit: 256m
    cpus: "0.5"
```

- [ ] **Step 2:** Coolify note: Coolify often injects env at the stack level; `env_file: .env` is for local. In Coolify UI, set the same keys as environment variables — do not rely on committing `.env`.

**Verify:** `docker compose config` validates YAML.

**Depends on:** Tasks 1.1–1.2.

### Task 1.4: Env examples (no secrets)

**Files:**
- Create: `.env.example` (repo root)
- Modify: `backend/.env.example`

- [x] **Step 1:** Root `.env.example` — Compose build + runtime checklist:

```bash
# Frontend (build-time — baked into Nginx image)
VITE_API_URL=https://api-staging.example.com
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_META_APP_ID=

# Backend (runtime — also list in Coolify shared env)
# Copy keys from backend/.env.example into Coolify; do not commit real values.
```

- [x] **Step 2:** Append to `backend/.env.example`:

```bash
# --- Postgres for pg-boss (Required) ---
# Use Supabase connection string (prefer pooler for serverless; direct OK on long-lived Coolify/Render)
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres

# --- Public API URL (backend self-fetch quirk in tenant.ts) ---
VITE_API_URL=https://api-staging.example.com

# --- Optional TTS ---
# FFMPEG_PATH=/usr/bin/ffmpeg
# TTS_MODEL=tts-1
# TTS_VOICE=alloy
```

**Verify:** `git status` shows only example files; no real keys.

**Depends on:** Task 0.1.

### Task 1.5: Bind Express to 0.0.0.0

**Files:**
- Modify: `backend/src/index.ts`

- [x] **Step 1:** Change listen to explicit host (keep worker init identical).
- [x] **Step 2:** Keep `GET /health` as-is (already present — do not add a second health router).

**Verify:**

```bash
cd backend && npm run build && node dist/index.js
# from another shell:
curl -s http://127.0.0.1:4000/health
```

**Depends on:** Task 0.2.

### Task 1.6: Commit cadence (Docker foundation)

- [ ] Commit 1: `chore(deploy): add backend Dockerfile with ffmpeg`
- [ ] Commit 2: `chore(deploy): add frontend Nginx Docker build`
- [ ] Commit 3: `chore(deploy): add docker-compose and env examples`
- [ ] Commit 4: `fix(backend): bind listen to 0.0.0.0 for container hosts`

**Depends on:** Tasks 1.1–1.5.

---

## Phase 2 — Local Compose verify

### Task 2.1: Bring stack up

**Files:** none (ops)

- [ ] **Step 1:** Copy `.env.example` → `.env` and fill real staging/dev values (never commit).
- [ ] **Step 2:** Ensure `FRONTEND_URL` includes `http://localhost:8080` for CORS when hitting API from Compose FE.
- [ ] **Step 3:** Run:

```bash
docker compose up --build
```

- [ ] **Step 4:** Smoke checks:

```bash
curl -s http://127.0.0.1:4000/health
curl -sI http://127.0.0.1:8080/ | head -n 5
# Browser: open http://localhost:8080 — login via Supabase Auth
```

Expected: health `ok`; FE HTML 200; login works if Supabase URL/anon key baked correctly.

- [ ] **Step 5:** Confirm backend logs include `pg-boss initialized` and `kb-ingest` worker init (from `initKbIngestWorker`) when RAG Phase 1 is merged — otherwise note “worker not yet in branch”.

**Verify:** FE loads, BE health green, CORS not blocking browser calls to API.

**Depends on:** Phase 1.

### Task 2.2: Document local commands

**Files:** optional one short section in root `README.md` **only if README already has Deploy section** — otherwise keep commands in this plan only (Ponytail: no new markdown sprawl).

Document:

```bash
cp .env.example .env   # fill values
docker compose up --build
docker compose logs -f backend
docker compose down
```

**Depends on:** Task 2.1.

---

## Phase 3 — Coolify VPS deploy (staging)

Shared VPS with GST SaaS Compose. Coolify already installed.

### Task 3.1: Create Coolify resource from Git

**Files:** none (Coolify UI)

- [ ] **Step 1:** Coolify → **New Resource** → **Docker Compose**.
- [ ] **Step 2:** Source: **Private Repository (with GitHub App)** — select this Flought repo + branch (prefer `main` or a `deploy/coolify-staging` branch).
- [ ] **Step 3:** Compose file path: `docker-compose.yml` (repo root).
- [ ] **Step 4:** Enable auto-deploy on push to the chosen branch (optional; staging-friendly).

**Verify:** Coolify parses compose; two services visible (`frontend`, `backend`).

**Depends on:** Phase 2 green locally.

### Task 3.2: Domains + TLS

- [ ] Assign domains (example — replace with real DNS you control):
  - Frontend: `app-staging.flought.com` → `frontend` service port `80` (Coolify maps published `8080:80` or override to `80:80` in Coolify networking)
  - Backend: `api-staging.flought.com` → `backend` service port `4000`
- [ ] Prefer Coolify’s proxy SSL (Let’s Encrypt) on both hostnames.
- [ ] Alternative (YAGNI avoid unless needed): single host with path routing — **not recommended** because Vite bakes absolute `VITE_API_URL` and Meta webhooks expect a stable API host.

**Verify:** `https://api-staging…/health` and `https://app-staging…/` both work over TLS.

**Depends on:** Task 3.1.

### Task 3.3: Inject env in Coolify

- [ ] Set **backend** runtime env (all secrets from Task 0.1 matrix).
- [ ] Set **frontend build args** so Coolify rebuilds FE with:
  - `VITE_API_URL=https://api-staging.…`
  - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_META_APP_ID`
- [ ] Set `FRONTEND_URL=https://app-staging.…` (and later prod origins, comma-separated).
- [ ] Set backend `VITE_API_URL` to the same public API URL (tenant self-fetch quirk).
- [ ] Confirm `DATABASE_URL` points at **Supabase** (not a VPS Postgres).

**Verify:** Redeploy; backend logs show pg-boss start; browser login on staging FE succeeds; API calls from FE not CORS-blocked.

**Depends on:** Task 3.2.

### Task 3.4: Resource limits vs GST

- [ ] Keep compose `mem_limit` / `cpus` (or Coolify equivalents) so Flought + GST fit in 16GB:
  - Suggested starting point: backend 1.5–2GB, frontend 256MB; leave headroom for GST + OS.
- [ ] Do **not** run `npm run typecheck` on the server — build is `tsc` inside image build only.

**Verify:** `free -h` / Coolify metrics after both stacks up; no OOM kills.

**Depends on:** Task 3.3.

### Task 3.5: Staging smoke (API + workers + RAG notes)

- [ ] `GET /health` on staging API.
- [ ] Meta webhook **staging app** (optional): point a Meta test app to `https://api-staging…/webhooks/meta` with `META_VERIFY_TOKEN`.
- [ ] If RAG ingest is on branch: upload a small TXT in KB UI → watch Coolify logs for kb-ingest → `knowledge_documents.status = ready`.
- [ ] Quota / billing: skip live Razorpay on staging unless using test keys.

**Verify:** Staging green checklist in Phase 6.

**Depends on:** Task 3.4.

---

## Phase 4 — Keep / harden Vercel + Render path

No forced migration. Document and ensure env matrix clarity.

### Task 4.1: Document current cloud deploy

**Files:** keep `vercel.json`, `render.yaml`; optional comment-only edits

Current facts from repo:

- **Vercel:** SPA; `vercel.json` rewrites `/(.*)` → `/index.html`; long-cache `/assets/*`.
- **Render:** `render.yaml` — `type: web`, `env: node`, `rootDir: backend`, `buildCommand: npm install && npm run build`, `startCommand: npm start`, `NODE_VERSION=20.x`.

- [ ] **Step 1:** In Render Dashboard: set health check path to `/health` if not already.
- [ ] **Step 2:** Ensure Render env includes `DATABASE_URL`, `FRONTEND_URL` (production origins: `https://flought.com`, `https://www.flought.com`, preview if needed), and all Meta/Razorpay/OpenAI keys.
- [ ] **Step 3:** Vercel project env: `VITE_API_URL` → Render public URL (or custom API domain), plus Supabase + Meta app id.
- [ ] **Step 4:** Recommendation (locked): **Keep Render as native Node**. Do not switch `render.yaml` to Docker in this phase. Coolify uses Docker; cloud path stays simple.

**Verify:** Redeploy Render + Vercel; production login + one API call works.

**Depends on:** Phase 0 inventory.

### Task 4.2: CORS / VITE_API_URL matrix (both paths)

CORS allowlist today (`backend/src/index.ts`):

- Hardcoded: `http://localhost:5173`, `https://flought.com`, `https://www.flought.com`, `https://watsapp-saas.vercel.app`
- Plus any origin in `FRONTEND_URL` (comma-separated)
- Plus any `*.vercel.app` preview

| Path | FE origin | `VITE_API_URL` | `FRONTEND_URL` must include |
|------|-----------|----------------|-----------------------------|
| Local Vite | `http://localhost:5173` | `http://localhost:4000` | optional |
| Local Compose | `http://localhost:8080` | `http://localhost:4000` | `http://localhost:8080` |
| Vercel + Render | `https://flought.com` / `*.vercel.app` | Render URL | prod FE origins |
| Coolify staging | `https://app-staging…` | `https://api-staging…` | staging FE origin |
| Coolify prod (later) | `https://flought.com` | `https://api.flought.com` (example) | prod FE origins |

- [ ] When adding Coolify staging, **update Render `FRONTEND_URL` only if** staging FE must call production API (normally it should not — staging FE → staging API).

**Verify:** Browser network tab — no CORS errors on staging and prod.

**Depends on:** Task 4.1.

### Task 4.3: Commit cadence (docs / listen if not done)

- [ ] `docs(deploy): coolify dual-path plan` (this file — if not already committed)
- [ ] `fix(backend): bind 0.0.0.0` (if Phase 1.5 not committed yet)
- [ ] Avoid drive-by refactors of CORS to regex-everything — use `FRONTEND_URL`.

**Depends on:** Task 4.2.

---

## Phase 5 — Production cutover playbook (optional VPS primary)

Do this only after Coolify staging is green and Azure credit window / business timing says VPS primary. Keep Vercel+Render warm for 48h rollback.

### Task 5.1: Pre-cutover checklist

- [ ] Coolify **production** stack (or promote staging) with prod env + prod `VITE_*` bake.
- [ ] FE domain target decided: either move `flought.com` DNS to Coolify FE, or keep Vercel FE and only move API (hybrid). **Preferred simple cutover:** move both FE+API to Coolify (matches GST pattern). Hybrid (Vercel FE + Coolify API) also works if `VITE_API_URL` + CORS updated — document which you choose before DNS.
- [ ] Snapshot current Meta webhook URL and Render service URL.
- [ ] Confirm Supabase Auth redirect URLs include Coolify FE origin.

**Depends on:** Phase 3 staging green + Phase 4 cloud still healthy.

### Task 5.2: DNS flip

- [ ] Lower TTL ahead of time (e.g. 300s) if DNS host allows.
- [ ] Point `api.` (or chosen API host) A/CNAME → Coolify/VPS proxy.
- [ ] Point apex/`www` → Coolify FE (if moving FE).
- [ ] Wait for propagation; verify `https://api…/health`.

**Depends on:** Task 5.1.

### Task 5.3: Meta + other webhooks

- [ ] Meta Developer App → WhatsApp → Webhook → URL = `https://<NEW_API>/webhooks/meta`, verify token = `META_VERIFY_TOKEN`.
- [ ] Send test message; confirm Coolify backend logs `EVENT_RECEIVED` / inbound handling.
- [ ] Update Razorpay webhook URL to new API host.
- [ ] Remind tenants / update Settings-displayed Shopify webhook base via new `VITE_API_URL` (rebuild FE).

**Depends on:** Task 5.2.

### Task 5.4: Rollback (48h)

If errors spike:

- [ ] Re-point DNS to Vercel (FE) + Render (API).
- [ ] Re-point Meta webhook to previous Render URL.
- [ ] Confirm `/health` on Render; send WhatsApp test.

Keep Render + Vercel deployed (do not delete services) for ≥48h.

**Depends on:** Task 5.3.

### Task 5.5: Post-cutover monitoring

- [ ] Coolify logs: webhook 401s (signature), CORS errors, pg-boss errors, OOM.
- [ ] Supabase: auth success rate; `knowledge_documents` ingest if RAG live.
- [ ] Disk: 64GB SSD shared — watch Docker image churn + TTS temp files (`os.tmpdir()`).

**Depends on:** Task 5.3.

---

## Phase 6 — Verification checklist

### Task 6.1: Dual-path acceptance

- [ ] **Both paths documented** in this plan (Phases 3–4).
- [ ] **Compose up locally:** `docker compose up --build` → FE + `/health`.
- [ ] **Coolify staging green:** TLS, login, API call, CORS OK.
- [ ] **Cloud path still deployable:** Vercel + Render redeploy without Compose.
- [ ] **Webhook note:** Meta URL inventory + cutover steps exist (Phase 5).
- [ ] **RAG smoke (if ingest merged):** staging upload → ready; else mark N/A and point to RAG plan.
- [ ] **Quota/billing:** production Razorpay webhook host matches active API path.
- [ ] **ffmpeg:** `docker compose exec backend ffmpeg -version` succeeds on VPS path.

**Depends on:** Phases 1–4 (Phase 5 optional).

---

## Suggested commit cadence (summary)

| Commit | When |
|--------|------|
| `chore(deploy): backend Dockerfile + ffmpeg` | After Task 1.1 |
| `chore(deploy): frontend Nginx Dockerfile` | After Task 1.2 |
| `chore(deploy): docker-compose + env examples` | After Tasks 1.3–1.4 |
| `fix(backend): listen on 0.0.0.0` | After Task 1.5 |
| `docs(deploy): coolify dual-path plan` | This file |
| Ops-only | Coolify UI / DNS / Meta — no commit |

---

## Out of scope

- Moving Supabase Postgres / Auth / Storage / pgvector onto the VPS
- Separate Compose service for pg-boss workers (keep in-process)
- Switching Render to Docker runtime
- Kubernetes, Nomad, or multi-VPS HA
- Custom Nginx reverse-proxy for API on the FE container (use two Coolify domains)
- Rewriting RAG / hygiene plans
- Implementing Dockerfiles in the same PR as **this plan-only** delivery (agents executing later do Phase 1+)
- India-only / region lock assumptions
- Coolify “Dockerfile-only” single-service mode (we use Compose like GST)

---

## Gaps found in research (fix in Phase 0–1)

| Gap | Severity | Plan action |
|-----|----------|-------------|
| No `Dockerfile` / `docker-compose.yml` in repo | Blocker for VPS path | Phase 1 creates them |
| `app.listen(PORT)` without `'0.0.0.0'` | Medium for containers | Task 1.5 |
| `DATABASE_URL` required by `jobQueue.ts` but absent from `backend/.env.example` | High (misconfig risk) | Task 1.4 |
| No root FE `.env.example` for `VITE_*` | Medium | Task 1.4 |
| CORS does not auto-allow Coolify hosts | High if forgotten | Set `FRONTEND_URL` (Phase 3/4) |
| Backend `tenant.ts` reads `process.env.VITE_API_URL` | Medium quirk | Document; set on BE env |
| Health route **exists** (`GET /health`) | None | Use for Compose/Coolify/Render |
| ffmpeg not on Render native image | Low (TTS optional) | Install only in Docker backend image |
| Frontend source at **repo root**, not `frontend/` package | Context gotcha | Compose `context: .` + `-f frontend/Dockerfile` |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-25-coolify-dual-deploy.md`.

**When implementing:** use superpowers:subagent-driven-development (fresh subagent per task + review) or superpowers:executing-plans. Start at Phase 0 → Phase 1 Docker artifacts → local Compose → Coolify staging. Do not flip production DNS until Phase 3 staging is green.
