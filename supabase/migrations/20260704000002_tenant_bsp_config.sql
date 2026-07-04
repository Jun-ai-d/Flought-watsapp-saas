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
