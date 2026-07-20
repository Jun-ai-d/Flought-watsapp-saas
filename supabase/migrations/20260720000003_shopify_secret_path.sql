-- Migration: C-3 Shopify webhook secret path token
-- Adds a per-tenant secret URL token so the Shopify webhook URL no longer
-- exposes tenant_id as a query param (cross-tenant injection fix).

ALTER TABLE public.shopify_settings
  ADD COLUMN IF NOT EXISTS webhook_path_token text UNIQUE;

-- Populate existing rows with a random token
UPDATE public.shopify_settings
SET webhook_path_token = 'shpwh_' || replace(gen_random_uuid()::text, '-', '')
WHERE webhook_path_token IS NULL;

-- Make it NOT NULL going forward
ALTER TABLE public.shopify_settings
  ALTER COLUMN webhook_path_token SET NOT NULL,
  ALTER COLUMN webhook_path_token SET DEFAULT ('shpwh_' || replace(gen_random_uuid()::text, '-', ''));

CREATE INDEX IF NOT EXISTS idx_shopify_webhook_path_token
  ON public.shopify_settings(webhook_path_token)
  WHERE is_active = true;

COMMENT ON COLUMN public.shopify_settings.webhook_path_token IS
  'Secret token embedded in the Shopify webhook URL path. Never expose tenant_id in webhook URLs.';
