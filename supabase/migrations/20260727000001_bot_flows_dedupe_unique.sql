-- One active flow per tenant: dedupe duplicates, then enforce uniqueness.

DELETE FROM public.bot_flows a
USING public.bot_flows b
WHERE a.tenant_id = b.tenant_id
  AND (
    a.updated_at < b.updated_at
    OR (a.updated_at = b.updated_at AND a.id < b.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS bot_flows_tenant_id_unique ON public.bot_flows (tenant_id);
