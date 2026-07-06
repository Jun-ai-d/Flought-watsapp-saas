-- Phase 15: Drip Campaigns Schema

CREATE TABLE IF NOT EXISTS drip_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drip_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES drip_campaigns(id) ON DELETE CASCADE NOT NULL,
    template_id UUID REFERENCES message_templates(id) ON DELETE CASCADE NOT NULL,
    delay_hours INTEGER NOT NULL DEFAULT 0,
    step_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drip_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES drip_campaigns(id) ON DELETE CASCADE NOT NULL,
    contact_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    enrolled_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE drip_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's drip campaigns"
ON drip_campaigns FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert drip campaigns for their tenant"
ON drip_campaigns FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their tenant's drip steps"
ON drip_steps FOR SELECT TO authenticated
USING (campaign_id IN (SELECT id FROM drip_campaigns WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())));

CREATE POLICY "Users can insert drip steps"
ON drip_steps FOR INSERT TO authenticated
WITH CHECK (campaign_id IN (SELECT id FROM drip_campaigns WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())));

CREATE POLICY "Users can view enrollments"
ON drip_enrollments FOR SELECT TO authenticated
USING (campaign_id IN (SELECT id FROM drip_campaigns WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())));

CREATE POLICY "Users can insert enrollments"
ON drip_enrollments FOR INSERT TO authenticated
WITH CHECK (campaign_id IN (SELECT id FROM drip_campaigns WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())));
