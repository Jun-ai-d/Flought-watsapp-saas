# Flought — Product Requirements Document (PRD)

**Version:** 1.0
**Companion to:** flought-TRD.md, flought-bsp-abstraction-layer.md, flought-database-schema.md, flought-handover-logic.md, flought-pricing-billing-spec.md
**Purpose:** The single source of truth for what Flought is and why — every other document (schema, handover logic, pricing, compliance checklist) was built to satisfy the requirements in this one. If a build decision conflicts with this document, this document wins; update it first, then propagate the change downstream.
**Built for:** Lovable.dev — structured so this file (or a trimmed version of it) can be pasted directly into a new Lovable project or used as its Knowledge File.

---

## 1. Problem Statement

Indian SMBs (clinics, retail shops, dealers, service businesses) lose revenue and customer trust because:
- Manual WhatsApp response times average ~4 hours against a near-instant customer expectation — this is direct revenue leakage on inquiries and cart-recovery-type conversations.
- They can't scale support headcount linearly with inquiry volume (observed pattern: businesses cutting 3–5 agents down to 1 agent + automation).
- Appointment/order no-shows and drop-offs go unaddressed without automated reminders (clinics see a documented 25–40% no-show reduction once WhatsApp reminders are added).
- Existing horizontal WhatsApp tools (AiSensy, Wati, and 20+ others) are commodity flow-builders — they don't understand a specific business's actual workflow, they can't hold context across sessions, and most don't handle voice notes at all despite voice being the default input in this market.

**What Flought is not:** a generic "WhatsApp automation SaaS" competing head-on with funded horizontal players. Flought is an **agency-delivered product** — Flought (you) sells setup + ongoing subscription to individual SMB clients, using Flought's own platform as the delivery mechanism. This is the core business-model decision that shapes every scope choice below: features exist to make *you* able to onboard and retain paying clients fast, not to win a self-serve feature race against AiSensy.

---

## 2. Goal

Ship a platform that lets Flought (the agency) onboard an SMB client's WhatsApp number, configure a business-scoped bot (FAQ-first, RAG fallback) with reliable human handover, and bill them — in **7–10 business days per client**, repeatably, without custom engineering per client.

Success metric: **client renewal past the first billing cycle** — not "onboarding completed." A tenant that churns after month one is a product failure even if onboarding went smoothly.

---

## 3. Users & Roles

| Role | Who | What they can do |
|---|---|---|
| **Platform Admin** | You (Flought operator) | Cross-tenant visibility: quality ratings, BSP routing, onboarding pipeline, billing/margin dashboard. Not a tenant-facing role. |
| **Tenant Admin** | Business owner (e.g., clinic owner, shop owner) | Everything an Agent can do, plus: manage FAQs/knowledge base, view billing/usage, invite/manage Agents, receive escalation alerts. |
| **Tenant Agent** | Staff member at the business | Shared inbox access: view conversations, claim and resolve human handovers. No billing or FAQ-management access required for v1 (can be added later, not a launch blocker). |
| **Customer** | The tenant's own end customer | Never logs into anything — interacts purely via WhatsApp. Not a platform user, but every design decision about bot behavior is ultimately about their experience. |

A tenant may have **zero Agents** (solo owner) — the Admin is then the only claimant for handovers. This must not be a broken/edge-case path; it's the default case for a large share of early tenants.

---

## 4. Core Features (In Scope for v1)

### 4.1 Tenant onboarding & number connection
- Connect via Meta Embedded Signup, routed through a BSP (Gupshup at launch — see §7 and `flought-bsp-abstraction-layer.md`).
- Support both **new dedicated number** and **existing-number migration** paths (migration carries real tradeoffs — chat history loss, brief downtime — disclosed per the script in `flought-bsp-migration-runbook.md` §6, which must be a required, logged step, not assumed).

### 4.2 Conversational automation
- **FAQ matching** — keyword/intent match against a tenant-curated FAQ set (target: 15–30 FAQs per tenant at onboarding).
- **RAG fallback** — for queries the FAQ set can't answer, retrieve from tenant-uploaded knowledge base documents (price lists, service menus, policy docs) and generate a grounded response.
- **Voice-note handling** — transcribe inbound audio via STT before running it through the same FAQ/RAG pipeline. This is an explicit differentiator against horizontal competitors that don't handle voice at all — do not treat this as optional/v2.
- **Hard compliance scoping** — every bot is configured to answer only within its tenant's specific business domain (Meta's Jan 2026 policy bans general-purpose assistants on WhatsApp Business). This is enforced at the system-prompt level per tenant, not a generic template applied unchanged. See `flought-compliance-checklist.md` §1.

### 4.3 Human handover
- Full state machine (`bot → handover_pending → handover_active → resolved`) as fully specified in `flought-handover-logic.md` — that document is authoritative; this PRD only asserts that handover must exist and must be reliable, not the mechanics.
- Hard invariant carried up from that spec: **the bot must never reply once handover starts.**

