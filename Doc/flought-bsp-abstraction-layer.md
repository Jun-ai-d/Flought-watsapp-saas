# Flought — BSP Abstraction Layer

**Version:** 1.0
**Companion to:** flought-PRD.md, flought-TRD.md §2–4, flought-database-schema.md §2, flought-bsp-migration-runbook.md
**Purpose:** The interface every part of Flought's backend uses to send/receive WhatsApp messages, so business logic never hardcodes a specific BSP. Build this interface before writing the first integration — even though only one provider ships at launch — because retrofitting it after tenants are live is a rewrite, not a refactor (per the decision already made in our earlier discussion).

---

## 1. Why This Exists

Three tenant segments genuinely need different BSPs:

| Segment | Priority | BSP at launch |
|---|---|---|
| India/SEA SMBs (the launch segment) | Lowest cost, decent reliability | **Gupshup** — near-zero per-message markup, no monthly platform fee |
| Other geos | Broad coverage, no India-specific advantage | Telnyx (flat markup, no subscription) — build only once real non-India volume exists |
| VIP/enterprise | Uptime, support SLA, dedicated infra | Twilio — build only once a real VIP prospect asks for reliability guarantees Gupshup can't give |

**The only piece worth building now is the interface itself.** Do not build Telnyx or Twilio providers at launch — that's premature for a segment you don't have yet, per the PRD's non-goals (§5).

---

## 2. The `BSPProvider` Interface

Every BSP integration implements this same contract. Nothing above this layer (webhook processor, automation pipeline, dashboard, billing) ever imports a BSP-specific SDK directly.

```typescript
interface BSPProvider {
  // Send a free-form session message (only valid within the 24hr customer service window)
  sendSessionMessage(params: {
    tenantId: string;
    to: string;               // E.164 phone number
    type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'interactive';
    content: SessionMessageContent;
  }): Promise<SendResult>;

  // Send a pre-approved template message (Marketing / Utility / Authentication)
  sendTemplateMessage(params: {
    tenantId: string;
    to: string;
    templateId: string;
    category: 'marketing' | 'utility' | 'authentication';
    params: string[];
  }): Promise<SendResult>;

  // Normalize this BSP's webhook payload into Flought's internal message format
  parseInboundWebhook(rawPayload: unknown): NormalizedInboundMessage[];

  // Verify a webhook is authentically from this BSP (signature/token check)
  verifyWebhookAuth(headers: Record<string, string>, verifyToken: string): boolean;

  // Fetch current template list + statuses (approved/pending/rejected) for the tenant's WABA
  listTemplates(tenantId: string): Promise<TemplateStatus[]>;

  // Fetch current messaging tier / quality rating, where the BSP exposes it
  getAccountHealth(tenantId: string): Promise<{ tier: number; qualityRating: 'green' | 'yellow' | 'red' }>;
}

interface SendResult {
  bspMessageId: string;       // provider's own message ID, stored for tracing delivery events
  status: 'submitted' | 'failed';
  error?: string;
}

interface NormalizedInboundMessage {
  waMessageId: string;        // Meta's own message ID — this is the dedup key, not the BSP's ID
  fromPhone: string;
  toPhoneNumberId: string;    // used to resolve tenant_id via tenant_bsp_config
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'interactive';
  text?: string;
  mediaUrl?: string;
  timestamp: string;
}
```

