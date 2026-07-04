create table agent_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  email text not null,
  role text not null default 'agent' check (role in ('admin', 'agent')),
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  error_details text,
  created_at timestamptz default now()
);

create index idx_agent_invitations_tenant on agent_invitations(tenant_id);

alter table agent_invitations enable row level security;

-- Tenant Admins can view invitations for their tenant
create policy "Admins can view invitations"
  on agent_invitations for select
  using (is_tenant_admin(tenant_id));

-- Tenant Admins can create invitations for their tenant
create policy "Admins can create invitations"
  on agent_invitations for insert
  with check (is_tenant_admin(tenant_id));

-- No update/delete policies needed for clients (status is managed by backend script)
