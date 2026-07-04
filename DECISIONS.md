# Flought — Architecture & Design Decisions Log

> Decisions made during implementation that aren't covered by the source-of-truth documents in `Doc/`. Each entry captures the decision, alternatives considered, rationale, and which document (if any) informed it.

---

## ADR-001: Treat `flought-bsp-abstraction-layer.md` as authoritative over `bsp-abstraction-layer.md`

**Date:** 2026-07-04
**Status:** Accepted
**Phase:** Planning

**Context:** Two BSP abstraction documents exist in `Doc/`. They overlap but diverge on interface shape:
- `bsp-abstraction-layer.md` — single `sendMessage()` method, simpler types
- `flought-bsp-abstraction-layer.md` — separate `sendSessionMessage()` / `sendTemplateMessage()`, richer types, more methods

**Decision:** Use `flought-bsp-abstraction-layer.md` as authoritative.

**Rationale:**
- Named consistently with all other `flought-` prefixed documents
- Referenced by the PRD's traceability section (§10)
- The richer interface (separate session/template methods) maps better to the TRD's requirement that templates carry correct category at the API call level (TRD §4)

**Alternatives considered:** Merge both into a single canonical doc. Rejected because modifying source docs is outside scope — we build to what's written, and flag conflicts.

---

## ADR-002: Frontend framework — Vite + React (not Next.js, not Lovable)

**Date:** 2026-07-04
**Status:** Accepted (Resolved OQ-1)

**Context:** PRD §7 and TRD §8 specify "Frontend: built in Lovable." Since we're building in code, we need a concrete framework. The app is a dashboard (mostly client-side) with a public landing page.

**Decision:** Vite + React.

**Rationale:**
- Dashboard apps are overwhelmingly client-side; SSR (Next.js) adds complexity without clear benefit here
- Supabase's JS SDK works identically in both; no SSR-specific advantage
- Vite's dev server is faster for iterative UI work (aligns with TRD §8's "get structure right early")
- The one page that benefits from SSR (landing page SEO) can be handled with prerendering if needed

**Alternatives considered:**
- Next.js App Router: stronger SSR, but adds server component complexity that this dashboard doesn't need
- Plain HTML/JS: too low-level for a multi-view dashboard with real-time updates

---

## ADR-003: Payment gateway — Razorpay (not Stripe)

**Date:** 2026-07-04
**Status:** Proposed (pending user confirmation — see PLAN.md OQ-3)

**Context:** Privacy policy lists "Stripe (or equivalent)." Pricing is in INR, target market is Indian SMBs, refund policy §5 requires RBI e-mandate compliance.

**Decision:** Razorpay.

**Rationale:**
- Native INR support without currency conversion
- RBI e-mandate (auto-debit) support is mature and well-documented
- Better UPI/netbanking coverage for Indian SMBs (Stripe's Indian payment method support exists but is less established)
- All current pricing tiers (₹1,999–₹9,999) fall under RBI's ₹15,000 no-AFA threshold for recurring payments

**Alternatives considered:**
- Stripe: stronger international coverage, but unnecessary for India-only launch. Revisit if non-India tenants appear.

---

## ADR-004: UI Framework Migration — Tailwind CSS v4
**Date:** 2026-07-05
**Status:** Accepted

**Context:** The project initially used heavily scoped Vanilla CSS to enforce a "brutalist" design language. However, as the application grew (specifically the Inbox and Dashboard), the CSS bundles became bloated, and managing utility classes manually became tedious.
**Decision:** Migrate entire styling engine to Tailwind CSS v4 and Radix UI primitives.
**Rationale:**
- Zero runtime overhead (Tailwind v4 is a lightning-fast build tool).
- Eliminates context-switching between `.tsx` and `.css` files.
- Guaranteed dead-code elimination, making the frontend bundle extremely small.
- Radix UI guarantees full web accessibility (WAI-ARIA) for complex components like Dialogs and Dropdowns without polluting the global scope.

---

## ADR-005: RAG Pipeline Optimization — Native Postgres RPC `pgvector`
**Date:** 2026-07-05
**Status:** Accepted

**Context:** Our initial MVP RAG implementation in `backend/src/services/kb/retrieval.ts` loaded all knowledge chunks from Supabase into Node.js memory to perform cosine similarity calculations.
**Decision:** Offload KNN vector search to Postgres using an RPC function (`match_knowledge_chunks`).
**Rationale:**
- Calculating high-dimensional vector math in Node.js on thousands of chunks causes severe memory bloat and eventual server crashing.
- Postgres `pgvector` supports the `<=>` operator natively, meaning vector calculations are executed precisely at the data layer, returning only the top-K chunks over the network.
- Speeds up RAG response times for the WhatsApp bot by orders of magnitude.

---

*More decisions will be logged as implementation proceeds.*
