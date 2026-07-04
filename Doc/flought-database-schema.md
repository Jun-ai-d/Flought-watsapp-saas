# Flought — Database Schema (DDL)

**Version:** 1.0
**Companion to:** flought-PRD.md, flought-TRD.md, bsp-abstraction-layer.md
**Target:** Supabase (Postgres 15+, RLS, pgvector extension)

This is the copy-paste-ready schema. Every tenant-scoped table has RLS enabled at creation time — never deploy a table without its policy in the same migration.

---

## 0. Extensions & setup

```sql
create extension if not exists "uuid-ossp";
create extension if not exists vector;
create extension if not exists pgcrypto;  -- for encrypting access tokens
```

---

## 1. Tenants & Users

```sql
create table tenants (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  vertical text,                     -- nullable, populated once specialization begins
  region text not null default 'IN',
  tier text not null default 'standard' check (tier in ('standard','vip')),
  status text not null default 'onboarding'
    check (status in ('onboarding','active','suspended','churned')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'agent' check (role in ('admin','agent')),
  created_at timestamptz default now(),
  unique (tenant_id, user_id)
);

create index idx_tenant_users_tenant on tenant_users(tenant_id);
create index idx_tenant_users_user on tenant_users(user_id);

alter table tenants enable row level security;
alter table tenant_users enable row level security;

-- Helper function: does the current user belong to this tenant?
create or replace function is_tenant_member(check_tenant_id uuid)
returns boolean as $$
  select exists (
    select 1 from tenant_users
    where tenant_id = check_tenant_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- Helper: is the current user an admin of this tenant?
create or replace function is_tenant_admin(check_tenant_id uuid)
returns boolean as $$
  select exists (
    select 1 from tenant_users
    where tenant_id = check_tenant_id and user_id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

create policy "members can view their tenant"
  on tenants for select
  using (is_tenant_member(id));

create policy "admins can update their tenant"
  on tenants for update
  using (is_tenant_admin(id));

create policy "members can view their own tenant_users rows"
  on tenant_users for select
  using (is_tenant_member(tenant_id));

create policy "admins can manage tenant_users"
  on tenant_users for all
  using (is_tenant_admin(tenant_id));
```

---

## 2. BSP Configuration

```sql
create table tenant_bsp_config (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null unique,
  bsp_provider text not null check (bsp_provider in ('gupshup','twilio','360dialog','telnyx')),
  waba_id text not null,
  phone_number_id text not null,
  access_token_encrypted text not null,  -- encrypt via pgcrypto pgp_sym_encrypt before insert
  webhook_verify_token text not null,
  tier text not null default 'standard' check (tier in ('standard','vip')),
  region text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create index idx_bsp_config_waba on tenant_bsp_config(waba_id);
create index idx_bsp_config_tenant on tenant_bsp_config(tenant_id);
create index idx_bsp_config_provider on tenant_bsp_config(bsp_provider);

alter table tenant_bsp_config enable row level security;

create policy "admins can view own bsp config"
  on tenant_bsp_config for select
  using (is_tenant_admin(tenant_id));

-- No client-side insert/update policy: BSP config changes go through
-- service-role Edge Functions only (platform-admin controlled), never directly
-- from tenant dashboard client code.
```

---

## 3. Conversations & Messages

```sql
create table conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  serial_number bigserial,             -- human-facing "No. 00482" per design direction
  customer_phone text not null,
  customer_name text,
  status text not null default 'bot'
    check (status in ('bot','handover_pending','handover_active','resolved')),
  assigned_agent_id uuid references auth.users(id),
  last_customer_message_at timestamptz,
  last_message_at timestamptz default now(),
  service_window_expires_at timestamptz,  -- 24hr free-form window tracker
  created_at timestamptz default now()
);

create index idx_conversations_tenant on conversations(tenant_id);
create index idx_conversations_status on conversations(tenant_id, status);
create index idx_conversations_phone on conversations(tenant_id, customer_phone);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  tenant_id uuid references tenants(id) on delete cascade not null,
  direction text not null check (direction in ('inbound','outbound')),
  message_type text not null check (message_type in ('text','image','document','audio','template','interactive')),
  content text,
  media_url text,
  transcript text,                     -- populated for audio via STT
  category text check (category in ('marketing','utility','authentication','service')),
  wa_message_id text unique,           -- dedup key, per TRD §4
  sender text check (sender in ('customer','bot','agent')),
  llm_model_used text,                 -- audit trail: which model generated this, if any
  retrieved_chunk_ids uuid[],          -- audit trail: which RAG chunks grounded this reply
  created_at timestamptz default now()
);

create index idx_messages_conversation on messages(conversation_id);
create index idx_messages_tenant on messages(tenant_id);
create index idx_messages_wa_id on messages(wa_message_id);

alter table conversations enable row level security;
alter table messages enable row level security;

create policy "tenant members can view their conversations"
  on conversations for select
  using (is_tenant_member(tenant_id));

create policy "tenant members can update their conversations"
  on conversations for update
  using (is_tenant_member(tenant_id));

create policy "tenant members can view their messages"
  on messages for select
  using (is_tenant_member(tenant_id));

-- Inserts to conversations/messages happen via service-role Edge Functions
-- (webhook processor, outbound send function) — not directly from client.
```

