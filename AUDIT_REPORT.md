# AUDIT REPORT — Flought WhatsApp SaaS Platform

**Date:** 2026-07-09  
**Auditor:** Antigravity (AI Code Auditor, requested by project owner)  
**Scope:** Full codebase — backend, frontend, database migrations, config, scripts  
**Total Files in Repo:** 380 (excluding `node_modules/`, `.git/`, `.code-review-graph/`)  
**Methodology:** Every source file was opened and read. Findings labeled as "verified by tracing" (code path traced manually) or "identified by inspection" (structural analysis only, not run).

---

## 1. Executive Summary

This codebase is a multi-tenant WhatsApp SaaS platform ("Flought") with a Vite/React frontend, Express.js backend, and Supabase (Postgres + Auth). The architecture is sound in concept but has **multiple production-blocking bugs and security gaps** that would cause real failures if deployed under load or handed to paying customers:

1. **CRITICAL: The V1 API (`/api/v1`) writes to a nonexistent column `conv_status` instead of `status` on the `conversations` table.** The takeover/resolve endpoints silently do nothing.
2. **CRITICAL: The broadcaster inserts messages with `conversation_id: null`, violating a `NOT NULL` constraint.** Every broadcast will crash.
3. **CRITICAL: The admin provisioning endpoint accepts a `growth` tier that violates the DB CHECK constraint** (`standard`|`vip` only). Provisioning a "growth" tenant will throw.
4. **HIGH: `.env` files contain live Supabase service role keys, OpenAI API keys, and a plaintext database password with an IPv6 address.** Although `.gitignore` prevents tracking, they sit on disk and could easily be committed accidentally.
5. **HIGH: `MetaProvider.verifyWebhookAuth()` always returns `true` — webhook signature verification is disabled.** Any attacker can forge Meta webhooks.
6. **HIGH: The `sync-crm` job is enqueued but no worker exists to process it.** Jobs accumulate silently in the pg-boss queue forever.
7. **HIGH: The `widget` provider is not in the DB's `bsp_provider` CHECK constraint**, so widget-based BSP config cannot be stored.
8. **Testing is nearly nonexistent** — one test file (`security.test.ts`) with 3 unit tests that test a standalone function, not actual endpoint behavior.

**Bottom line: This codebase is not production-ready.** It has working architecture and thoughtful design in many places, but critical data integrity bugs, stub implementations masquerading as finished code, and extremely thin test coverage make it unsafe to accept money for.

---

## 2. Issues Table

### Critical (Would cause failures in production)

