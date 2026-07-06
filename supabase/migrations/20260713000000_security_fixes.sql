-- Phase 19: Security & Code Review Fixes

-- 1. Prevent Privilege Escalation on tenants table
-- We drop the UPDATE policy so users cannot manipulate their own tier or status from the frontend.
-- All tenant updates (like business_name changes) must now go through a secure backend route 
-- that uses the service role key and explicitly filters allowed fields.
DROP POLICY IF EXISTS "admins can update their tenant" ON tenants;

-- 2. Add Missing RLS Policies for message_templates
-- Ensures users cannot update/delete templates of other tenants if they somehow bypass the backend.
DROP POLICY IF EXISTS "Users can update templates for their tenant" ON message_templates;
CREATE POLICY "Users can update templates for their tenant"
ON message_templates FOR UPDATE
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can delete templates for their tenant" ON message_templates;
CREATE POLICY "Users can delete templates for their tenant"
ON message_templates FOR DELETE
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
);

-- 3. Add Missing RLS Policies for drip_campaigns
DROP POLICY IF EXISTS "Users can update drip campaigns" ON drip_campaigns;
CREATE POLICY "Users can update drip campaigns"
ON drip_campaigns FOR UPDATE
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can delete drip campaigns" ON drip_campaigns;
CREATE POLICY "Users can delete drip campaigns"
ON drip_campaigns FOR DELETE
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
);

-- 4. Add Missing RLS Policies for drip_steps
DROP POLICY IF EXISTS "Users can update drip steps" ON drip_steps;
CREATE POLICY "Users can update drip steps"
ON drip_steps FOR UPDATE
TO authenticated
USING (
    campaign_id IN (
        SELECT id FROM drip_campaigns WHERE tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
        )
    )
)
WITH CHECK (
    campaign_id IN (
        SELECT id FROM drip_campaigns WHERE tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Users can delete drip steps" ON drip_steps;
CREATE POLICY "Users can delete drip steps"
ON drip_steps FOR DELETE
TO authenticated
USING (
    campaign_id IN (
        SELECT id FROM drip_campaigns WHERE tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
        )
    )
);

-- 5. Add Missing RLS Policies for drip_enrollments
DROP POLICY IF EXISTS "Users can update enrollments" ON drip_enrollments;
CREATE POLICY "Users can update enrollments"
ON drip_enrollments FOR UPDATE
TO authenticated
USING (
    campaign_id IN (
        SELECT id FROM drip_campaigns WHERE tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
        )
    )
)
WITH CHECK (
    campaign_id IN (
        SELECT id FROM drip_campaigns WHERE tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Users can delete enrollments" ON drip_enrollments;
CREATE POLICY "Users can delete enrollments"
ON drip_enrollments FOR DELETE
TO authenticated
USING (
    campaign_id IN (
        SELECT id FROM drip_campaigns WHERE tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
        )
    )
);
