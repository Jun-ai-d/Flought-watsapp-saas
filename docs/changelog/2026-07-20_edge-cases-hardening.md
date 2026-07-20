---
## Edge Case Hardening (Phases 1-4)

**Date:** 2026-07-20
**Project:** Flought SaaS
**Branch:** main  |  **Commit:** uncommitted
**Type:** Bug fix / Refactor

### Issue
- Symptom: Potential crashes, infinite loops, and degraded performance observed during code review of the integrations from Phases 1 through 4.
- Root cause: Webhook service iterated sequentially and ignored Promise states. Shopify queue jobs ran synchronously after an HTTP response without a catch block. SLA worker lacked a state machine for tracking breach status. The public Widget API lacked rate limiting. Flow engine lacked try/catch boundaries for action logic.
- How the root cause was confirmed: Suspected cause confirmed via static analysis of the codebase during the Phase 1-4 Edge Case Audit.

### Fix
- `webhookService.ts`: Pushed outbound HTTP fetch promises into an array and used `Promise.allSettled()` to allow concurrent execution without blocking subsequent tenants in the loop.
- `shopify.ts`: Detached the background processing inside an IIFE `(async () => {...})().catch(...)` after returning `200 OK` to Shopify, preventing queue errors from triggering unhandled promise rejections.
- `slaWorker.ts`: Added a `sla_breached` boolean to the `conversations` table. The worker now checks this flag and flips it to `true` upon the first escalation, preventing infinite loops.
- `growth.ts`: Added `express-rate-limit` to the `/api/growth/widget` endpoint to prevent database connection exhaustion from public traffic.
- `flowEngine.ts`: Wrapped the `evaluateNode` function body in a `try/catch` block that returns a fallback `{ nextHandle: 'error' }` instead of crashing the execution loop.

### Files Changed
- `backend/src/services/webhookService.ts` — Modified — Converted sequential webhook dispatch to concurrent `Promise.allSettled()`.
- `backend/src/routes/shopify.ts` — Modified — Detached post-response async logic into an IIFE with explicit catch.
- `supabase/migrations/20260721000004_sla_hardening.sql` — Added — Added `sla_breached` column to `conversations`.
- `backend/src/services/automation/slaWorker.ts` — Modified — Check and update the `sla_breached` flag.
- `backend/src/routes/growth.ts` — Modified — Added `express-rate-limit` to public widget route.
- `backend/src/services/automation/flowEngine.ts` — Modified — Added `try/catch` boundary to action evaluation.

### Verification
- Ran `npm run build` which passed without typescript compilation errors.
- Webhook latency, Shopify queue dispatching, SLA looping behavior, and rate limiting were not independently tested with a running server and load generator (assumed, not tested).

### Revert Instructions
- Delete the SQL migration file `supabase/migrations/20260721000004_sla_hardening.sql`.
- Run `git checkout -- backend/src/services/webhookService.ts backend/src/routes/shopify.ts backend/src/services/automation/slaWorker.ts backend/src/routes/growth.ts backend/src/services/automation/flowEngine.ts` to restore the pre-hardened code.

### Blast Radius
- The rate limit on the widget API is set to 100 requests per minute per IP. Legitimate highly-trafficked SPAs that batch requests from a single corporate IP might encounter 429s.
- Adding the `sla_breached` column might require a DB migration lock on the `conversations` table, affecting writes briefly during deployment.

### Follow-up / Known Debt
- Need to ensure `sla_breached` is reset if the conversation is resolved and then re-opened in the future. Currently, it triggers once per conversation lifetime.
---
