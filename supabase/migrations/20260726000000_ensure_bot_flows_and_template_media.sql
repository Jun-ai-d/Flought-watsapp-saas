-- Repair migration: ensure bot_flows exists (Coolify/Supabase instances that skipped 20260715000008)
CREATE TABLE IF NOT EXISTS public.bot_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    nodes JSONB DEFAULT '[]'::jsonb,
    edges JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bot_flows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view bot_flows for their tenant" ON public.bot_flows;
CREATE POLICY "Users can view bot_flows for their tenant"
    ON public.bot_flows FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert bot_flows for their tenant" ON public.bot_flows;
CREATE POLICY "Users can insert bot_flows for their tenant"
    ON public.bot_flows FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update bot_flows for their tenant" ON public.bot_flows;
CREATE POLICY "Users can update bot_flows for their tenant"
    ON public.bot_flows FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete bot_flows for their tenant" ON public.bot_flows;
CREATE POLICY "Users can delete bot_flows for their tenant"
    ON public.bot_flows FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

-- Public bucket for WhatsApp template header sample media (Meta requires a reachable URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('template_media', 'template_media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Tenant members can upload template media" ON storage.objects;
CREATE POLICY "Tenant members can upload template media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'template_media' AND
    (SELECT public.is_tenant_member((string_to_array(name, '/'))[1]::uuid))
  );

DROP POLICY IF EXISTS "Anyone can view template media" ON storage.objects;
CREATE POLICY "Anyone can view template media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'template_media');

DROP POLICY IF EXISTS "Tenant members can delete template media" ON storage.objects;
CREATE POLICY "Tenant members can delete template media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'template_media' AND
    (SELECT public.is_tenant_member((string_to_array(name, '/'))[1]::uuid))
  );
