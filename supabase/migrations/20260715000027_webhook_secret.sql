-- Phase 8 Remediation: Add webhook_secret_encrypted for secure outbound webhooks

ALTER TABLE public.developer_settings
ADD COLUMN IF NOT EXISTS webhook_secret_encrypted text;
