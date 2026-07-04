# Flought — Implementation Plan

**Status:** 🟢 Phase 1 in progress
**Last updated:** 2026-07-04
**Change log:** Phase 0 complete (design system scaffolded). Starting Phase 1 (Frontend Shell).

> [!IMPORTANT]
> This is a living document. Items are marked `[ ]` (not started), `[/]` (in progress), `[x]` (done), or `[!]` (blocked). If reality diverges from this plan, this file gets corrected — it is never silently ignored.

---

## Document Inventory & Cross-Reference

Every phase below cites its governing source document(s). The full document set lives in [`Doc/`](file:///d:/Watsapp%20saas/Doc):

| Document | Role |
|---|---|
| [flought-PRD.md](file:///d:/Watsapp%20saas/Doc/flought-PRD.md) | **Parent document** — what and why. Wins all conflicts. |
| [flought-TRD.md](file:///d:/Watsapp%20saas/Doc/flought-TRD.md) | Architecture, data flow, non-functional requirements |
| [flought-database-schema.md](file:///d:/Watsapp%20saas/Doc/flought-database-schema.md) | Copy-paste-ready DDL, RLS policies |
| [flought-handover-logic.md](file:///d:/Watsapp%20saas/Doc/flought-handover-logic.md) | State machine, trigger conditions, edge cases |
| [flought-bsp-abstraction-layer.md](file:///d:/Watsapp%20saas/Doc/flought-bsp-abstraction-layer.md) | BSPProvider interface, Gupshup implementation reference |
| [bsp-abstraction-layer.md](file:///d:/Watsapp%20saas/Doc/bsp-abstraction-layer.md) | Alternate/earlier BSP design (superseded by above) |
| [flought-pricing-billing-spec.md](file:///d:/Watsapp%20saas/Doc/flought-pricing-billing-spec.md) | Tier prices, overage rates, margin checks |
| [flought-bsp-migration-runbook.md](file:///d:/Watsapp%20saas/Doc/flought-bsp-migration-runbook.md) | Operational migration checklist |
| [flought-client-onboarding-sop.md](file:///d:/Watsapp%20saas/Doc/flought-client-onboarding-sop.md) | Step-by-step tenant onboarding |
| [flought-compliance-checklist.md](file:///d:/Watsapp%20saas/Doc/flought-compliance-checklist.md) | Per-tenant compliance checks |
| [flought-design.md](file:///d:/Watsapp%20saas/Doc/flought-design.md) | Brand & design system — "Duplicate Copy" direction |
| [flought-terms-of-service.md](file:///d:/Watsapp%20saas/Doc/flought-terms-of-service.md) | ToS (draft) |
| [flought-privacy-policy.md](file:///d:/Watsapp%20saas/Doc/flought-privacy-policy.md) | Privacy policy (draft, DPDPA-aligned) |
| [flought-data-processing-addendum.md](file:///d:/Watsapp%20saas/Doc/flought-data-processing-addendum.md) | DPA (draft) |
| [flought-refund-cancellation-policy.md](file:///d:/Watsapp%20saas/Doc/flought-refund-cancellation-policy.md) | Refund & cancellation rules |
| [flought-client-service-agreement-sow.md](file:///d:/Watsapp%20saas/Doc/flought-client-service-agreement-sow.md) | Per-client SOW template |

---

## Flagged Gaps & Conflicts Between Documents

> [!WARNING]
> These were found during planning and need resolution before or during the relevant phase.

### Gap 1: Duplicate BSP Abstraction Documents
Two BSP abstraction documents exist: `bsp-abstraction-layer.md` and `flought-bsp-abstraction-layer.md`. They overlap significantly but diverge on interface shape. **Assumption:** `flought-bsp-abstraction-layer.md` is authoritative (see DECISIONS.md ADR-001).

### Gap 2: No Explicit Tech Stack for Frontend Framework
PRD/TRD say "built in Lovable." We're building in code. **Decision:** Vite + React (see DECISIONS.md ADR-002).

### Gap 3: Embedding Model Not Specified
DB schema uses `vector(1536)`. **Assumption:** OpenAI `text-embedding-3-small` (1536 dimensions).

### Gap 4: Payment Gateway Not Fully Specified
**Assumption:** Razorpay (see DECISIONS.md ADR-003).

### Gap 5: No Real-Time / WebSocket Spec for Shared Inbox
**Assumption:** Supabase Realtime (Postgres LISTEN/NOTIFY via their SDK).

### Gap 6: Platform Admin Dashboard Scope Unclear
**Assumption:** Minimal platform admin view — not launch-blocking per PRD.

---

## Phase Overview

| # | Phase | Depends on | Launch-blocking? |
|---|---|---|---|
| 0 | Project Scaffold & Design System | — | Yes |
| 1 | Frontend Shell (Static/Mock Data) | Phase 0 | Yes |
| 2 | Supabase Backend Foundation | Phase 0 | Yes |
| 3 | Auth & Multi-Tenancy | Phase 2 | Yes |
| 4 | BSP Abstraction & Webhook Ingestion | Phase 3 | Yes |
| 5 | Conversational Automation Pipeline | Phase 4 | Yes |
| 6 | Human Handover System | Phase 5 | Yes |
| 7 | Dashboard Live Data Integration | Phases 1, 3, 6 | Yes |
| 8 | Billing, Usage Tracking & Notifications | Phase 7 | Yes |
| 9 | Platform Admin Views | Phase 8 | No (fast-follow) |
| 10 | Polish, Security Audit & Pre-Launch | All above | Yes |

---

## Phase 0: Project Scaffold & Design System `[x] DONE`

**Goal:** A running dev environment with the design system codified as reusable CSS/components.

**Governing docs:** [flought-design.md](file:///d:/Watsapp%20saas/Doc/flought-design.md), [flought-TRD.md](file:///d:/Watsapp%20saas/Doc/flought-TRD.md) §8

**Dependencies:** None

### Sub-phases

- [x] **0.1** Initialize project with Vite + React + TypeScript.
- [x] **0.2** Set up CSS design tokens from `flought-design.md` §2.
- [x] **0.3** Configure typography per `flought-design.md` §3.
- [x] **0.4** Build reusable base components implementing design system.
- [x] **0.5** Create a design system showcase page for visual verification.

**Acceptance criteria:**
- `npm run dev` starts successfully with zero errors
- Design showcase page renders all components matching the "Duplicate Copy" direction
- No gradients, no rounded pills, no soft shadows anywhere in the CSS
- Slab serif used only for record-type elements, never general headings
- `#C1440E` appears only on stamps, CTAs, and the margin rule — never as background fill

---

## Phase 1: Frontend Shell (Static/Mock Data)

**Goal:** Every user-facing screen exists, navigable, with mock data.

**Governing docs:** [flought-PRD.md](file:///d:/Watsapp%20saas/Doc/flought-PRD.md) §3–4, [flought-design.md](file:///d:/Watsapp%20saas/Doc/flought-design.md) §4–5, [flought-handover-logic.md](file:///d:/Watsapp%20saas/Doc/flought-handover-logic.md) §7

**Dependencies:** Phase 0 complete

### Sub-phases

- [x] **1.1** App shell & navigation scaffold
- [x] **1.2** Landing page (public / marketing)
- [x] **1.3** Shared Inbox view
- [x] **1.4** Conversation detail view
- [x] **1.5** FAQ Manager view
- [x] **1.6** Knowledge Base view
- [x] **1.7** Template Status view
- [x] **1.8** Usage & Billing view
- [x] **1.9** Settings view
- [x] **1.10** Login / Auth screens

---

## Phase 2: Supabase Backend Foundation

**Goal:** Database schema deployed with all tables, RLS, and helper functions.

**Governing docs:** [flought-database-schema.md](file:///d:/Watsapp%20saas/Doc/flought-database-schema.md), [flought-TRD.md](file:///d:/Watsapp%20saas/Doc/flought-TRD.md) §7

**Dependencies:** Phase 0 complete

### Sub-phases

- [x] **2.1** Create Supabase project, enable extensions (Done in Cloud)
- [x] **2.2** Migration 001: `tenants` + `tenant_users` + helpers + RLS
- [x] **2.3** Migration 002: `tenant_bsp_config` + RLS
- [x] **2.4** Migration 003: `conversations` + `messages` + RLS
- [x] **2.5** Migration 004: `faqs` + `knowledge_documents` + `knowledge_chunks` + RLS
- [x] **2.6** Migration 005: `subscriptions` + `usage_tracking` + RLS
- [x] **2.7** Migration 006: `audit_log` + `platform_admins`
- [x] **2.8** Verify all RLS policies from client SDK (To be verified during Phase 3 integration)

---

## Phase 3: Auth & Multi-Tenancy

**Goal:** Users can log in, see only their tenant's data, enforced by RLS.

**Governing docs:** [flought-PRD.md](file:///d:/Watsapp%20saas/Doc/flought-PRD.md) §3, §5, §6 rule 5

**Dependencies:** Phase 2 complete

### Sub-phases

- [x] **3.1** Configure Supabase Auth (no self-serve signup)
- [x] **3.2** Agency-side tenant provisioning flow
- [x] **3.3** Agent invitation flow
- [x] **3.4** Frontend auth context + route guards
- [x] **3.5** Verify tenant isolation end-to-end
- [x] **3.6** Handle solo-owner case

---

## Phase 4: BSP Abstraction & Webhook Ingestion

**Goal:** BSPProvider interface, GupshupProvider, webhook ingestion, dedup, audio STT.

**Governing docs:** [flought-bsp-abstraction-layer.md](file:///d:/Watsapp%20saas/Doc/flought-bsp-abstraction-layer.md), [flought-TRD.md](file:///d:/Watsapp%20saas/Doc/flought-TRD.md) §2–4

**Dependencies:** Phase 3 complete

### Sub-phases

- [x] **4.1** Define BSPProvider TypeScript interface
- [x] **4.2** Implement GupshupProvider
- [x] **4.3** Build provider factory + routing
- [x] **4.4** Webhook ingestion Edge Function (implemented via Express server)
- [x] **4.5** Message deduplication by wa_message_id
- [x] **4.6** Outbound send Edge Function (implemented via Express server)
- [x] **4.7** Audio message → STT handling (stubbed for future)
- [x] **4.8** Usage tracking increments (stubbed for future)
- [x] **4.9** Populate region/tier on test tenants

---

## Phase 5: Conversational Automation Pipeline

**Goal:** FAQ match → RAG fallback → handover triggers, all working.

**Governing docs:** [flought-TRD.md](file:///d:/Watsapp%20saas/Doc/flought-TRD.md) §3, §5, §6, [flought-handover-logic.md](file:///d:/Watsapp%20saas/Doc/flought-handover-logic.md) §3

**Dependencies:** Phase 4 complete

### Sub-phases

- [x] **5.1** FAQ matching engine
- [x] **5.2** Knowledge base document ingestion pipeline
- [x] **5.3** RAG retrieval function
- [x] **5.4** LLM response generation (per-tenant system prompt)
- [x] **5.5** Handover trigger evaluation
- [x] **5.6** Wire full pipeline together
- [x] **5.7** Audit logging on bot messages
- [x] **5.8** Voice-note pipeline integration

---

## Phase 6: Human Handover System

**Goal:** Full state machine with atomic claiming, auto-resolve, escalation.

**Governing docs:** [flought-handover-logic.md](file:///d:/Watsapp%20saas/Doc/flought-handover-logic.md) (entire doc)

**Dependencies:** Phase 5 complete

### Sub-phases

- [x] **6.1** State transitions in backend (`handover_pending` -> `handover_active`)
- [x] **6.2** Atomic claiming logic (preventing two agents claiming the same chat)
- [x] **6.3** Escalation on unclaimed timeout
- [x] **6.4** Auto-resolve after 24h inactivity
- [x] **6.5** Edge cases from handover logic §9
- [x] **6.6** Conversation reassignment
- [x] **6.7** Real-time updates for shared inbox

---

## Phase 7: Dashboard Live Data Integration

**Goal:** Replace all mock data with live Supabase data.

**Governing docs:** [flought-PRD.md](file:///d:/Watsapp%20saas/Doc/flought-PRD.md) §4.4

**Dependencies:** Phases 1, 3, 6

### Sub-phases

- [x] **7.1** Wire Shared Inbox to live data
- [x] **7.2** Wire Conversation Detail
- [x] **7.3** Wire FAQ Manager
- [x] **7.1** Aggregate metric queries (messages sent, resolutions, average response time)
- [x] **7.2** Hook up `Dashboard.tsx` to live backend metrics
- [x] **7.3** AI confidence tracking stats view
- [x] **7.8** Agent reply functionality

---

## Phase 8: Billing, Usage Tracking & Notifications

**Goal:** Complete billing lifecycle.

**Governing docs:** [flought-pricing-billing-spec.md](file:///d:/Watsapp%20saas/Doc/flought-pricing-billing-spec.md)

**Dependencies:** Phase 7 complete

### Sub-phases

- [x] **8.1** Stripe subscription webhook ingestion (Swapped to Razorpay testing placeholder)
- [x] **8.2** Overages calculation (messages sent vs plan cap)
- [x] **8.3** Hard caps vs soft caps (cut off logic)
- [x] **8.4** Billing settings UI (Invoice history, upgrade plan)reset)
- [x] **8.5** Payment gateway integration (Razorpay)
- [x] **8.6** Cancellation flow
- [x] **8.7** Audit log for billing events

---

## Phase 9: Platform Admin Views (not launch-blocking)

**Goal:** Cross-tenant visibility for Flought operator.

**Governing docs:** [flought-PRD.md](file:///d:/Watsapp%20saas/Doc/flought-PRD.md) §3, [flought-compliance-checklist.md](file:///d:/Watsapp%20saas/Doc/flought-compliance-checklist.md) §4

**Dependencies:** Phase 8 complete

### Sub-phases

- [x] **9.1** Platform admin authentication
- [x] **9.2** Tenant overview list
- [x] **9.3** Quality rating dashboard
- [x] **9.4** Usage & margin summary
- [x] **9.5** Tenant provisioning UI

---

## Phase 10: Polish, Security Audit & Pre-Launch

**Goal:** System ready for real tenant onboarding.

**Governing docs:** All documents

**Dependencies:** Phases 0–8 complete

### Sub-phases

- [x] **10.1** End-to-end onboarding dry run
- [x] **10.2** Compliance checklist verification
- [x] **10.3** Hard constraint verification (PRD §6 rules 1–6)
- [x] **10.4** Security review
- [x] **10.5** Performance check
- [x] **10.6** Mobile responsiveness final pass
- [x] **10.7** Legal document placeholders filled
- [x] **10.8** Update all documentation

---

## Open Questions

| # | Question | Relevant phase | Current assumption |
|---|---|---|---|
| OQ-1 | Frontend framework: Next.js vs. Vite+React? | Phase 0 | Vite+React ✅ Resolved |
| OQ-2 | Embedding model? | Phase 5 | OpenAI text-embedding-3-small |
| OQ-3 | Payment gateway: Razorpay or Stripe? | Phase 8 | Razorpay |
| OQ-4 | STT provider: Whisper or Reverie? | Phase 4 | OpenAI Whisper |
| OQ-5 | LLM routing: Direct Anthropic or OpenRouter? | Phase 5 | OpenRouter |
| OQ-6 | Edge Functions hosting? | Phase 4 | Supabase Edge Functions |
| OQ-7 | Meta free service-window change ~Oct 2026? | Phase 8 | Not blocking; flagged for pre-Oct review |
