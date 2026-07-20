---
## Marketing & Webhooks Foundation (Phase 1)

**Date:** 2026-07-20
**Project:** Flought SaaS
**Branch:** main  |  **Commit:** uncommitted
**Type:** Feature

### Issue
- Symptom: Flought lacked outbound marketing capabilities (Broadcasts, Segmenting, CRM webhooks), preventing it from functioning as a Revenue Generation engine.
- Root cause: Missing underlying database schema, worker logic, and API endpoints for large-scale message fan-out and Zapier/Make integrations.
- How the root cause was confirmed: Identified during competitor research phase ("20 missing features").

### Fix
- Implemented `broadcasts`, `webhook_subscriptions`, and `contacts.attributes` in the database.
- Built a `pg-boss` based background worker to chunk large audience broadcasts into individual Meta API calls with safe concurrency limits (50 workers max).
- Built an audience segmentation module that dynamically matches tags and JSONB attributes.
- Built a bulk CSV contact ingestion API route.
- Expanded the outbound webhook service to fire multiple requests for active Zapier/Make subscriptions.

### Files Changed
- `supabase/migrations/20260721000000_marketing_phase_1.sql` — Added — Schema for broadcasts, webhook subscriptions, and audience RPC.
- `backend/src/services/marketing/segmentation.ts` — Added — Logic to filter audience by tags and attributes.
- `backend/src/services/marketing/broadcastWorker.ts` — Added — `pg-boss` workers to safely fan-out 10,000+ messages without hitting rate limits.
- `backend/src/routes/marketing.ts` — Added — API endpoints for CSV bulk uploads and triggering broadcasts.
- `backend/src/index.ts` — Modified — Mounted the new router and initialized the worker.
- `backend/src/services/webhookService.ts` — Modified — Updated loop to iterate through multiple subscribed URLs (Zapier/Make support).

### Verification
- `npm run build` completed successfully without TypeScript errors.
- Code logically verified for SSRF bypasses and rate limit handling.
- Not independently tested with a running database (assumed, not tested).

### Revert Instructions
- Delete the 4 new files listed above.
- Revert changes to `backend/src/index.ts` and `backend/src/services/webhookService.ts` using `git checkout`.

### Blast Radius
- `pg-boss` queue traffic will increase when tenants start broadcasting.
- Contacts table size will grow rapidly via CSV uploads.
- Outbound network traffic will increase due to Zapier/Make webhooks firing on events.

### Follow-up / Known Debt
- Drip Campaigns (Feature 4) still requires the trigger/state-machine logic to be connected to the newly found `drip_campaigns` tables. (Will address in future passes or Phase 3).
- The `increment_broadcast_success` logic assumes one-way sends; we may need delivery receipt webhooks for 100% accurate metrics later.
---
