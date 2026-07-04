# Flought — Pricing & Billing Logic Spec

**Version:** 1.0
**Companion to:** flought-PRD.md, flought-TRD.md
**Purpose:** The exact, implementable billing rules — replaces all earlier placeholder numbers with locked figures based on current Meta/BSP/LLM/STT rates. If Meta's rates change (they revise up to 4x/year), update the cost constants here first, then propagate to code — never let pricing logic and this doc diverge.

---

## 1. Cost Inputs (as of mid-2026, verify before each pricing revision)

| Cost component | Rate |
|---|---|
| Meta — Marketing message (India) | ₹0.8631/message |
| Meta — Utility/Authentication message | ₹0.115/message |
| Meta — Service message (within 24hr window) | Free, uncapped |
| Gupshup markup (India/SEA default BSP) | ~₹0.001/message (near-zero markup tier) |
| LLM (Claude Haiku 4.5 via OpenRouter) | ~₹0.024 per RAG query (≈800 in / 200 out tokens) |
| LLM (FAQ-matched, no LLM call) | ₹0 |
| STT (Whisper) | ~₹0.006/minute of audio (~₹0.50/₹100 exchange rate) |
| GST | 18% on Meta charges + BSP platform fees |

**Key implication:** Service-window replies (the bulk of a support-heavy bot's traffic) are free at the Meta layer. Your real variable cost per bot-handled conversation is overwhelmingly LLM + STT, not Meta fees — this should directly inform which lever you optimize first if margins tighten.

---

## 2. Typical Tenant Usage Profile (for tier sizing)

Based on current data for single-location Indian SMBs (clinics, retail shops):
- A clinic-scale business handling patient queries via WhatsApp typically stays in the **low thousands of conversations/month**, overwhelmingly service-category (free) and utility (reminders, confirmations) rather than marketing.
- Utility-heavy profiles (order confirmations, appointment reminders) keep Meta costs very low — often under ₹5,000/month in Meta charges even for a moderately busy single-location business.
- Marketing/broadcast usage should be assumed low or zero for most early tenants — general Indian SMBs use WhatsApp primarily for support and transactional messages, not bulk campaigns, at this stage of the business.

This justifies sizing your tiers around **service + utility volume**, with marketing message headroom kept intentionally small in lower tiers (protects your margin from an unexpectedly large broadcast).

---

## 3. Pricing Tiers (locked numbers)

| Tier | Price (₹/month) | Included messages* | Included LLM queries | Target tenant |
|---|---|---|---|---|
| **Starter** | ₹1,999 | 1,500 (mostly service/utility) + 200 marketing | 500 RAG/LLM queries | Single-location shop/clinic, FAQ-first |
| **Growth** | ₹4,999 | 4,000 (service/utility) + 500 marketing | 1,500 RAG/LLM queries | Multi-agent, active reminders + light broadcast |
| **Pro** | ₹9,999 | 10,000 (service/utility) + 1,500 marketing | 4,000 RAG/LLM queries | Multi-location, VIP-tier BSP reliability |

*"Included messages" cap applies to Meta-billable categories combined (utility + marketing); service-window replies never count against the cap since Meta doesn't charge for them — but STT minutes and LLM calls still apply and are tracked separately.

### 3.1 Margin check — Starter tier

| Cost line | Calculation | ₹ |
|---|---|---|
| Utility messages (1,500 @ ₹0.115) | | ₹172.50 |
| Marketing messages (200 @ ₹0.8631) | | ₹172.62 |
| BSP markup (1,700 @ ₹0.001) | | ₹1.70 |
| LLM (500 queries @ ₹0.024) | | ₹12.00 |
| STT (assume 100 min/month @ ₹0.50) | | ₹50.00 |
| GST (18% on Meta + BSP portion) | | ~₹62.00 |
| **Total cost** | | **≈₹470** |
| **Price** | | **₹1,999** |
| **Gross margin** | | **≈76%** |

Healthy margin even at full tier usage — confirms the tier prices are sound, not just placeholder-round numbers.

---

## 4. Overage Billing

- Overage rate per message beyond the cap: **2.5x the combined marginal cost** (Meta category rate + BSP markup + amortized LLM/STT share), rounded to a clean customer-facing number.
- Worked overage rate for utility/service overage: (₹0.115 + ₹0.001) × 2.5 ≈ **₹0.30/message** — round to **₹0.35/message** for simplicity and margin buffer.
- Worked overage rate for marketing overage: (₹0.8631 + ₹0.001) × 2.5 ≈ **₹2.16/message** — round to **₹2.25/message**.
- LLM overage (queries beyond the tier's included count): flat **₹0.10/query** (covers LLM cost many times over, simple to communicate).
- Overage is billed at the end of the billing cycle, not blocked in real-time — tenants should never have their bot go silent mid-month due to hitting a cap; degrade gracefully to overage billing, not service interruption. (A hard cutoff is a support/reputation risk far larger than the overage revenue it protects.)

---

## 5. Billing Cycle Logic

- Monthly billing cycle, cap resets on the tenant's subscription anniversary date (not calendar month) — avoids a billing-logic edge case where all tenants reset simultaneously and create a batch-processing spike.
- `usage_tracking` table (per DB schema) increments in real time as messages/LLM calls/STT minutes are logged — the dashboard usage view should reflect near-live consumption, not a nightly batch job, so tenants can self-monitor before hitting overage.
- Send a proactive in-app + WhatsApp notification to the tenant admin at 80% and 100% of cap — this is a trust-building feature, not just a compliance nicety; surprise overage bills are a documented churn driver in this category.

---

## 6. What's NOT itemized separately (bundled by design)

Per the earlier cost-comparison decision, do not itemize these as separate line items on tenant invoices — bundle their cost into the tier price and overage rate:
- LLM cost (too small relative to Meta fees to justify itemization complexity)
- STT cost (same reasoning)
- BSP markup (Meta's fee dominates; showing "BSP markup: ₹1.70" on an invoice adds confusion for no customer value)

**What must always be itemized:** the one-time setup fee (separate agency-work line item, per the decided monetization split) and the subscription + overage total. Two lines, not ten.

---

## 7. Setup Fee (agency layer, confirmed structure)

- Range: **₹5,000–₹25,000** one-time, scaled to onboarding complexity (number of templates, whether it's a fresh number or existing-number migration, knowledge base size for RAG setup).
- Suggested default for a standard single-location onboarding: **₹7,999** — high enough to filter serious clients, low enough to not be the objection that kills the deal.
- Migration onboarding (existing number, per the earlier migration conversation) should carry a **higher setup fee** (~₹12,999) given the added complexity (2FA disabling, WABA transfer, template re-approval risk) — price the operational risk, not just the time.

---

## 8. VIP/Enterprise Tier (placeholder, not fully speced)

For future large/VIP tenants on Twilio (per the BSP routing rules): custom pricing, negotiated per tenant, likely including BYOK LLM option (per the PRD's stated enterprise-only exception to bundled LLM cost). Not required for launch — flag as a template to fill in once a real VIP prospect exists, don't pre-build.

---

## 9. Traceability

- `subscriptions.cap_messages` and `subscriptions.price_inr` (per DB schema) must match the locked tier table in §3 exactly.
- `usage_tracking.overage_charge_inr` calculation must implement the exact overage rates in §4 — if these numbers change, update this document first, then the calculation logic, not the other way around.
