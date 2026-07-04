# Flought — Client Onboarding SOP

**Version:** 1.0
**Companion to:** flought-pricing-billing-spec.md, flought-bsp-migration-runbook.md
**Purpose:** The exact step-by-step delivery process for onboarding a new tenant, from signed deal to live bot. This is what gets followed for every client — consistency here is what makes the agency-fee side of the business scale past your own personal time.

---

## Phase 1: Pre-Sale to Signed Deal

1. Initial conversation with prospective client — identify their specific pain point (no-shows, slow response times, repetitive FAQ volume) and quantify a rough ₹ outcome if possible (per the earlier pricing conversation: "what money problem does this solve" is the actual pitch, not "WhatsApp automation is useful").
2. Present pricing: one-time setup fee (₹5,000–₹25,000 per `flought-pricing-billing-spec.md` §7) + monthly subscription tier (Starter/Growth/Pro per §3).
3. Client signs the **Client Service Agreement / SOW** (pending doc — defines scope of setup work included in the fee, to prevent scope creep).
4. Collect payment for setup fee before work begins.

---

## Phase 2: Number Decision (Day 1)

**This is a required, logged conversation — not an assumption.** Use the disclosure script from `flought-bsp-migration-runbook.md` §6 verbatim.

- [ ] Ask: does the client want a **new dedicated number** or to **migrate their existing WhatsApp number**?
- [ ] If migrating: walk through the full tradeoff disclosure (chat history loss, groups/status loss if coming from the consumer app, brief downtime window) — get explicit verbal or written confirmation they understand before proceeding.
- [ ] If new number: confirm whether they want a real SIM/landline (supports normal calling — recommended default) or a pure virtual number (WhatsApp-only, cheaper, doesn't support real calls) — per the earlier "new number for calling too" conversation, default to a real SIM unless they specifically don't need calling on that line.
- [ ] Document the decision and confirmation in the tenant's record (feeds `audit_log`).

---

## Phase 3: Technical Setup (Days 1–3)

1. **BSP assignment** — apply `assignBSPForNewTenant()` logic from `bsp-abstraction-layer.md`: region + tier determine Gupshup/Telnyx/Twilio.
2. **Meta Business Verification** — collect required documents from the client (GST certificate, incorporation docs, or utility bills) and submit through Embedded Signup. Set client expectation: 2–5 business days typically, up to 14 days if documents are incomplete.
3. **Number registration** — either fresh OTP verification (new number) or full migration runbook (existing number, per `flought-bsp-migration-runbook.md`).
4. **Display name approval** — submit and confirm it meets Meta's naming guidelines (same-day once business is verified).
5. **Webhook + `tenant_bsp_config` row created** in Flought's database, per schema.

---

## Phase 4: Content & Knowledge Base Setup (Days 2–5, can overlap Phase 3)

1. **FAQ collection** — structured intake session with the client: their 15–30 most common customer questions and answers, entered into the `faqs` table.
2. **Knowledge base documents** (for RAG fallback) — collect any existing documents (price lists, service menus, policy documents) client wants the bot to reference beyond FAQs.
3. **Template creation** — draft the initial set of message templates (appointment reminders, order confirmations, etc., correctly categorized as Utility not Marketing per the compliance requirements) and submit for Meta approval. Set expectation: 24–48 hours typical, but 20–30% of first-time templates get rejected for formatting/language issues — budget for at least one resubmission cycle.
4. **Compliance scoping** — confirm with the client what topics the bot should explicitly NOT answer (medical diagnosis for a clinic, pricing negotiation for a retailer, etc.) — this directly configures the system prompt scoping requirement from `flought-handover-logic.md` §3.3.

---

## Phase 5: Testing (Day 5–6)

- [ ] Send test messages covering: a clear FAQ match, a RAG-required query, an explicit "talk to a human" request, and an out-of-scope/compliance-sensitive query — confirm each routes correctly per the handover logic spec.
- [ ] Confirm human handover actually surfaces in the tenant's dashboard inbox and that claiming/resolving works.
- [ ] Confirm billing/usage tracking is recording correctly against the assigned tier.

---

## Phase 6: Client Training (Day 6–7)

1. Live walkthrough of the dashboard: shared inbox, FAQ management, template status, usage/billing view.
2. Specific training on **claiming and resolving handover conversations** — this is the one workflow that requires the most hand-holding since it's unfamiliar to most first-time bot users.
3. Set expectations on: what the bot can/can't do, how to add new FAQs as they notice gaps (tie back to the "common unanswered queries" analytics feature), and who to contact for support.
4. Confirm the client knows their message cap and what happens on overage (graceful billing, not service cutoff, per pricing spec §4).

---

## Phase 7: Go-Live

- [ ] Flip tenant status from `onboarding` to `active` in the `tenants` table.
- [ ] Subscription billing starts (per `subscriptions` table).
- [ ] Send a confirmation to the client that they're live.
- [ ] Schedule a 7-day and 30-day check-in (informal, but logged) — this is your earliest signal on whether the tenant will renew past the first billing cycle, which per the PRD is your actual success metric, not just "did onboarding complete."

---

## Onboarding Timeline Summary

| Phase | Typical duration |
|---|---|
| Pre-sale to signed deal | Variable (sales cycle) |
| Number decision + technical setup | 3 days |
| Content/knowledge base + templates | 2–5 days (overlaps setup) |
| Testing | 1 day |
| Training | 1 day |
| **Total: signed deal to live** | **~7–10 business days**, longer if Business Verification is delayed or templates need resubmission |

---

## Traceability

Every checkbox above should map to a concrete database state (`tenants.status`, `tenant_bsp_config` populated, `faqs` populated, `subscriptions` created) — if a tenant is marked "active" without every phase complete, that's a process failure worth catching, not a shortcut worth taking.
