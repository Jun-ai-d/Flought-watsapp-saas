-- Phase 13: Templates Schema Updates

CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('marketing', 'utility', 'authentication')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    body TEXT NOT NULL,
    bsp_template_id TEXT, -- The ID given by the BSP upon submission
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies for message_templates
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their tenant's templates" ON message_templates;
CREATE POLICY "Users can view their tenant's templates"
ON message_templates FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can insert templates for their tenant" ON message_templates;
CREATE POLICY "Users can insert templates for their tenant"
ON message_templates FOR INSERT
TO authenticated
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
);
