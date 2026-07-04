# Flought — Technical Requirements Document (TRD)

**Version:** 1.0
**Companion to:** flought-PRD.md (parent document — this TRD implements its requirements), flought-bsp-abstraction-layer.md, flought-database-schema.md, flought-handover-logic.md, flought-pricing-billing-spec.md
**Purpose:** The "how" to the PRD's "what and why." This document owns architecture, data flow, and non-functional requirements. It does not repeat the full DB schema, handover state machine, or pricing formulas — those live in their own authoritative documents and are referenced here, not duplicated, so a change never has to be made in two places.
**Built for:** Lovable.dev — frontend-first build, Supabase wired in once UI is stable (per Lovable's own recommended sequencing), then extended with Agent Mode as requirements grow.

---

## 1. System Overview

Flought is a multi-tenant system with four logical layers:

1. **WhatsApp connection layer** — Meta Cloud API, reached through a BSP (Gupshup at launch), via Embedded Signup for tenant onboarding.
2. **Backend** — webhook ingestion, per-tenant conversation/message storage, automation pipeline, billing/usage tracking. Built on Supabase (Postgres + Edge Functions).
3. **Automation/AI layer** — FAQ matcher → RAG fallback → handover trigger evaluation, in that order.
4. **Dashboard (frontend)** — built in Lovable; shared inbox, FAQ/knowledge base management, template status, usage/billing view.

Every tenant-facing feature is scoped by `tenant_id` and enforced via Postgres Row-Level Security — this is a database-layer guarantee, not just application logic, per PRD §6 rule 5.

---

## 2. Multi-Tenancy & BSP Routing

- The system never talks directly to a specific BSP's SDK from business logic — it calls a `BSPProvider` interface. Tenant → BSP routing (region + tier) is a config lookup, not a code branch. Full interface definition, method list, and routing schema live in `flought-bsp-abstraction-layer.md` — build that interface before writing the first integration, even though only one provider (Gupshup) ships at launch.
- `tenant_bsp_config` (per `flought-database-schema.md` §2) stores the active provider, WABA ID, phone number ID, and encrypted access token per tenant. Config-only change to migrate a tenant to a different BSP later — no code fork.
- Every WABA shares one webhook URL and verify token at the BSP level — if a second tenant onboards under the same WABA with a different token, earlier integrations silently break. The webhook router must key strictly off `tenant_bsp_config`, never assume 1 WABA = 1 tenant without checking.

---

## 3. Inbound Message Flow (Webhook → Response)

1. BSP webhook hits Flought's ingestion Edge Function.
2. **Deduplicate immediately** by `wa_message_id` (Meta delivers at-least-once — a duplicate delivery must never create a duplicate conversation entry or double-trigger the automation pipeline). This happens at the ingestion layer, before the message ever reaches conversation state logic — per `flought-handover-logic.md` §9, this is explicitly out of scope for the state machine itself.
3. Resolve `tenant_id` from the webhook's WABA/phone-number-id via `tenant_bsp_config`.
4. If audio: transcribe via STT before continuing (transcript stored in `messages.transcript`, per schema).
5. Check conversation state (`conversations.status`):
   - If `handover_pending` or `handover_active`: append message, do **not** invoke the bot. Hard invariant, no exceptions.
   - If `bot`: continue to step 6.
6. Run handover trigger evaluation **first** (explicit human request, before anything else — an explicit "talk to a human" request must never be answered by the bot). If no trigger fires, proceed to FAQ match → RAG fallback, per the exact trigger conditions in `flought-handover-logic.md` §3.
7. Log `llm_model_used` and `retrieved_chunk_ids` on any bot-generated message (audit/debugging requirement — an agent picking up a later handover needs to see what the bot already tried and why it may have failed).
8. Increment `usage_tracking` (messages sent, LLM calls, STT minutes) in the same transaction as message logging — usage must never lag behind actual sends, since the dashboard's usage view is a near-live trust feature per PRD §4.4.

---

## 4. Outbound Message Flow

- All outbound sends (bot replies, agent replies, template sends) go through the `BSPProvider.sendMessage()` interface — never a direct BSP SDK call from application code.
- Template sends must carry the correct category (Marketing/Utility/Authentication) at the API call level, matching what was submitted for approval — a mismatch here is the actual mechanism behind the "misclassification" compliance risk flagged in the PRD and compliance checklist.
- Category is stored on `messages.category` for both audit and billing reconciliation (utility/auth/marketing all cost differently — see `flought-pricing-billing-spec.md` §1).

---

## 5. RAG Pipeline

- Knowledge base documents (`knowledge_documents`) are chunked and embedded into `knowledge_chunks` (pgvector, `vector(1536)` — adjust dimension if a different embedding model is chosen).
- Retrieval at query time: similarity search scoped to `tenant_id` (never cross-tenant retrieval, enforced by RLS, not just a `WHERE` clause the application layer could get wrong).
- If retrieval returns nothing above a minimum relevance threshold, this is itself a handover trigger (§3.2 of the handover logic doc) — RAG failure must fail toward a human, not toward a hallucinated answer.
- The LLM must be explicitly prompted to signal its own confidence in a structured field, not have confidence inferred from response tone — per `flought-handover-logic.md` §3.2, inferring confidence from tone is explicitly called out as insufficient.

---

## 6. Compliance Enforcement (Built Into the System, Not Left to Tenants)

Per PRD §6 rule 2, business-scope enforcement is a system-prompt-level configuration set **per tenant** at onboarding (Phase 4 of `flought-client-onboarding-sop.md`), not a shared generic template. Concretely:
- Each tenant has a stored scope definition (their business domain + explicit excluded topics, e.g., "no medical diagnosis" for a clinic).
- Every LLM call for that tenant's bot includes this scope in its system prompt.
- Off-topic detection routes to handover per §3.3 of the handover logic doc — this must be tested per-tenant during onboarding Phase 5 (send an intentionally off-topic test query and confirm it does not get an open-ended answer).

---

## 7. Non-Functional Requirements

| Area | Requirement |
|---|---|
| **Data isolation** | RLS enabled on every tenant-scoped table at creation time — never deploy a table without its policy in the same migration (per `flought-database-schema.md` §8). |
| **Credential security** | BSP/WhatsApp access tokens encrypted at rest via pgcrypto. Never displayed in any dashboard UI. |
| **Auditability** | Every BSP config change, migration, and template submission logged to `audit_log` with actor, action, and details — required for both compliance disputes and billing disputes. |
| **Usage accuracy** | `usage_tracking` increments in real time, not batch — dashboard usage view must reflect near-live consumption (PRD §4.4). |
| **Availability** | No hard cutoff on cap overage — bot must keep functioning past a tenant's message cap; billing handles overage, service does not degrade (PRD §6 rule 6). |
| **Webhook resilience** | Idempotent processing keyed on `wa_message_id`; must tolerate Meta's at-least-once delivery without side effects on duplicate delivery. |
| **Claim race condition** | Handover claiming must be an atomic UPDATE guarded by current status (`WHERE status = 'handover_pending'`) — two agents opening the same conversation must not both succeed in claiming it. Full detail in `flought-handover-logic.md` §4. |

---

## 8. Build Sequencing (Lovable-Specific)

Recommended order, matching Lovable's own guidance (frontend-first for clarity and debugging ease, Supabase wired in once the UI is stable rather than simultaneously):

1. **Frontend scaffold first:** dashboard shell, inbox UI, FAQ manager UI, usage/billing view — using mock/static data. Get the layout and navigation right before any backend exists (per Lovable's own advice: get structure right early, since layout mistakes compound).
2. **Wire in Supabase:** auth (tenant admin/agent roles), then the schema from `flought-database-schema.md` table by table, in the dependency order it's already written in (tenants → tenant_users → tenant_bsp_config → conversations/messages → faqs/knowledge_chunks → subscriptions/usage_tracking → audit_log).
3. **Webhook ingestion Edge Function** — build against a single BSP (Gupshup) first, using the `BSPProvider` interface from day one even with only one implementation, so a second BSP is a config addition later, not a rewrite.
4. **Automation pipeline:** FAQ matching first (no LLM dependency, ships fastest, validates the pipeline end-to-end), then RAG fallback, then handover trigger logic layered on top.
5. **Dashboard goes live against real data**, replacing the mock data from step 1.
6. **Billing/usage tracking** wired last, once message flow is proven — this order avoids building billing logic against a message pipeline that's still changing shape.

**Lovable workflow notes:**
- Use a **Knowledge File** populated from `flought-PRD.md` (trimmed) so every prompt in the project has persistent context — don't re-explain the product in each prompt.
- Use **Plan Mode** before each major structural change (adding the handover state machine, adding RLS policies) rather than prompting directly into Agent Mode for anything non-trivial.
- Keep prompts structured and specific — name every screen and button deliberately at the start (`Inbox`, `Claim`, `Resolve`) since renaming later ripples through routes and generated code.
- If a build attempt goes sideways, prefer **Remix** (clean copy, keep what works) over repeated "try to fix" prompts on the same broken state.

---

## 9. Explicit Technical Non-Goals (v1)

Mirrors PRD §5, restated at the technical level:
- No multi-BSP runtime routing logic beyond the interface existing — only `GupshupProvider` is implemented at launch.
- No AI-assisted reply suggestions in the agent handover UI.
- No cross-tenant agent session pooling.
- No automated customer re-engagement sequences.
- No self-serve tenant signup flow — onboarding writes to the database via the agency's own admin action (per Client Onboarding SOP), not a public signup form, at launch.

---

## 10. Traceability

This TRD implements `flought-PRD.md` and is implemented by `flought-database-schema.md`, `flought-bsp-abstraction-layer.md`, and `flought-handover-logic.md`. If an implementation needs a technical decision not covered by one of these four documents, add it to the appropriate document first — don't let the actual build silently diverge from what's written here.
