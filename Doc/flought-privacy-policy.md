# Flought — Privacy Policy

**Version:** 1.0 (draft)
**Status:** ⚠️ DRAFT TEMPLATE — not legal advice. Have an Indian lawyer review and sign off before publishing. This is required both by WhatsApp's Business Policy (published privacy policy mandatory for anyone messaging users through the platform) and by India's Digital Personal Data Protection Act, 2023 (DPDPA) — getting this wrong carries real regulatory and contractual risk, not just a documentation gap.
**Applies to:** flought.com, the Flought platform, and all tenant businesses using Flought to communicate with their customers on WhatsApp.

---

## 1. Who This Policy Covers

Flought ("we," "us," "the Platform") provides WhatsApp automation software to business customers ("Tenants," "you," if you're a business using Flought). This policy explains:
- What data we collect from Tenants and from Tenants' end customers ("Customers," the people who message a Tenant's WhatsApp number)
- How that data is used, stored, and protected
- What rights individuals have over their data under Indian law

**Important distinction:** For Tenant business account data, Flought acts as a **data processor/service provider** on behalf of the Tenant, who is the **data controller/fiduciary** for their own end-customer relationships. Each Tenant is separately responsible for their own customer-facing privacy disclosures on their WhatsApp Business profile, in addition to this platform-level policy.

---

## 2. Data We Collect

### 2.1 From Tenants (businesses using Flought)
- Business name, GST/registration details, contact information, billing details
- WhatsApp Business Account (WABA) ID, phone number ID, access tokens (encrypted at rest)
- Team/agent user accounts (name, email, role)
- FAQs, knowledge base documents, and templates uploaded for their bot
- Usage data: messages sent, LLM queries, STT minutes, billing history

### 2.2 From Customers (end users messaging a Tenant's WhatsApp number)
- Phone number and profile name (as provided to WhatsApp)
- Message content (text, and transcripts of voice notes via speech-to-text)
- Conversation metadata (timestamps, message status, which FAQ/knowledge chunk answered a query)
- No data is collected from Customers who have not messaged a Tenant's WhatsApp number first — Flought does not scrape, purchase, or import contact lists on behalf of Tenants without documented opt-in.

### 2.3 Automatically collected
- Device/browser information for Tenant dashboard users (standard web analytics)
- API/system logs for security and debugging

---

## 3. How We Use This Data

- To operate the core service: routing messages, running the FAQ/RAG bot, enabling human handover, and billing
- To improve the bot's accuracy for a specific Tenant (each Tenant's knowledge base and conversation data is used only for that Tenant's own bot — never shared or pooled across Tenants)
- To monitor WhatsApp account health (quality rating, messaging tier) on the Tenant's behalf
- To comply with legal obligations and respond to lawful requests from authorities

**We do not sell personal data.** We do not use Customer conversation data to train general-purpose AI models, ours or any third party's.

---

## 4. Third Parties We Share Data With (Sub-Processors)

Operating Flought requires passing data to the following categories of service providers, strictly to deliver the service:

| Category | Purpose | Examples |
|---|---|---|
| Messaging infrastructure | Delivering WhatsApp messages | Meta (WhatsApp Business Platform), your assigned BSP (Gupshup / Telnyx / Twilio) |
| AI/LLM processing | Generating bot responses | Anthropic (Claude API) |
| Speech-to-text | Transcribing voice notes | OpenAI (Whisper) or Reverie, depending on configuration |
| Infrastructure/hosting | Database, authentication, backend | Supabase |
| Payments | Billing and subscription processing | Stripe (or equivalent) |

**Cross-border transfer notice:** Some of the above (notably Anthropic and OpenAI) process data on servers located outside India. Under the DPDPA, this is permitted unless the Indian government specifically restricts transfer to that country, but Tenants and Customers are entitled to know this is happening — this notice satisfies that disclosure requirement. Message content sent for LLM processing is used only to generate the immediate response and is not retained by Flought's LLM provider for model training, per Anthropic's standard API terms.

We do not permit any sub-processor to use Customer data for purposes beyond delivering the specific function they're contracted for.

---

## 5. Data Retention

- Conversation data: retained for the duration of the Tenant's active subscription plus 90 days after termination (for dispute resolution and legally required record-keeping), then deleted or anonymized.
- Billing records: retained per Indian tax law requirements (typically 6–8 years for GST records).
- A Tenant may request earlier deletion of their Customer conversation data, subject to any legal retention obligations that override the request.

---

## 6. Your Rights (Data Principal Rights under DPDPA)

Any individual whose personal data we process (Tenant staff or end Customers) has the right to:
- **Access** — request confirmation of what personal data is processed
- **Correction** — request correction of inaccurate or outdated data
- **Erasure** — request deletion, subject to legal retention requirements
- **Withdraw consent** — where processing is based on consent (e.g., a Customer can stop a Tenant's automated messages by opting out per WhatsApp's standard block/opt-out mechanism)
- **Grievance redress** — raise a complaint with our Grievance Officer (below) and, if unresolved, with the Data Protection Board of India

**Grievance Officer contact:** *[Name, email, physical address — to be filled in before publishing; DPDPA requires a named, reachable Grievance Officer, not a generic support inbox.]*

---

## 7. Data Security

- Tenant data is isolated via Row-Level Security (RLS) at the database level — no Tenant can access another Tenant's data, including Flought staff outside authorized platform-admin roles.
- Access tokens (BSP/WhatsApp credentials) are encrypted at rest.
- Access to the platform-admin cross-tenant view is restricted to authorized personnel only, logged via audit trail.

No system is perfectly secure; in the event of a data breach affecting personal data, we will notify affected Tenants and, where legally required, the Data Protection Board of India, without undue delay.

---

## 8. Children's Data

Flought's service is intended for use by businesses communicating with adult customers. We do not knowingly process data of children as defined under the DPDPA without verifiable parental/guardian consent, and Tenants are responsible for ensuring their own use case complies with this if their customer base includes minors (e.g., an EdTech tenant messaging parents, not students directly).

---

## 9. Changes to This Policy

We will notify Tenants of material changes to this policy via email and/or the dashboard at least 15 days before they take effect. Continued use of the platform after that date constitutes acceptance.

---

## 10. Contact Us

For privacy questions, data requests, or grievances:
📧 *[privacy@flought.com — confirm before publishing]*
🏢 *[registered business address — to be filled in]*

---

**Reminder before publishing:** this policy must be (a) reviewed by a qualified lawyer for DPDPA and WhatsApp Business Policy compliance, (b) have the Grievance Officer and contact details filled in, and (c) be linked from Flought's website and from every Tenant's WhatsApp Business profile before that Tenant goes live — this is a go-live blocker, not a nice-to-have.