---

## 4. FAQs & Knowledge Base (RAG)

```sql
create table faqs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  question text not null,
  answer text not null,
  keywords text[],
  match_count integer default 0,        -- how often this FAQ resolved a query (feedback loop)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_faqs_tenant on faqs(tenant_id);
create index idx_faqs_keywords on faqs using gin(keywords);

create table knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  source_name text not null,
  uploaded_by uuid references auth.users(id),
  status text default 'processing' check (status in ('processing','ready','failed')),
  uploaded_at timestamptz default now()
);

create table knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references knowledge_documents(id) on delete cascade not null,
  tenant_id uuid references tenants(id) on delete cascade not null,
  content text not null,
  embedding vector(1536),              -- adjust dimension to chosen embedding model
  metadata jsonb default '{}',         -- {source, section, parent_chunk_id}
  created_at timestamptz default now()
);

create index idx_chunks_tenant on knowledge_chunks(tenant_id);
create index idx_chunks_document on knowledge_chunks(document_id);
create index idx_chunks_embedding on knowledge_chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table faqs enable row level security;
alter table knowledge_documents enable row level security;
alter table knowledge_chunks enable row level security;

create policy "tenant members manage their faqs"
  on faqs for all
  using (is_tenant_member(tenant_id));

create policy "tenant members manage their documents"
  on knowledge_documents for all
  using (is_tenant_member(tenant_id));

create policy "tenant members view their chunks"
  on knowledge_chunks for select
  using (is_tenant_member(tenant_id));
```

---

## 5. Billing & Usage

```sql
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null unique,
  plan text not null,
  cap_messages integer not null,
  price_inr numeric(10,2) not null,
  status text default 'active' check (status in ('active','past_due','cancelled')),
  renewed_at timestamptz default now(),
  created_at timestamptz default now()
);

create table usage_tracking (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  billing_period date not null,        -- first day of the billing month
  messages_sent integer default 0,
  llm_calls integer default 0,
  stt_minutes numeric(10,2) default 0,
  overage_count integer default 0,
  overage_charge_inr numeric(10,2) default 0,
  created_at timestamptz default now(),
  unique (tenant_id, billing_period)
);

create index idx_usage_tenant_period on usage_tracking(tenant_id, billing_period);

alter table subscriptions enable row level security;
alter table usage_tracking enable row level security;

create policy "admins can view their subscription"
  on subscriptions for select
  using (is_tenant_admin(tenant_id));

create policy "tenant members can view their usage"
  on usage_tracking for select
  using (is_tenant_member(tenant_id));
```

---

## 6. Audit Log (compliance, platform-admin visibility)

```sql
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  action text not null,                -- e.g. 'bsp_config_changed', 'template_submitted'
  details jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_audit_tenant on audit_log(tenant_id);

alter table audit_log enable row level security;

create policy "admins can view their tenant's audit log"
  on audit_log for select
  using (is_tenant_admin(tenant_id));

-- Inserts: service-role only, never from client code.
```

---

## 7. Reference / Global Tables (no RLS needed — not tenant-scoped)

```sql
create table platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) unique not null,
  created_at timestamptz default now()
);
-- Used to gate the platform-admin dashboard (Khan's cross-tenant view).
-- Checked via service-role Edge Functions, not client-side RLS.
```

---

## 8. Deployment notes

- Run this as sequenced migrations (numbered files), staging first, in the order presented above — later tables reference earlier ones via foreign keys.
- After creating each table, immediately add its RLS policies in the *same* migration file — never split "create table" and "enable RLS" across separate deploys.
- Verify every policy from the client SDK with a real test tenant, not from the Supabase SQL Editor (which bypasses RLS and will give false confidence).
- `vector(1536)` assumes an OpenAI-compatible embedding dimension — adjust to match whichever embedding model is actually chosen during RAG implementation.
