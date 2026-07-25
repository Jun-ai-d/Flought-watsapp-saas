# Fix Hygiene + Pre-existing Bugs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear commit-blocking hygiene, then fix four evidenced production bugs (widget auth, BSP default, SLA, multi-tenant auth).

**Architecture:** Keep changes minimal (Ponytail). No new abstractions. Align frontend with existing `widget_tokens` + `rotate_widget_token`. Schedule SLA checks from `triggerHandover`. Prefer first/stored membership instead of `.single()`.

**Tech Stack:** React/Vite frontend, Express backend, Supabase Postgres RPCs, pg-boss.

---

## File map

| File | Change |
|------|--------|
| `src/pages/WidgetConfigurator.tsx` | Leading space; use `widget_tokens` + RPC |
| `src/components/WebChatWidget.tsx` | Send `widget_token` (not trusted `tenantId`) |
| `package.json` / `package-lock.json` | Remove unused PGlite deps |
| Throwaway scripts/dumps | Delete |
| `backend/src/services/campaignWorker.ts` | Default provider `meta` |
| `backend/src/services/automation/slaWorker.ts` | Status enum + createQueue |
| `backend/src/services/automation/handover.ts` | Enqueue SLA job (15m) |
| `src/contexts/AuthContext.tsx` | Multi-membership safe load + switch |
| `supabase/migrations/YYYYMMDD_harden_rotate_widget_token.sql` | Admin check inside RPC |

---

## Phase A — Hygiene (first 3)

### Task A1: WidgetConfigurator leading space

- [x] Remove leading space on line 1 `import React...`

### Task A2: Remove unused PGlite dependencies

- [x] Remove `@electric-sql/pglite` and `pg-query-emscripten` from `package.json` (scripts deleted → deps unused)
- [x] Run `npm install` to refresh lockfile

### Task A3: Delete throwaway audit artifacts

- [x] Delete: `check_migrations.cjs`, `check_tenant_id.cjs`, `extract_functions.cjs`, `functions.txt`, `tenant_ids.txt`, `test.cjs`, `test.js`, `test_pglite.mjs` … `test_pglite7.mjs`

---

## Phase B — Pre-existing (remaining 4)

### Task B1: Widget token alignment

**Problem:** UI reads/writes nonexistent `tenants.widget_token` with weak `Math.random()`. Backend `/api/widget/chat` requires `widget_tokens.token`. Preview `WebChatWidget` still posts `tenantId`.

**Fix:**
- [x] Load: `widget_tokens.token` + `tenants.business_name`
- [x] Rotate: `supabase.rpc('rotate_widget_token', { p_tenant_id })`
- [x] Migration: harden RPC with `is_tenant_admin(p_tenant_id)` check
- [x] `WebChatWidget`: accept `widgetToken` prop; POST `widget_token` + `sessionId` + `text`

### Task B2: campaignWorker BSP default

- [x] Change `config.bsp_provider || 'gupshup'` → `|| 'meta'`
- [x] If no config / unknown provider: log and skip send (do not throw whole worker)

### Task B3: SLA worker status + enqueue

- [x] Treat open handovers as: `status IN ('handover_pending','handover_active')` (not `!== 'closed'`)
- [x] `createQueue('check-sla-breach')` on init
- [x] From `triggerHandover` after successful update: `boss.send(..., { startAfter: 15 * 60 })`
- [x] Reset `sla_breached: false` when entering handover so timer is fresh

### Task B4: AuthContext multi-tenant

- [x] Fetch all memberships (no `.single()`)
- [x] Prefer `localStorage.flought_active_tenant_id` if still a member; else first row
- [x] Expose `tenants: TenantContext[]` + `switchTenant(id)` for future UI; keep `tenant` as active

---

## Verification

- [x] Backend `tsc --noEmit` clean
- [ ] Apply migration `20260725000001_harden_rotate_widget_token.sql` to Supabase (manual / `supabase db push`)
- [ ] Manually: Widget page loads token / rotate works; drip worker with meta-only config; handover schedules SLA; user with 2 memberships loads without error

## Out of scope

- Full tenant-switcher UI in sidebar
- Removing Gupshup options from AdminTenants (separate cleanup)
- Rewriting PGlite harnesses
