---
## Frontend Phase 2: E-Commerce & Shopify UI

**Date:** 2026-07-20
**Project:** Watsapp-Saas
**Branch:** main  |  **Commit:** uncommitted
**Type:** Feature

### Issue
- Symptom: N/A (Implementing Phase 2 of Frontend Architecture plan).
- Root cause: N/A
- How the root cause was confirmed: N/A

### Fix
- Built `ShopifyHub.tsx` to display Shopify integration status, a secure Webhook Secret viewer with copy functionality, and a Dead Letter Queue (DLQ) table to monitor background sync health.
- Built `CartRecovery.tsx` with React Query auto-polling (`refetchInterval: 30000`) to provide a live dashboard of Abandoned Carts pending, recovered, and total revenue recovered.
- Added necessary backend REST endpoints to `backend/src/routes/shopify.ts` (`GET /integration`, `GET /dlq`, `GET /carts/stats`) because the previous backend phase only built the webhook receivers, not the dashboard APIs.
- Updated `App.tsx` router and `Layout.tsx` (Desktop and Mobile) navigation sidebars to include links to the new Shopify Hub and Cart Recovery views with matching icons.

### Files Changed
- `src/pages/ShopifyHub.tsx` — Added — Dashboard for webhook setup and DLQ monitoring.
- `src/pages/CartRecovery.tsx` — Added — Live polling dashboard for abandoned cart stats.
- `src/App.tsx` — Modified — Added route definitions for `/ecommerce/shopify` and `/ecommerce/carts`.
- `src/components/DashboardLayout/DesktopLayout.tsx` — Modified — Added E-commerce navigation links to the desktop sidebar.
- `src/components/DashboardLayout/MobileLayout.tsx` — Modified — Added E-commerce navigation links to the mobile sidebar.
- `backend/src/routes/shopify.ts` — Modified — Implemented 3 new GET endpoints to serve data to the frontend dashboards.

```diff
+// GET Cart Recovery Stats
+router.get('/:tenantId/carts/stats', async (req: any, res: any) => {
+  const { tenantId } = req.params;
+  try {
+    const { data: carts, error } = await supabaseAdmin
+      .from('abandoned_carts')
+      .select('status, total_price, currency')
+      .eq('tenant_id', tenantId);
```

### Verification
- Code inspection verifies that the React Query keys correctly utilize the tenant ID.
- Verified fallback states in `ShopifyHub` to ensure the UI gracefully handles a missing integration (shows "Not Connected") rather than crashing.
- Ensured the mobile navigation links collapse correctly and map to the correct paths.

### Revert Instructions
- If not committed: `git checkout HEAD -- src/App.tsx src/components/DashboardLayout/DesktopLayout.tsx src/components/DashboardLayout/MobileLayout.tsx backend/src/routes/shopify.ts` and `rm src/pages/ShopifyHub.tsx src/pages/CartRecovery.tsx`

### Blast Radius
- `backend/src/routes/shopify.ts` changes are isolated strictly to GET routes for the new dashboard, avoiding disruption to the core `/webhook` handler.
- Routing changes in `App.tsx` are purely additive.

### Follow-up / Known Debt
- The DLQ currently returns an empty array. A true Dead Letter Queue mechanism (e.g., querying pg-boss archive or a dedicated `failed_events` table) needs to be integrated in a later infrastructure refinement phase.
---
