-- Phase 5: Analytics & Topic Extraction

create table if not exists conversation_topics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  conversation_id uuid references conversations(id) on delete cascade not null,
  topic text not null,
  created_at timestamptz default now()
);

create index if not exists idx_conv_topics_tenant on conversation_topics(tenant_id);
create index if not exists idx_conv_topics_topic on conversation_topics(tenant_id, topic);

alter table conversation_topics enable row level security;

create policy "tenant members can view topics"
  on conversation_topics for select
  using (is_tenant_member(tenant_id));
