-- B3: Deny anonymous direct reads of widget_configurations; embed uses token APIs instead.
DROP POLICY IF EXISTS "Public read widget config" ON widget_configurations;

CREATE POLICY "Authenticated tenant members read widget config"
ON widget_configurations FOR SELECT TO authenticated
USING (is_tenant_member(tenant_id));
