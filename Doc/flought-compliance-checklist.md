# Flought — Per-Tenant Compliance Checklist

**Version:** 1.0
**Companion to:** flought-PRD.md, flought-handover-logic.md
**Purpose:** Per-tenant checklist to run at onboarding and periodically thereafter — protects the tenant's WhatsApp account standing and, since quality issues can affect Flought's own platform reputation with Meta/BSPs, protects your business too.

---

## 1. AI Scope Compliance (the hard requirement)

- [ ] Confirm the tenant's bot is configured to answer **only** questions within their specific business domain — Meta's policy (effective Jan 2026) bans general-purpose AI assistants on WhatsApp Business; only business-specific bots (FAQs, bookings, support, order updates) are permitted.
- [ ] Confirm the system prompt scoping (per `flought-handover-logic.md` §3.3) has been configured with this specific tenant's business boundaries — not a generic template applied unchanged.
- [ ] Spot-check: send an intentionally off-topic query (general trivia, unrelated small talk) during testing and confirm it routes to handover or a scoped decline, never an open-ended answer.
- [ ] Note: as of 2026, Meta's own "Meta Business Agent" product exists as a native competitor — worth periodically checking Meta's current developer documentation for policy changes, since this is an area Meta actively enforces and updates.

## 2. Opt-In & Messaging Consent

- [ ] Confirm the tenant is **not** using Flought to message a purchased/scraped contact list — WhatsApp is opt-in only; cold outbound gets numbers blocked quickly.
- [ ] Confirm the tenant has a documented opt-in mechanism for any contacts they plan to message proactively (e.g., customers who provided their number at point of sale, or messaged the business first).
- [ ] Flought's platform should not offer a bulk-import-and-blast feature with no opt-in verification step — this is a product decision, not just a tenant policy, since offering the capability at all creates platform risk.

## 3. Template Categorization

- [ ] Every outbound template is correctly categorized: **Marketing** (promotions, offers) vs. **Utility** (order confirmations, appointment reminders, receipts) vs. **Authentication** (OTPs).
- [ ] Confirm the tenant understands the cost difference (Utility ≈ ₹0.115/message vs. Marketing ≈ ₹0.86/message) so there's no incentive to misclassify to save money — misclassification is the top cause of template rejection and quality-rating drops, and it's also just more expensive if caught and corrected later.
- [ ] Review each new template before submission for category accuracy — don't rely solely on the tenant self-selecting the category correctly.

## 4. Quality Rating Monitoring

- [ ] Platform admin (Khan) has visibility into every active tenant's quality rating (Green/Yellow/Red) — this should be a cross-tenant view, not something checked tenant-by-tenant reactively.
- [ ] If a tenant drops to **Yellow**: investigate immediately — check recent template performance, block rates, spam reports. Yellow freezes messaging-tier progression even without immediate suspension risk.
- [ ] If a tenant drops to **Red**: treat as urgent — escalation path is messaging restriction (dropped to 250/day for 24–72h) → template suspension → permanent phone number ban if sustained. A permanent ban is unrecoverable and takes down the tenant's Ads/Instagram/WhatsApp access too, so this is a genuine business-continuity risk for the client, not just a platform metric.

## 5. Messaging Tier & Volume Limits

- [ ] Confirm the tenant's current messaging tier (250 → 1K → 10K → 100K unique contacts/24h) matches their actual usage plans — a tenant planning a large campaign needs Business Verification completed and tier progression confirmed *before* the campaign, not discovered as a blocker on send day.
- [ ] Note: limits are set at the business portfolio level, shared across all numbers under it — relevant if a tenant ever has multiple numbers.

## 6. Data & Privacy

- [ ] Confirm a live Privacy Policy is published and accessible (linked in the tenant's WhatsApp Business profile) — required by WhatsApp's Business Policy for anyone messaging users through the platform, independent of Meta App Review status.
- [ ] Confirm customer phone numbers and conversation content are handled per Flought's own DPDPA-compliant data handling (RLS-enforced tenant isolation per the DB schema) — this is a platform-level guarantee, not something each tenant configures individually.

## 7. Recurring Review Cadence

- [ ] **At onboarding:** full checklist run (Phase 4 of Client Onboarding SOP).
- [ ] **Monthly (platform-admin level, across all tenants):** quality rating scan, flagging any Yellow/Red tenants for direct outreach.
- [ ] **On every new template submission:** category accuracy review before submission, not after rejection.
- [ ] **On any tenant complaint of messages not delivering / account restricted:** run this checklist against that tenant specifically as a diagnostic, starting with quality rating and messaging tier.

---

## 8. Traceability

Quality rating and messaging tier data should be pulled into the platform-admin dashboard view (a fast-follow feature, not necessarily launch-blocking) so this checklist can be partially automated rather than manually checked tenant-by-tenant as volume grows.
