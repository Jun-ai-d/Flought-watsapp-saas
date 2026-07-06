-- Create shopify_settings table
CREATE TABLE IF NOT EXISTS public.shopify_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    store_url TEXT NOT NULL,
    webhook_secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE public.shopify_settings ENABLE ROW LEVEL SECURITY;

-- Policies for shopify_settings
CREATE POLICY "Users can view shopify settings for their tenant"
    ON public.shopify_settings FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can update shopify settings for their tenant"
    ON public.shopify_settings FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can insert shopify settings for their tenant"
    ON public.shopify_settings FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can delete shopify settings for their tenant"
    ON public.shopify_settings FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Create trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.shopify_settings
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);