### 4.4 Dashboard
- Shared inbox (conversations, filterable by status/wait time).
- FAQ manager (add/edit FAQs, upload knowledge base documents).
- Template status view (approved/pending/rejected, with category shown).
- Usage & billing view: near-live consumption against the tenant's cap, not a nightly batch — surprise overage is a documented churn driver, so this view is a retention feature, not a nice-to-have.
- Quality-rating visibility is a **Platform Admin** view across all tenants (per `flought-compliance-checklist.md` §4), not necessarily tenant-facing at launch.

### 4.5 Billing
- Tiered subscription (Starter/Growth/Pro) + overage billing, exact numbers per `flought-pricing-billing-spec.md`. This PRD asserts the *behavior* (graceful degrade to overage, never a hard service cutoff; proactive 80%/100% cap notifications) — the pricing doc owns the numbers.
- One-time setup fee, billed and scoped per `flought-client-service-agreement-sow.md`.

---

## 5. Explicit Non-Goals (v1) — Do Not Build These Yet

Carried forward from `flought-handover-logic.md` §10, restated here as product-level decisions, not just implementation notes:
- No AI-suggested replies for agents during handover (agents type their own responses).
- No cross-tenant agent pooling (each tenant's agents are scoped to that tenant only).
- No automated re-engagement messages to customers who went silent mid-handover (compliance/spam risk).
- No multi-BSP routing beyond the single default BSP until a real VIP prospect or real non-India volume exists (per the BSP abstraction layer decision — build the interface, not three integrations, at launch).
- No bulk-import-and-blast contact feature with no opt-in verification — this is a platform-level decision, not left to tenant discretion, because offering the *capability* at all creates platform risk under Meta's opt-in policy.
- No tenant self-serve signup flow at launch — onboarding is agency-assisted (per the business-model decision in §1). A self-serve flow is a plausible future path once the agency model has proven repeatable, not a v1 requirement.

---

## 6. Business Rules (Hard Constraints)

These are non-negotiable and must be enforced in code, not just policy:
1. A bot must never send an automated message while a conversation is `handover_pending` or `handover_active`.
2. A tenant's bot must never answer outside its configured business scope — off-topic queries route to handover or a scoped decline, never an open-ended LLM answer.
3. No tenant may message a customer who has not opted in (first-contact or documented opt-in only) — no purchased/scraped lists.
4. Every outbound template must be correctly categorized (Marketing / Utility / Authentication) before submission — misclassification is both a cost problem and a Meta policy violation.
5. Tenant data is isolated at the database layer (RLS), not just application logic — no tenant can see another tenant's data under any circumstance, including most Flought staff.
6. Overage never blocks service — a tenant's bot keeps working past its cap; they get billed, not cut off.

---

## 7. Technical Direction (Summary — full detail in TRD)

- **Backend/DB:** Supabase (Postgres 15+, RLS, pgvector) — see `flought-database-schema.md`.
- **BSP layer:** abstraction interface (`BSPProvider`) so the rest of the system never hardcodes a specific BSP — see `flought-bsp-abstraction-layer.md`. Launch BSP: Gupshup (India/SEA default, near-zero markup). Twilio/Telnyx added only when a real VIP or non-India-volume tenant requires it.
- **AI:** FAQ-first, RAG fallback via LLM (Claude Haiku-class model for cost reasons), STT for voice notes.
- **Frontend:** built in Lovable — recommended frontend-first, then Supabase wired in once the UI is stable, per Lovable's own recommended sequencing.

---

## 8. Market Context (Why This Scope, Briefly)

- The horizontal WhatsApp automation category is saturated (25+ live competitors identified: Wati, AiSensy, 360dialog, Twilio, Gupshup, Interakt, Trengo, Kaleyra, Infobip, Bird, and others), with pricing already down to ₹1,000–5,000/month.
- Real demand exists for automation itself; the defensible position is **vertical specialization + agency delivery**, not a better horizontal tool.
- Concrete gaps in incumbent tools that this PRD's scope is designed to exploit: context loss across sessions, no voice-note handling, shallow multilingual support, pricing opacity, template rejection friction — see §4.2 (voice handling) and the FAQ/RAG design as direct responses to these gaps.

---

## 9. Open Items (Not Blocking Build)

- Brand & design guidelines — deliberately deferred until a test-render in Lovable exists to react to.
- Agency name/domain — deferred, does not block technical build.
- First-tenant GTM/acquisition plan — deferred until the product itself is in a demo-able state.
- **Time-sensitive:** Meta's free service-window messaging is flagged to change around **October 1, 2026** — revisit `flought-pricing-billing-spec.md` cost assumptions before that date, regardless of build progress.

---

## 10. Traceability

This PRD is the parent document for: `flought-TRD.md`, `flought-bsp-abstraction-layer.md`, `flought-database-schema.md`, `flought-handover-logic.md`, `flought-pricing-billing-spec.md`, `flought-compliance-checklist.md`, `flought-client-onboarding-sop.md`, and the legal document set (ToS, Privacy Policy, DPA, Refund Policy, Client SOW). If a build decision needs a rule not covered here, add it here first, then build it.
