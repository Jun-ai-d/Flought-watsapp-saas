# BSP Abstraction Layer — Design

Goal: adding a new BSP or routing a tenant to a different BSP should be a
**config change**, never a code change in your core message-handling logic.

---

## 1. Core interface every BSP adapter implements

```typescript
// types/bsp-provider.ts

export interface OutgoingMessage {
  to: string;                // E.164 phone number
  type: 'text' | 'template' | 'media' | 'interactive';
  text?: string;
  templateName?: string;
  templateParams?: Record<string, string>;
  mediaUrl?: string;
}

export interface NormalizedInboundMessage {
  tenantId: string;
  from: string;
  waMessageId: string;
  timestamp: string;
  type: 'text' | 'audio' | 'image' | 'document' | 'button_reply' | 'unknown';
  text?: string;
  mediaUrl?: string;         // resolved, not the BSP's opaque media id
  raw: unknown;               // original payload, for debugging
}

export interface SendResult {
  success: boolean;
  bspMessageId?: string;
  error?: string;
  costEstimate?: number;      // for per-tenant margin tracking
}

// Every provider (Gupshup, Twilio, 360dialog, Telnyx...) implements this.
export interface BSPProvider {
  readonly name: string;

  sendMessage(tenantConfig: TenantBSPConfig, msg: OutgoingMessage): Promise<SendResult>;

  // Converts the provider's raw webhook body into your internal format.
  normalizeWebhook(rawBody: unknown, tenantConfig: TenantBSPConfig): NormalizedInboundMessage[];

  // Some BSPs require signature verification (recommended for all).
  verifyWebhookSignature(rawBody: string, headers: Record<string,string>, tenantConfig: TenantBSPConfig): boolean;

  getTemplateStatus(tenantConfig: TenantBSPConfig, templateName: string): Promise<'approved'|'pending'|'rejected'>;
}
```

The rest of your app — automation logic, RAG, conversation state, dashboard — only ever talks to `BSPProvider`. It never imports `gupshup-sdk` or `twilio` directly.

---

## 2. Tenant → BSP mapping (Supabase schema)

```sql
create table tenant_bsp_config (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  bsp_provider text not null check (bsp_provider in ('gupshup','twilio','360dialog','telnyx')),
  waba_id text not null,
  phone_number_id text not null,
  access_token_encrypted text not null,   -- encrypt at rest (Supabase Vault or pgcrypto)
  webhook_verify_token text not null,
  tier text not null default 'standard' check (tier in ('standard','vip')),
  region text,                             -- 'IN', 'US', etc — informs routing at onboarding time
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (tenant_id)   -- one active BSP per tenant at a time
);

create index on tenant_bsp_config (bsp_provider);
create index on tenant_bsp_config (waba_id);  -- needed to route inbound webhooks back to a tenant
```

Key point: `waba_id` (or `phone_number_id`, depending on the BSP) is how an inbound webhook gets mapped back to the correct tenant — your webhook route looks this up first, then hands off to the matching provider's `normalizeWebhook()`.

---

## 3. Routing logic — decided once, at onboarding, not per-message

```typescript
// services/bsp-router.ts

const providers: Record<string, BSPProvider> = {
  gupshup: new GupshupProvider(),
  twilio: new TwilioProvider(),
  '360dialog': new DialogProvider(),
  telnyx: new TelnyxProvider(),
};

export function resolveProvider(tenantConfig: TenantBSPConfig): BSPProvider {
  return providers[tenantConfig.bsp_provider];
}

// Called once when a tenant signs up or upgrades — not on every message.
export function assignBSPForNewTenant(region: string, tier: 'standard'|'vip'): string {
  if (tier === 'vip') return 'twilio';        // reliability/SLA priority
  if (region === 'IN' || region === 'SEA') return 'gupshup';  // cheapest markup
  return 'telnyx';                             // global default, no subscription
}
```

Your webhook endpoint and send-message endpoint stay provider-agnostic:

```typescript
// api/webhooks/[wabaId].ts
export async function handleInboundWebhook(wabaId: string, rawBody: unknown, headers) {
  const tenantConfig = await getTenantConfigByWabaId(wabaId);
  const provider = resolveProvider(tenantConfig);

  if (!provider.verifyWebhookSignature(JSON.stringify(rawBody), headers, tenantConfig)) {
    throw new Error('Invalid webhook signature');
  }

  const messages = provider.normalizeWebhook(rawBody, tenantConfig);
  for (const msg of messages) {
    await processInboundMessage(msg); // automation/RAG layer — never sees "gupshup" or "twilio"
  }
}
```

```typescript
// services/messaging.ts
export async function sendToCustomer(tenantId: string, msg: OutgoingMessage) {
  const tenantConfig = await getTenantBSPConfig(tenantId);
  const provider = resolveProvider(tenantConfig);
  return provider.sendMessage(tenantConfig, msg);
}
```

---

## 4. What changes when you add a 2nd/3rd BSP later

- Write one new class implementing `BSPProvider` (e.g. `TwilioProvider`).
- Add one row to the `providers` map.
- Add one branch to `assignBSPForNewTenant()`.
- **Zero changes** to webhook routing, automation logic, RAG pipeline, or dashboard.

This is the entire payoff of building the interface first — the multi-BSP decision becomes reversible and incremental instead of a rewrite.

---

## 5. Sequencing recommendation (unchanged from before, now concrete)

1. **Build only `GupshupProvider` first.** Ship with real tenants.
2. **Add `TwilioProvider`** the moment your first VIP/enterprise prospect asks about reliability/SLA — not before.
3. **Add `TelnyxProvider`** only once you have meaningful non-India volume.
4. Keep `tenant_bsp_config.region` and `.tier` populated from day one even while only Gupshup exists — costs nothing now, saves a migration later when routing logic actually needs to branch.
