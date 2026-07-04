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

create table platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) unique not null,
  created_at timestamptz default now()
);
-- Used to gate the platform-admin dashboard (Khan's cross-tenant view).
-- Checked via service-role Edge Functions, not client-side RLS.
