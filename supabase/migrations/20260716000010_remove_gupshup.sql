-- Update existing records
UPDATE tenant_bsp_config
SET bsp_provider = 'meta'
WHERE bsp_provider = 'gupshup';

-- Change default to 'meta'
ALTER TABLE tenant_bsp_config
ALTER COLUMN bsp_provider SET DEFAULT 'meta';
