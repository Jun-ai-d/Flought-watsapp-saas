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