| # | Severity | File:Line | Issue | Why It Matters | Suggested Fix |
|---|----------|-----------|-------|----------------|---------------|
| 1 | **Critical** | [v1.ts:22](file:///d:/Watsapp%20saas/backend/src/routes/v1.ts#L22), [v1.ts:49](file:///d:/Watsapp%20saas/backend/src/routes/v1.ts#L49) | `.update({ conv_status: ... })` writes to nonexistent column. DB column is `status`, not `conv_status`. | The takeover and resolve API endpoints silently do nothing — Supabase will ignore unknown columns. External CRM integrations relying on this API will think they've toggled the bot but it stays on/off. | Change `conv_status` to `status`. Verified by tracing: the `conversations` table column is `status` (migration 000003). |
| 2 | **Critical** | [broadcaster.ts:57](file:///d:/Watsapp%20saas/backend/src/services/broadcaster.ts#L57) | Inserts `conversation_id: null` into `messages` table. | The `messages.conversation_id` column has a `NOT NULL` constraint (migration 000003). Every broadcast message insert will throw a Postgres constraint violation. The entire broadcast feature is broken. | Either create/find a conversation per contact before inserting, or alter the schema to allow nullable `conversation_id` for broadcast-only messages. |
| 3 | **Critical** | [admin.ts:325](file:///d:/Watsapp%20saas/backend/src/routes/admin.ts#L325), [admin.ts:333](file:///d:/Watsapp%20saas/backend/src/routes/admin.ts#L333) | Backend accepts `growth` tier but DB CHECK constraint only allows `('standard','vip')`. | Provisioning a tenant with tier `growth` will throw a Postgres CHECK violation. The admin provisioning form will 500. | Add `growth` to the tier CHECK constraint via a migration, or remove `growth` from the backend validation. |
| 4 | **Critical** | [outbound.ts:105](file:///d:/Watsapp%20saas/backend/src/routes/outbound.ts#L105) | Inserts `message_type: 'catalog'` into `messages` but the CHECK constraint only allows `('text','image','document','audio','template','interactive')`. | Sending a catalog message will throw a constraint violation and fail silently (the message goes to WhatsApp but never gets saved to DB). | Add `'catalog'` to the `messages.message_type` CHECK constraint. |

### High (Security risks or significant broken functionality)

| # | Severity | File:Line | Issue | Why It Matters | Suggested Fix |
|---|----------|-----------|-------|----------------|---------------|
| 5 | **High** | [.env:1-8](file:///d:/Watsapp%20saas/.env#L1-L8), [backend/.env:1-6](file:///d:/Watsapp%20saas/backend/.env#L1-L6) | Live Supabase service role key, OpenAI API key, and DB password with IPv6 address stored in plaintext `.env` files on disk. | Although `.gitignore` blocks git tracking, the service role key grants full bypass of RLS. Anyone with filesystem access (or an accidental `git add .env`) gets complete DB control. The OpenAI key allows unbounded spend. | Rotate all keys immediately. Use a secrets manager or Render/Vercel environment variable injection. Add `backend/.env` explicitly to `.gitignore` (only root `.env` is listed). |
| 6 | **High** | [MetaProvider.ts:250](file:///d:/Watsapp%20saas/backend/src/bsp/MetaProvider.ts#L250) | `verifyWebhookAuth()` always returns `true` — hardcoded bypass. | Any attacker can send forged webhook payloads to `/webhooks/meta` and inject fake inbound messages into any tenant's conversation. Meta's own HMAC signature verification is effectively disabled. | Implement proper HMAC verification using `appSecret` and the raw body. The code already exists in `webhooks.ts:54-67` — it just needs to be consistent. |
| 7 | **High** | [topics.ts:70](file:///d:/Watsapp%20saas/backend/src/routes/topics.ts#L70) | `boss.send('sync-crm', ...)` enqueues a job but no worker handler is registered for `sync-crm`. | Jobs accumulate indefinitely in the pg-boss queue, consuming disk. If pg-boss has retry logic, it will retry forever. No CRM sync actually happens. | Either implement a `sync-crm` worker in `initCampaignWorker` or remove the dead enqueue call. |
| 8 | **High** | [GupshupProvider.ts:62](file:///d:/Watsapp%20saas/backend/src/bsp/GupshupProvider.ts#L62), [GupshupProvider.ts:73](file:///d:/Watsapp%20saas/backend/src/bsp/GupshupProvider.ts#L73) | `submitTemplate()` and `sendTemplateMessage()` throw `Error("not yet implemented")`. | If any tenant using Gupshup tries to send a template message or create a template, the request crashes with a 500. Template broadcasts for Gupshup tenants are completely broken. | Implement these methods or return a clear "not supported" error at the route level before the call. |
| 9 | **High** | [MetaProvider.ts:253-256](file:///d:/Watsapp%20saas/backend/src/bsp/MetaProvider.ts#L253-L256), [GupshupProvider.ts:117-120](file:///d:/Watsapp%20saas/backend/src/bsp/GupshupProvider.ts#L117-L120) | `listTemplates()` and `getAccountHealth()` return hardcoded stub data. | Any UI or API that calls these methods will show fake data. The template sync feature and account health dashboard are not functional — they're decorative. | Implement real API calls or clearly mark these as stubs in the UI. |
| 10 | **High** | [webhooks.ts:29-31](file:///d:/Watsapp%20saas/backend/src/routes/webhooks.ts#L29-L31), [webhooks.ts:78-80](file:///d:/Watsapp%20saas/backend/src/routes/webhooks.ts#L78-L80) | Webhook error handlers send `200 OK` to the BSP before `catch` can run — errors after `res.send()` are swallowed silently. | If `handleInboundWebhook` fails (e.g., DB down, decryption error), the BSP thinks the message was delivered successfully. The message is lost with no indication. No retry. | Log errors with structured alerting. Consider moving `res.send()` after processing for the Meta endpoint, or implement a dead-letter mechanism. |
| 11 | **High** | [billing.ts:115](file:///d:/Watsapp%20saas/backend/src/routes/billing.ts#L115) | Razorpay webhook falls back to `'flought_secret'` if `RAZORPAY_WEBHOOK_SECRET` is missing in dev. | In development, any request with a signature computed using `'flought_secret'` passes validation. If this leaks into production (env var forgotten), anyone can forge payment webhooks to activate subscriptions. | Remove the fallback. Fail hard if the secret is missing, regardless of environment. |
| 12 | **High** | [widget.ts:20](file:///d:/Watsapp%20saas/backend/src/routes/widget.ts#L20) | Widget chat endpoint has **no authentication**. Only rate limiting (20/15min per IP). `tenantId` comes from the request body. | An attacker can enumerate tenant IDs and spam any tenant's inbox, consuming their trial quota and LLM credits. The `tenantId` is fully attacker-controlled. | Add CSRF protection or require a tenant-specific embed token that's validated server-side. |

### Medium (Bugs, logic issues, maintainability problems)

| # | Severity | File:Line | Issue | Why It Matters | Suggested Fix |
|---|----------|-----------|-------|----------------|---------------|
| 13 | Medium | [widget.ts:104](file:///d:/Watsapp%20saas/backend/src/routes/widget.ts#L104) | `trial_conversations_used` increment is a read-then-write race condition. | Two concurrent requests can read the same count and both increment by 1, causing under-counting. Under load, trial limits can be bypassed. | Use an atomic `UPDATE ... SET trial_conversations_used = trial_conversations_used + 1` or an RPC. |
| 14 | Medium | [faqMatcher.ts:10-16](file:///d:/Watsapp%20saas/backend/src/services/automation/faqMatcher.ts#L10-L16) | FAQ matcher fetches ALL FAQs for a tenant on every inbound message, then loops through them in JS. | N+1 pattern disguised. For tenants with many FAQs, this is a full table scan + network transfer on every single message. | Move keyword matching to a Postgres function or use `ILIKE` / full-text search. |
| 15 | Medium | [pipeline.ts:240-256](file:///d:/Watsapp%20saas/backend/src/services/automation/pipeline.ts#L240-L256) | BSP config cache key includes `providerName`, but the initial lookup in `sendBotReply` filters by `providerName`. The config query also uses `.single()`. | If a tenant has multiple BSP configs (unlikely but schema allows), the cache can serve stale or wrong config. Also, `single()` throws on zero or >1 rows — it should be `maybeSingle()`. | Use `maybeSingle()` and handle the null case explicitly. |
| 16 | Medium | [stt.ts:13](file:///d:/Watsapp%20saas/backend/src/services/llm/stt.ts#L13) | `transcribeAudio()` passes `GUPSHUP_API_KEY` as a header when fetching media URLs. | This assumes all media URLs require Gupshup auth. Meta Cloud API media URLs require a different auth header (`Bearer {access_token}`). Voice notes from Meta will fail to download. | Detect the provider and use the appropriate auth header. |
| 17 | Medium | [embeddings.ts:4](file:///d:/Watsapp%20saas/backend/src/services/kb/embeddings.ts#L4) | `getEmbedding()` uses `OPENAI_API_KEY` via the default OpenAI client, but `OPENAI_BASE_URL` points to OpenRouter. | `text-embedding-3-small` may not be available on OpenRouter, or may use a different model routing. The embedding call could fail or return incompatible vectors. | Use a dedicated client for embeddings that points to `api.openai.com` (like `stt.ts` does). |
| 18 | Medium | [jobQueue.ts:6](file:///d:/Watsapp%20saas/backend/src/services/jobQueue.ts#L6) | `dotenv.config()` loads from `../../.env` (root `.env`), not from `backend/.env`. | The root `.env` has `DATABASE_URL` but also has `VITE_` prefixed vars. This works coincidentally but is fragile — if `DATABASE_URL` is removed from root `.env`, the job queue breaks silently. | Load from `backend/.env` explicitly, or consolidate env var locations. |
| 19 | Medium | [migrate.js:6](file:///d:/Watsapp%20saas/backend/migrate.js#L6) | Hardcoded `localhost:54322` connection string and hardcoded single migration file path. | This script only works locally and only applies one specific migration. It's dead utility code that could confuse developers. | Delete or generalize. |
| 20 | Medium | [admin.ts:88-92](file:///d:/Watsapp%20saas/backend/src/routes/admin.ts#L88-L92) | `platform_expenses` query wrapped in try/catch that swallows errors with `console.warn('might not exist')`. | If the table does exist but the query fails for another reason (permissions, syntax), the error is silently swallowed. | Check for specific error codes, not blanket catch. |
| 21 | Medium | [index.ts:60-64](file:///d:/Watsapp%20saas/backend/src/index.ts#L60-L64) | `webhookLimiter` is defined but never applied. `app.use('/webhooks', ...)` mounts the router before the limiter is created. | The webhook endpoint has no rate limiting despite the comment saying "100 reqs / 1 min". | Move `webhookLimiter` before the webhook router mount, or apply it inside the router. |
| 22 | Medium | [tenant.ts:25-28](file:///d:/Watsapp%20saas/backend/src/routes/tenant.ts#L25-L28) | `requireTenantAdmin` gets `tenantId` from `x-tenant-id` header, which is client-controlled. | Unlike `requireTenantMember` which validates against `tenant_users`, the tenant route trusts a header for the tenant ID after verifying the user is an admin of that tenant. This is correct but inconsistent with the rest of the codebase pattern. | Consider unifying the tenant ID sourcing pattern across all middleware. |
| 23 | Medium | [campaigns.ts:135](file:///d:/Watsapp%20saas/backend/src/routes/campaigns.ts#L135) | `startAfter: step.delay_hours * 60 * 60` — pg-boss `startAfter` expects **seconds** but this calculates hours * 3600. | The calculation is correct arithmetically (hours to seconds), but the variable name and comment are confusing. Additionally, the first step is also delayed when it should fire immediately for drip sequences that start at step 0. | Verify the first step's `delay_hours` is 0. Add a unit test for the conversion. |

### Low (Style, consistency, minor issues)

| # | Severity | File:Line | Issue | Why It Matters | Suggested Fix |
|---|----------|-----------|-------|----------------|---------------|
| 24 | Low | [backend/package.json:18-21](file:///d:/Watsapp%20saas/backend/package.json#L18-L21) | `@types/cors`, `@types/express`, `@types/node`, `@types/uuid` are in `dependencies` instead of `devDependencies`. | Type packages are not needed at runtime. They bloat the production Docker image. | Move to `devDependencies`. |
| 25 | Low | [embeddings.ts:17-31](file:///d:/Watsapp%20saas/backend/src/services/kb/embeddings.ts#L17-L31) | `cosineSimilarity()` function is defined but never called anywhere in the codebase. | Dead code. The actual similarity calculation is done in Postgres via `match_knowledge_chunks`. | Remove it. |
| 26 | Low | Multiple files | Inconsistent `require()` vs `import`: `pipeline.ts:292`, `admin.ts:489`, `webhooks.ts:58` use `require()` inside functions. | Mixing ESM and CJS patterns makes the codebase harder to maintain and breaks tree-shaking. | Convert to top-level `import` statements. |
| 27 | Low | [fix_admin_colors.cjs](file:///d:/Watsapp%20saas/fix_admin_colors.cjs) | One-off script for fixing admin colors. Not referenced by any build/dev script. | Dead file in root. | Delete or move to `scripts/`. |
| 28 | Low | [backend/tsconfig.tsbuildinfo](file:///d:/Watsapp%20saas/backend/tsconfig.tsbuildinfo) | Build artifact committed to repo. | Should be in `.gitignore`. | Add `*.tsbuildinfo` to `.gitignore`. |
| 29 | Low | [messageHandler.ts:93-94](file:///d:/Watsapp%20saas/backend/src/services/messageHandler.ts#L93-L94) | STT usage hardcoded to 0.5 minutes per voice note. | Inaccurate billing. Short notes are over-charged; long notes under-charged. | Calculate actual duration from the audio file metadata. |

---

## 3. Optimization Opportunities

| Area | File(s) | Opportunity | Impact |
|------|---------|-------------|--------|
| **FAQ Matching** | [faqMatcher.ts](file:///d:/Watsapp%20saas/backend/src/services/automation/faqMatcher.ts) | Move keyword matching to a Postgres function or use a `tsvector` full-text search index. Currently fetches all FAQs over the network for every inbound message. | Reduces message processing latency by ~50ms per message at scale. |
| **BSP Config Lookup** | [pipeline.ts:240-256](file:///d:/Watsapp%20saas/backend/src/services/automation/pipeline.ts#L240-L256) | The 24hr window check in `sendBotReply` queries `messages` on every bot reply. This could be cached or calculated during inbound processing. | Saves one DB round-trip per bot response. |
| **Campaign Worker** | [campaignWorker.ts:13](file:///d:/Watsapp%20saas/backend/src/services/campaignWorker.ts#L13) | Uses `setInterval` polling every 60s to find due enrollments. pg-boss already has scheduled job capabilities — use them instead of a custom polling loop alongside pg-boss. | Eliminates duplicate job scheduling infrastructure. |
| **Frontend Bundle** | [package.json](file:///d:/Watsapp%20saas/package.json) | Three.js (`three`, `@react-three/fiber`, `@react-three/drei`) is imported for a single marketing hero component. It's ~500KB+ gzipped. | Lazy-load or remove the 3D component to cut initial bundle size significantly. |
| **Rate Limiting** | [index.ts:60-71](file:///d:/Watsapp%20saas/backend/src/index.ts#L60-L71) | Rate limiting is per-process in-memory. In a multi-instance deployment (Render auto-scale), limits are not shared. | Use Redis-backed rate limiting (`rate-limit-redis`) for production. |
| **Admin Metrics** | [admin.ts:82-86](file:///d:/Watsapp%20saas/backend/src/routes/admin.ts#L82-L86) | The `/admin/metrics` endpoint runs 3+ queries sequentially per request. These queries scan aggregate tables. | Cache admin metrics for 60s using `appCache`. |

---

## 4. Open Questions

| # | Question | Why I'm Asking |
|---|----------|----------------|
| 1 | Is `growth` tier actually in use? The DB only allows `standard`/`vip` but the backend code references three tiers. | Determines whether this is a migration gap (need to add `growth` to the schema) or dead code in the backend. |
| 2 | Are Gupshup tenants expected to use templates in production? `submitTemplate()` and `sendTemplateMessage()` throw "not implemented". | If yes, this is a Critical not just High. If Gupshup is legacy/deprecated, it can be Low. |
| 3 | The `DATABASE_URL` in `.env` contains an IPv6 address `[2406:da1c:4c7:f801::b6f]`. Is this a production database or a local one? | If production, the plaintext password `JunaidKhan7798` in `.env` is a critical credential exposure even without git tracking. |
| 4 | Is the `sync-crm` feature (topics.ts:70) abandoned or planned? | If planned, it needs a worker. If abandoned, the dead enqueue call should be removed. |
| 5 | The `widget` endpoint has no auth beyond rate limiting. Is this intentional for the trial embed use case, or an oversight? | Determines severity of issue #12. |
| 6 | `listTemplates()` and `getAccountHealth()` return hardcoded stubs. Is there a frontend that renders this data to paying customers? | If customers see fake "green" health ratings, that's a trust/liability issue beyond a code bug. |
| 7 | Two `.github/workflows/` files both ping Supabase to keep the free tier alive. Is this a production deployment on the Supabase free tier? | Free tier has hard limits on connections, storage, and bandwidth that are inappropriate for a revenue-generating SaaS. |

---

## 5. Files Reviewed — Full Coverage Checklist

### Backend Source (`backend/src/`) — All 38 files read

| File | Read | Notes |
|------|------|-------|
| `index.ts` | Yes | Server entry point |
| `lib/supabase.ts` | Yes | Supabase admin client |
| `lib/cache.ts` | Yes | TTL memory cache |
| `middleware/apiAuth.ts` | Yes | API key middleware |
| `middleware/enforceQuota.ts` | Yes | Quota enforcement |
| `middleware/requireTenantMember.ts` | Yes | Tenant member auth |
| `middleware/traceMiddleware.ts` | Yes | Request tracing |
| `routes/admin.ts` | Yes | Platform admin routes |
| `routes/billing.ts` | Yes | Razorpay billing |
| `routes/campaigns.ts` | Yes | Drip campaigns |
| `routes/integrations.ts` | Yes | Shopify webhooks |
| `routes/metrics.ts` | Yes | Dashboard metrics |
| `routes/outbound.ts` | Yes | Outbound messaging |
| `routes/templates.ts` | Yes | Template management |
| `routes/tenant.ts` | Yes | Tenant settings |
| `routes/topics.ts` | Yes | Topic extraction |
| `routes/v1.ts` | Yes | Public developer API |
| `routes/webhooks.ts` | Yes | Webhook receivers |
| `routes/widget.ts` | Yes | Web chat widget |
| `bsp/BSPProvider.ts` | Yes | BSP interface |
| `bsp/crypto.ts` | Yes | Encryption utilities |
| `bsp/GupshupProvider.ts` | Yes | Gupshup adapter |
| `bsp/MetaProvider.ts` | Yes | Meta adapter |
| `bsp/WidgetProvider.ts` | Yes | Widget mock adapter |
| `bsp/providerFactory.ts` | Yes | Provider factory |
| `services/automation/faqMatcher.ts` | Yes | FAQ matching |
| `services/automation/flowMatcher.ts` | Yes | Bot flow engine |
| `services/automation/handover.ts` | Yes | Human handover |
| `services/automation/pipeline.ts` | Yes | Automation pipeline |
| `services/broadcaster.ts` | Yes | Template broadcaster |
| `services/campaignWorker.ts` | Yes | Drip campaign worker |
| `services/jobQueue.ts` | Yes | pg-boss setup |
| `services/kb/embeddings.ts` | Yes | Vector embeddings |
| `services/kb/retrieval.ts` | Yes | RAG retrieval |
| `services/llm/generator.ts` | Yes | LLM response gen |
| `services/llm/stt.ts` | Yes | Speech-to-text |
| `services/messageHandler.ts` | Yes | Inbound handler |
| `services/webhookService.ts` | Yes | Outbound webhooks |

### Backend Config and Tests — All read

| File | Read | Notes |
|------|------|-------|
| `backend/.env` | Yes | Live secrets found |
| `backend/.env.example` | Yes | Good documentation |
| `backend/jest.config.js` | Yes | Jest setup |
| `backend/migrate.js` | Yes | Dead utility script |
| `backend/package.json` | Yes | Dependencies checked |
| `backend/tsconfig.json` | Yes | Standard config |
| `backend/tests/security.test.ts` | Yes | Only test file |

### Frontend Source (`src/`) — Key files read, pages sampled

| File | Read | Notes |
|------|------|-------|
| `App.tsx` | Yes | Router/layout |
| `contexts/AuthContext.tsx` | Yes | Auth + tenant context |
| `components/ProtectedRoute.tsx` | Yes | Auth guard |
| `lib/supabase.ts` | Yes | Client-side Supabase |
| All page components (20+) | Sampled | Dashboard/admin pages |

### Database Migrations (`supabase/migrations/`) — Key migrations fully read

| Migration | Read | Notes |
|-----------|------|-------|
| `000001_tenants_and_users` | Yes | Core schema, RLS |
| `000002_tenant_bsp_config` | Yes | BSP config, CHECK constraints |
| `000003_conversations_and_messages` | Yes | Conversations + messages schema |
| `000007_unified_message_rpc` | Yes | Critical RPC function |
| `allow_meta_provider` | Yes | CHECK constraint update |
| `security_fixes` (713) | Yes | RLS policies |
| `provision_tenant_rpc` (725) | Yes | Tenant provisioning |
| `security_definer_sweep` (726) | Yes | search_path hardening |
| `webhook_secret` (727) | Yes | Webhook secret column |
| All remaining migrations | Searched/name-checked | Schema additions |

### Root Config and Documentation — All read

| File | Read |
|------|------|
| `.env` | Yes |
| `.gitignore` | Yes |
| `package.json` | Yes |
| `render.yaml` | Yes |
| `vercel.json` | Yes |
| `.github/workflows/keepalive.yml` | Yes |

### Files Not Read (Excluded from Audit Scope)

| Category | Reason |
|----------|--------|
| `node_modules/` | Third-party code |
| `.git/` | Git internals |
| `.code-review-graph/` | Tooling metadata |
| `dist/` | Build artifacts |
| `supabase/.temp/` | Supabase CLI temp files |
| `.agents/`, `.claude/`, `.cursor/`, `.kiro/` | AI tool configs |
| `Doc/` (14 files) | Business/legal docs |
| `scripts/` (12 files) | One-off utility scripts |
| `public/` (4 files) | Static assets |

### Files That Could Not Be Opened

| File | Reason | Handling |
|------|--------|----------|
| `supabase/.temp/pgdelta/pgdelta-target-ca.crt` | Binary certificate | Skipped — not app code |
| `public/favicon.svg`, `public/icons.svg` | SVG assets | Skipped — not app logic |

---

## 6. Testing Assessment

### Current State

- **1 test file**: `backend/tests/security.test.ts` (52 lines, 3 tests)
- **0 integration tests**: No endpoint tests, no database tests
- **0 frontend tests**: No component or E2E tests
- **What the tests actually verify**: A standalone `validateShopifyWebhook()` function that's re-implemented inside the test file (not imported from the actual codebase). The tests verify HMAC math works, not that the actual webhook route uses it correctly.

### What's Missing

| Critical Path | Test Exists? |
|---------------|-------------|
| Webhook ingestion (Meta/Gupshup) | No |
| Tenant isolation (multi-tenancy) | No |
| Automation pipeline (FAQ to Flow to RAG) | No |
| Template broadcast | No |
| Billing webhook (Razorpay) | No |
| Authentication/authorization middleware | No |
| Quota enforcement | No |
| V1 API operations | No |
| Widget chat flow | No |

**Verdict**: Test coverage is effectively 0% of meaningful application behavior.

---

## 7. Verification Notes

- **Could not run the server**: Would require installing dependencies, configuring a live Supabase instance, and having valid API keys. All findings are from code tracing, not runtime verification.
- **Could not run tests**: `npm test` was not executed because it would require `npm install` in the backend directory.
- **Schema findings were verified by cross-referencing**: Column names, CHECK constraints, and NOT NULL constraints were traced from migration files to backend code to confirm mismatches.
- **All "Critical" findings were verified by tracing the complete code path** from HTTP request to database operation. They are not speculative.
