-- Phase 4: Growth Tools & Analytics Schema

-- 1. Widget Configurations
CREATE TABLE IF NOT EXISTS widget_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL UNIQUE,
    theme_color TEXT DEFAULT '#25D366',
    greeting_message TEXT DEFAULT 'Hi there! How can we help you today?',
    business_hours JSONB DEFAULT '{"enabled": false}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE widget_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read widget config"
ON widget_configurations FOR SELECT TO anon, authenticated
USING (true); -- Public so embed script can fetch it

CREATE POLICY "Users can manage tenant widget config"
ON widget_configurations FOR ALL TO authenticated
USING (is_tenant_member(tenant_id));

-- 2. CTWA Ad Conversions
CREATE TABLE IF NOT EXISTS ctwa_ad_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    ad_id TEXT,
    ad_title TEXT,
    source_url TEXT,
    customer_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ctwa_tenant ON ctwa_ad_conversions(tenant_id);

ALTER TABLE ctwa_ad_conversions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view tenant ad conversions"
ON ctwa_ad_conversions FOR SELECT TO authenticated
USING (is_tenant_member(tenant_id));

-- 3. Interactive Templates
CREATE TABLE IF NOT EXISTS interactive_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('button', 'list', 'carousel')),
    body TEXT NOT NULL,
    components JSONB NOT NULL DEFAULT '[]'::jsonb, -- Action buttons, rows, etc
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_tenant ON interactive_templates(tenant_id);

ALTER TABLE interactive_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage tenant interactive templates"
ON interactive_templates FOR ALL TO authenticated
USING (is_tenant_member(tenant_id));
