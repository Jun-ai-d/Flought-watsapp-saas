# Flought — Data Processing Addendum (DPA)

**Version:** 1.0 (draft)
**Status:** ⚠️ DRAFT TEMPLATE — not legal advice. Have a lawyer review before use.
**Parties:** Flought ("Processor") and the Tenant ("Data Fiduciary") named in the applicable subscription agreement.
**Incorporated into and forms part of:** flought-terms-of-service.md

---

## 1. Why This Document Exists

Under India's Digital Personal Data Protection Act, 2023 (DPDPA), **processors have no direct statutory obligations** — the Act places compliance responsibility entirely on the Data Fiduciary (here, the Tenant, for their own Customer relationships). The DPDPA's mechanism for extending protection down the chain is explicitly contractual: fiduciaries must bind their processors by agreement. This DPA is that binding agreement.

**Roles under this DPA:**
- **Tenant = Data Fiduciary** — determines the purpose and means of processing their Customers' personal data (e.g., what the bot is used for, what data is collected).
- **Flought = Data Processor** — processes that data solely on the Tenant's behalf and documented instructions, to deliver the Flought platform.

---

## 2. Scope & Duration

This DPA applies for as long as Flought processes personal data on the Tenant's behalf under the Terms of Service, and survives termination until all such data is deleted or returned per §7.

**Categories of data processed:** Customer phone numbers, names, message content, voice-note transcripts, conversation metadata — as described in flought-privacy-policy.md §2.2.
**Categories of data subjects:** the Tenant's end Customers who message the Tenant's WhatsApp number.
**Purpose of processing:** operating the Tenant's WhatsApp automation (bot responses, human handover, billing/usage tracking) — no other purpose.

---

## 3. Flought's Obligations as Processor

Flought shall:
- Process personal data **only** on the Tenant's documented instructions (as configured via the Flought dashboard/API), except where required otherwise by Indian law, in which case Flought will inform the Tenant unless legally prohibited from doing so.
- Not process data for its own independent purposes, and never use Tenant Customer data to train general-purpose AI models (per flought-privacy-policy.md §3).
- Implement the security measures described in §5 below.
- Ensure personnel with access to Tenant data are bound by confidentiality obligations.
- Assist the Tenant in responding to data principal rights requests (access, correction, erasure) within a timeframe that allows the Tenant to meet their own regulatory response obligations — Flought will provide the necessary data exports/deletions via the platform-admin tools within 5 business days of a Tenant's request.
- Notify the Tenant **within 24 hours** of becoming aware of a personal data breach affecting the Tenant's Customer data — faster than the Tenant's own 72-hour DPDPA notification deadline to the Data Protection Board, so the Tenant has time to act.
- Not engage a new sub-processor without giving the Tenant reasonable notice and the opportunity to object (§4).

---

## 4. Sub-Processors

The Tenant consents to Flought engaging the following categories of sub-processors, necessary to deliver the service:

| Sub-processor category | Current provider(s) | Location |
|---|---|---|
| Messaging delivery | Meta (WhatsApp Business Platform); Gupshup, Telnyx, or Twilio (BSP, tenant-assigned) | Global / India-routed |
| AI/LLM processing | Anthropic (Claude API) | United States |
| Speech-to-text | OpenAI (Whisper) or Reverie | United States / India |
| Infrastructure | Supabase | Region per Supabase project config |
| Payments | Stripe or equivalent | Global |

Flought will maintain this list current in the Tenant dashboard and notify Tenants of material changes at least 15 days before a new sub-processor goes live, giving Tenants the opportunity to raise objections before that sub-processor begins processing their data.

**Flow-down obligation:** Flought contractually binds each sub-processor to data protection obligations equivalent to those in this DPA.

---

## 5. Security Measures

- Tenant-level data isolation via Postgres Row-Level Security (RLS) — enforced at the database layer, not just application logic.
- Encryption at rest for BSP/WhatsApp access tokens (pgcrypto).
- Access to cross-tenant platform-admin views restricted to authorized Flought personnel, logged via audit trail.
- Deduplication and validation at the webhook ingestion layer to prevent data integrity issues.

---

## 6. Cross-Border Transfer

Personal data is transferred to Anthropic and OpenAI, both based in the United States, for the sole purpose of generating bot responses and transcribing voice notes respectively. As of this DPA's drafting, DPDPA permits cross-border transfer except to countries specifically restricted by the Indian government (no such restriction currently applies to the United States). This transfer is disclosed here and in flought-privacy-policy.md §4; the Tenant's own Customer-facing consent language should reflect that their data may be processed outside India for these specific purposes.

---

## 7. Data Return & Deletion on Termination

On termination of the Tenant's subscription:
- The Tenant may export their Customer conversation data and contact records for 30 days post-termination.
- After 30 days, Flought will delete all Tenant Customer personal data from active systems, except where retention is required by law (e.g., GST/billing records).
- Deletion from backups occurs on Flought's standard backup rotation cycle, disclosed on request.

---

## 8. Audit Rights

The Tenant may request evidence of Flought's compliance with this DPA (e.g., a summary of security controls, sub-processor list, RLS policy documentation) no more than once per 12 months, or following a suspected breach. Flought is not obligated to grant on-site audit access but will provide documentary evidence sufficient to demonstrate compliance.

---

## 9. Liability

Liability under this DPA is subject to the limitation of liability clause in flought-terms-of-service.md §6. Nothing in this DPA expands Flought's liability beyond what is stated there.

---

## 10. Precedence

If there is a conflict between this DPA and the Terms of Service on data protection matters specifically, this DPA controls. On all other matters, the Terms of Service control.

---

**Reminder before publishing:** confirm the 24-hour internal breach notification window is operationally realistic once you have real infrastructure monitoring in place, and have a lawyer confirm the sub-processor flow-down language holds up contractually — this document is only as strong as Flought's actual contracts with Anthropic/OpenAI/Supabase/Stripe backing it.
