# Flought — Client Service Agreement / Statement of Work (SOW) Template

**Version:** 1.0 (draft)
**Status:** ⚠️ DRAFT TEMPLATE — not legal advice. Have a lawyer review before use, particularly §7 (liability/indemnification) and §8 (IP ownership).
**Purpose:** Signed by each client before onboarding work begins (Phase 1 of flought-client-onboarding-sop.md). Defines exactly what the one-time setup fee covers, to prevent scope creep — this is the single biggest protection for the agency side of the business.

---

## 1. Parties

This Agreement is between **[Your registered business name]** ("Flought," "we") and **[Client business name]** ("Client"), effective as of the date of signature below.

---

## 2. Scope of Work (What the Setup Fee Covers)

Per the Client Onboarding SOP, this engagement includes:

- [ ] Number decision consultation (new dedicated number vs. existing-number migration) and execution of the chosen path
- [ ] Meta Business Verification submission and follow-up (document collection, resubmission if rejected once)
- [ ] BSP assignment and technical configuration (`tenant_bsp_config` setup)
- [ ] Display name submission and approval
- [ ] FAQ collection: up to **30 questions/answers** structured intake session
- [ ] Knowledge base setup for RAG fallback: up to **[X] documents / pages** (specify based on quoted fee tier)
- [ ] Initial template drafting and submission: up to **[X] templates**, correctly categorized (Utility/Marketing/Authentication)
- [ ] Compliance scoping session (defining what topics the bot must not answer)
- [ ] Testing (Phase 5 of the SOP) and one round of adjustments based on test results
- [ ] Live training session for Client's team (dashboard walkthrough, handover claiming/resolving workflow)
- [ ] Go-live and 7-day + 30-day check-in

**Explicitly out of scope** (billed separately if requested):
- Additional FAQs/templates/knowledge base documents beyond the quoted quantity
- Custom integrations beyond Flought's standard connectors
- Ongoing content updates after go-live (this is a Client self-service function via the dashboard, not an included ongoing service)
- Rush/expedited timelines outside the standard 7–10 business day onboarding window

---

## 3. Fees & Payment

- **Setup fee:** ₹**[amount, per flought-pricing-billing-spec.md §7 — ₹7,999 standard / ₹12,999 migration-onboarding]**, due in full before work begins (per Client Onboarding SOP Phase 1).
- **Recurring subscription fee:** per the Client's selected plan tier (Starter/Growth/Pro), billed separately per flought-terms-of-service.md §4, starting from go-live.
- Setup fee refund eligibility is governed by flought-refund-cancellation-policy.md §3 — refer the Client there rather than negotiating ad hoc terms per engagement.

---

## 4. Timeline

Per flought-client-onboarding-sop.md's Onboarding Timeline Summary: **~7–10 business days from signed deal to live**, contingent on:
- Client providing FAQ/knowledge base content and template approval decisions promptly when requested
- Meta Business Verification not being delayed by incomplete Client documentation
- Existing-number migration (if applicable) not encountering the failure modes listed in flought-bsp-migration-runbook.md §8

Delays caused by the Client's own response time, or by Meta/BSP processing outside Flought's control, extend this timeline without penalty to Flought.

---

## 5. Client Responsibilities

The Client agrees to:
- Provide accurate business documentation for Meta Business Verification
- Respond to onboarding requests (FAQ content, template approval, testing feedback) within 3 business days to keep the timeline on track
- Confirm understanding of the number-decision tradeoffs (migration vs. new number) in writing before Flought proceeds, per the disclosure script in flought-bsp-migration-runbook.md §6
- Ensure their own use of WhatsApp complies with opt-in requirements — Flought is not responsible for a Client's pre-existing contact list being non-compliant

---

## 6. Change Requests

Any work beyond the scope in §2 requires a written change order with an agreed additional fee before Flought begins that work. This protects both parties — the Client gets a clear quote before commitment, Flought doesn't do unpaid scope creep.

---

## 7. Warranty & Liability

- Flought warrants that onboarding work will be performed with reasonable professional care, matching the scope in §2.
- Flought does not warrant specific outcomes from Meta (Business Verification approval timing, template approval, quality rating) since these are determined by Meta, not Flought.
- Liability for this engagement is capped at the setup fee paid, consistent with the platform-level liability cap in flought-terms-of-service.md §6.

---

## 8. Intellectual Property

- The Client owns their own WhatsApp Business Account, phone number, FAQ content, and knowledge base documents (per flought-terms-of-service.md §5).
- Flought retains ownership of the underlying platform, templates/workflow logic, and any reusable configuration frameworks developed generally (not specific to one Client) during onboarding.
- Client-specific configuration built during this engagement (their specific bot scoping, FAQ set) is licensed for the Client's use for as long as their Flought subscription remains active.

---

## 9. Term & Termination

This SOW is complete upon go-live (Phase 7 of the Onboarding SOP) and does not need to be re-signed for continued platform use, which is governed separately by flought-terms-of-service.md. Either party may terminate this SOW before go-live per the refund terms in flought-refund-cancellation-policy.md §3.

---

## 10. Signatures

| | Flought | Client |
|---|---|---|
| Name | | |
| Title | | |
| Date | | |
| Signature | | |

---

**Reminder before publishing:** fill in the bracketed quantities (§2) and fee amounts (§3) per your actual tier structure before sending to a real client, and have a lawyer confirm the liability cap in §7 is consistent with the main Terms of Service rather than accidentally creating two different caps that conflict.