**Critical detail:** `waMessageId` (Meta's own ID) is what `flought-database-schema.md`'s `messages.wa_message_id` deduplicates on — never the BSP's own internal message ID, since a future BSP migration would otherwise break dedup continuity for a tenant's message history.

---

## 3. Tenant → BSP Routing

Routing is a **config lookup at onboarding time**, stored on the tenant record — not a runtime decision the automation pipeline makes per message.

```typescript
function assignBSPForNewTenant(tenant: { region: string; tier: 'standard' | 'vip' }): string {
  if (tenant.tier === 'vip') return 'twilio';
  if (tenant.region === 'IN' || tenant.region === 'SEA') return 'gupshup';
  return 'telnyx';
}
```

- This function is called once, at Phase 3 of `flought-client-onboarding-sop.md` ("BSP assignment"), and the result is written to `tenant_bsp_config.bsp_provider`.
- **Populate `region` and `tier` on every tenant from day one**, even while only Gupshup exists — this is free today and avoids a painful backfill later once routing actually branches (this was flagged as the one thing worth doing now, even pre-multi-BSP).
- A provider factory resolves the interface implementation at call time:

```typescript
function getBSPProvider(bspName: string): BSPProvider {
  switch (bspName) {
    case 'gupshup': return new GupshupProvider();
    case 'twilio':  return new TwilioProvider();   // not implemented at launch
    case 'telnyx':  return new TelnyxProvider();   // not implemented at launch
    default: throw new Error(`Unknown BSP: ${bspName}`);
  }
}
```

---

## 4. Gupshup Implementation Reference (Launch Provider)

Gupshup's actual API shape, for grounding the `GupshupProvider` implementation:

- **Auth:** API key passed as an `apikey` header on every request (per-app key, obtained from the Gupshup WhatsApp dashboard) — this is what gets encrypted and stored in `tenant_bsp_config.access_token_encrypted`.
- **Session messages** (free-form, within the 24hr window) and **template messages** go through the same family of endpoints (`api.gupshup.io/wa/api/v1/...` for the newer Meta-aligned format, or Gupshup's own v1/v2 message format) — Gupshup also offers **passthrough APIs** that mimic Meta's own Cloud API request/response shape directly, which is worth defaulting to if a future migration to another BSP is ever likely, since it minimizes the translation layer's divergence from Meta's native format.
- **Async by design:** send requests return an immediate success/submitted response with a Gupshup message ID; actual delivery status (enqueued/sent/delivered/read/failed) arrives later via webhook events — `sendSessionMessage`/`sendTemplateMessage` above should resolve as soon as the submit call succeeds, with delivery status updates handled as a separate webhook-driven update to the `messages` row, not blocking the initial send.
- **Templates:** created via the Gupshup dashboard/API and submitted for Meta approval; categorized the same way Meta categorizes them (Utility/Marketing/Authentication) — `listTemplates()` should surface this category alongside status, since category-mismatch is the compliance risk flagged throughout the other documents.
- **Opt-in tracking:** Gupshup exposes explicit opt-in/opt-out marking endpoints — Flought's platform should call these whenever a tenant's customer messages in for the first time (implicit opt-in) or explicitly opts out, rather than relying purely on internal record-keeping, since Gupshup's own opt-in state can affect deliverability independent of what Flought's database thinks.

```typescript
class GupshupProvider implements BSPProvider {
  private apiKey: string; // decrypted per-call from tenant_bsp_config, never logged

  async sendSessionMessage(params) {
    // POST to Gupshup's message endpoint with apikey header,
    // source = tenant's registered number, destination = params.to
    // Returns { bspMessageId, status: 'submitted' } immediately per Gupshup's async model
  }

  async sendTemplateMessage(params) {
    // POST with template id + params array, category carried from Flought's own
    // template record (never trust a category passed loosely at call time)
  }

  parseInboundWebhook(rawPayload) {
    // Gupshup webhook events include enqueued/sent/delivered/read/failed status
    // updates AND inbound customer messages — this function must distinguish
    // the two and only return actual inbound messages here; status updates
    // go to a separate delivery-status handler, not into NormalizedInboundMessage[]
  }

  async verifyWebhookAuth(headers, verifyToken) {
    // Confirm the shared secret/token configured at webhook setup matches
  }

  async listTemplates(tenantId) {
    // GET templates for the tenant's app, map Gupshup's status strings to
    // Flought's approved/pending/rejected vocabulary
  }

  async getAccountHealth(tenantId) {
    // Gupshup's dashboard/API exposes quality rating and tier where available;
    // if not directly exposed for a given plan, this can fall back to Meta's
    // own Business Manager API using the tenant's WABA ID
  }
}
```

---

## 5. Webhook Routing Gotcha (Carried from the Migration Runbook)

All phone numbers under one WABA share a single webhook URL and verify token at the BSP level. If Flought ever onboards a second number under the same WABA with a different verify token configured, the first integration silently breaks. The webhook router must resolve `tenant_id` from the incoming `phone_number_id`/WABA combination via `tenant_bsp_config` on every request — never assume a static 1:1 mapping between a webhook URL and a tenant.

---

## 6. Build Order

1. **Build the interface and `GupshupProvider` only.** Get real tenants live on this alone.
2. **Add `TwilioProvider`** only when a real VIP client asks for reliability guarantees Gupshup can't provide — not before.
3. **Add `TelnyxProvider`** only once meaningful non-India tenant volume exists to justify it — per the current India-heavy go-to-market, this may be 6+ months out, if ever.
4. At every stage, routing logic (`assignBSPForNewTenant`, `getBSPProvider`) should already support N providers even when only one is implemented — this is the one piece of "extra" work worth doing upfront, since it's cheap now and expensive to retrofit.

---

## 7. What This Buys (and What It Costs)

**Buys:** migrating a tenant to a different BSP later becomes a `tenant_bsp_config` row update (per `flought-bsp-migration-runbook.md`), not a code change. Adding a second BSP for a new segment is a new class behind the same interface, not a fork of the webhook processor or automation pipeline.

**Costs, honestly:** each additional BSP still means a real normalization effort (different webhook payload shapes, different template-status vocabularies, different rate-limit behaviors) — the interface doesn't eliminate that work, it just contains it to one class per provider instead of letting BSP-specific logic leak into the automation pipeline, dashboard, or billing code.

---

## 8. Traceability

`tenant_bsp_config.bsp_provider` (schema §2) is the single source of truth for which `BSPProvider` implementation handles a given tenant. Any new provider added must implement the full interface in §2 — a partial implementation (e.g., sending works but `getAccountHealth` doesn't) breaks the compliance checklist's quality-rating monitoring requirement (`flought-compliance-checklist.md` §4) silently for that provider's tenants.
