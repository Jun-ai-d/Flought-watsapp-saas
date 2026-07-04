create extension if not exists "uuid-ossp";
create extension if not exists vector;
create extension if not exists pgcrypto;

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
