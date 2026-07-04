# Flought — Refund & Cancellation Policy

**Version:** 1.0 (draft)
**Status:** ⚠️ DRAFT TEMPLATE — not legal advice. Have a lawyer confirm before publishing, particularly the setup-fee refund tiers in §3.
**Companion to:** flought-terms-of-service.md, flought-pricing-billing-spec.md
**Scope note:** Flought's Tenants are businesses, not individual consumers — this policy is governed by the Indian Contract Act and the terms below, not the Consumer Protection (E-Commerce) Rules, 2020, which apply to B2C marketplaces. RBI's payment-related requirements (§5) do still apply, since those govern the payment rail itself, not the buyer's legal status.

---

## 1. Subscription Cancellation

- You may cancel your subscription at any time from the dashboard billing page.
- Cancellation takes effect at the **end of your current billing cycle** — you retain full access until then; there is no prorated refund for the unused portion of a cycle once it has started.
- No cancellation fee applies.
- After cancellation, your data is retained per flought-privacy-policy.md §5 (30 days for export, then deletion per schedule).

---

## 2. Subscription Refunds

- **First-time subscribers:** a 7-day money-back guarantee applies from your first paid subscription charge — if the platform genuinely isn't working for your use case, request a full refund of that first charge within 7 days, no questions asked beyond a brief reason for our own product feedback.
- **Beyond the first 7 days:** subscription fees already charged for a billing cycle are non-refundable, since the service (bot uptime, message allowance, dashboard access) was made available for that full cycle regardless of how much you used it.
- **Overage charges** are billed for usage already delivered and are never refundable.
- **Downgrades:** taking effect at your next billing cycle, not immediately — no partial-cycle refund for the difference.

---

## 3. Setup Fee Refunds (Agency Onboarding Work)

Setup fees (₹5,000–₹25,000 per flought-pricing-billing-spec.md §7) follow a tiered refund schedule, since the work becomes progressively harder to "undo" as onboarding proceeds:

| Stage reached | Refund |
|---|---|
| Before any onboarding work begins (Phase 1 of the Onboarding SOP) | 100% |
| Onboarding started, but before number registration/migration (Phases 2–4, e.g. FAQ collection, template drafting) | 50% |
| Number registration or migration already executed with Meta | 0% — this step is irreversible on Meta's side and cannot be "returned" |
| Full onboarding complete, tenant live | 0% |

This mirrors the same logic as the BSP migration runbook's "irreversible once executed" principle — we can't ask Meta to undo a completed number registration, so the refund window closes at that point, not at "goes live."

---

## 4. Service-Level Issues (Not Your Fault)

If Flought's platform itself is unavailable or malfunctioning for reasons within our control (not a Meta/BSP/LLM provider outage, per flought-terms-of-service.md §6) for a cumulative period exceeding 24 hours in a billing cycle, you may request a prorated credit for that downtime against your next invoice. This is a goodwill credit, not a contractual SLA guarantee, unless a separate SLA is negotiated for VIP/Enterprise tenants.

---

## 5. Payment & Auto-Debit (RBI Compliance)

Recurring subscription charges are processed as e-mandates per RBI's Digital Payments – E-mandate Framework, 2026:
- You will receive a **notification at least 24 hours before** each recurring charge is debited.
- You may **opt out of any individual charge** or cancel the entire mandate at any time through the link provided in that notification, or directly from your dashboard.
- No additional charge applies for using the auto-debit facility itself.
- You will receive confirmation after each successful charge, including grievance-redressal contact details.
- Initial mandate setup requires full authentication (OTP/AFA); subsequent charges up to ₹15,000 process without repeated authentication, per RBI's framework — all current Flought tiers (Starter/Growth/Pro) fall under this threshold.

---

## 6. How to Request a Refund or Cancellation

Email *[billing@flought.com — confirm before publishing]* with your tenant account name and reason. Refunds, where applicable, are processed to the original payment method within 7–10 business days.

---

**Reminder before publishing:** confirm the setup-fee refund tiers against your actual delivery process once you've run a few real onboardings — these are reasonable defaults, not numbers validated against real client pushback yet.
