-- Migration: CRM Settings (HubSpot/Salesforce)
-- Created At: 2026-07-15 00:00:12

CREATE TYPE crm_provider AS ENUM ('hubspot', 'salesforce');

CREATE TABLE crm_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider crm_provider NOT NULL,
  api_key_encrypted TEXT,
  sync_contacts BOOLEAN DEFAULT true,
  sync_chats BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, provider)
);

-- RLS
ALTER TABLE crm_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage their crm settings"
  ON crm_settings
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
