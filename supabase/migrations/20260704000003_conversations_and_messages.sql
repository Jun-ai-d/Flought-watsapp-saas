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
