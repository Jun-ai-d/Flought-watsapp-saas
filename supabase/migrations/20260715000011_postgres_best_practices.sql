-- Phase 1: Foreign Key Indexes (schema-foreign-key-indexes.md)
-- Missing indexes on drip campaigns
CREATE INDEX IF NOT EXISTS idx_drip_campaigns_tenant ON drip_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drip_steps_campaign ON drip_steps(campaign_id);
CREATE INDEX IF NOT EXISTS idx_drip_steps_template ON drip_steps(template_id);
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_campaign ON drip_enrollments(campaign_id);

-- Missing indexes on knowledge base
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_uploaded_by ON knowledge_documents(uploaded_by);

-- Missing indexes on audit logs
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_user_id);

-- Missing index on conversations
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(assigned_agent_id);


-- Phase 2: RLS Performance (security-rls-performance.md)
-- Rewrite RLS policies to use scalar subquery caching
-- e.g. using ((select is_tenant_member(tenant_id))) instead of using (is_tenant_member(tenant_id))

-- Dropping old policies for conversations:
DROP POLICY IF EXISTS "tenant members can view their conversations" ON conversations;
DROP POLICY IF EXISTS "tenant members can update their conversations" ON conversations;
CREATE POLICY "tenant members can view their conversations" ON conversations FOR SELECT USING ((select is_tenant_member(tenant_id)));
CREATE POLICY "tenant members can update their conversations" ON conversations FOR UPDATE USING ((select is_tenant_member(tenant_id)));

-- Dropping old policies for messages:
DROP POLICY IF EXISTS "tenant members can view their messages" ON messages;
CREATE POLICY "tenant members can view their messages" ON messages FOR SELECT USING ((select is_tenant_member(tenant_id)));

-- Dropping old policies for contacts:
DROP POLICY IF EXISTS "tenant members can manage their contacts" ON contacts;
CREATE POLICY "tenant members can manage their contacts" ON contacts FOR ALL USING ((select is_tenant_member(tenant_id)));

-- Dropping old policies for drip_enrollments:
DROP POLICY IF EXISTS "Users can view enrollments" ON drip_enrollments;
DROP POLICY IF EXISTS "Users can insert enrollments" ON drip_enrollments;
DROP POLICY IF EXISTS "Users can update enrollments" ON drip_enrollments;
DROP POLICY IF EXISTS "Users can delete enrollments" ON drip_enrollments;

CREATE POLICY "Users can view enrollments" ON drip_enrollments FOR SELECT USING ((select is_tenant_member((select tenant_id from drip_campaigns where id = campaign_id))));
CREATE POLICY "Users can insert enrollments" ON drip_enrollments FOR INSERT WITH CHECK ((select is_tenant_member((select tenant_id from drip_campaigns where id = campaign_id))));
CREATE POLICY "Users can update enrollments" ON drip_enrollments FOR UPDATE USING ((select is_tenant_member((select tenant_id from drip_campaigns where id = campaign_id))));
CREATE POLICY "Users can delete enrollments" ON drip_enrollments FOR DELETE USING ((select is_tenant_member((select tenant_id from drip_campaigns where id = campaign_id))));
