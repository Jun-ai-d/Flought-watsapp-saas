-- Drop the existing check constraint on bsp_provider
ALTER TABLE tenant_bsp_config DROP CONSTRAINT IF EXISTS tenant_bsp_config_bsp_provider_check;

-- Add the new check constraint that includes 'meta'
ALTER TABLE tenant_bsp_config ADD CONSTRAINT tenant_bsp_config_bsp_provider_check 
  CHECK (bsp_provider in ('gupshup','twilio','360dialog','telnyx','meta'));
