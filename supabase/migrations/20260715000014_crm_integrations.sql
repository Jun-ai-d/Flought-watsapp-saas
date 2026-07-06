-- CRM Integrations Table
-- Stores Private App Tokens / Personal Access Tokens for HubSpot and Salesforce

create table crm_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  provider text not null check (provider in ('hubspot', 'salesforce')),
  access_token text not null, -- Stored securely. In production, consider pgcrypto or Vault.
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, provider)
);

create index idx_crm_integrations_tenant on crm_integrations(tenant_id);

alter table crm_integrations enable row level security;

create policy "tenant members can view their crm integrations"
  on crm_integrations for select
  using (is_tenant_member(tenant_id));

create policy "tenant members can insert crm integrations"
  on crm_integrations for insert
  with check (is_tenant_member(tenant_id));

create policy "tenant members can update their crm integrations"
  on crm_integrations for update
  using (is_tenant_member(tenant_id));

create policy "tenant members can delete their crm integrations"
  on crm_integrations for delete
  using (is_tenant_member(tenant_id));
