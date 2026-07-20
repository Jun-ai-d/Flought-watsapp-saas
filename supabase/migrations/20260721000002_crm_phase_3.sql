-- Phase 3: CRM & Workflow Automation Schema

-- 1. Bot Flow Graphs (Visual Drag-and-Drop flow builder)
CREATE TABLE IF NOT EXISTS bot_flow_graphs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    nodes JSONB NOT NULL DEFAULT '[]'::jsonb, -- AST representation of flow nodes
    edges JSONB NOT NULL DEFAULT '[]'::jsonb, -- Connections between nodes
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flow_graphs_tenant ON bot_flow_graphs(tenant_id);

ALTER TABLE bot_flow_graphs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage tenant flow graphs"
ON bot_flow_graphs FOR ALL TO authenticated
USING (is_tenant_member(tenant_id));

-- 2. CRM Credentials
CREATE TABLE IF NOT EXISTS crm_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    crm_provider TEXT NOT NULL CHECK (crm_provider IN ('hubspot', 'salesforce', 'zoho')),
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    expires_at TIMESTAMPTZ,
    portal_id TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, crm_provider)
);

CREATE INDEX IF NOT EXISTS idx_crm_creds_tenant ON crm_credentials(tenant_id);

ALTER TABLE crm_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage tenant crm credentials"
ON crm_credentials FOR ALL TO authenticated
USING (is_tenant_member(tenant_id));

-- 3. Conversation Notes (Internal Mentions)
CREATE TABLE IF NOT EXISTS conversation_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_conv ON conversation_notes(conversation_id);

ALTER TABLE conversation_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read tenant notes"
ON conversation_notes FOR SELECT TO authenticated
USING (is_tenant_member(tenant_id));

CREATE POLICY "Users can insert tenant notes"
ON conversation_notes FOR INSERT TO authenticated
WITH CHECK (is_tenant_member(tenant_id));

-- 4. Add flow state to conversations table
ALTER TABLE conversations 
  ADD COLUMN IF NOT EXISTS active_flow_id uuid REFERENCES bot_flow_graphs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_node_id text,
  ADD COLUMN IF NOT EXISTS flow_state jsonb DEFAULT '{}';

COMMENT ON COLUMN conversations.active_flow_id IS 'The bot flow currently in progress for this conversation';
COMMENT ON COLUMN conversations.active_node_id IS 'The node ID the conversation is waiting at for user input';
COMMENT ON COLUMN conversations.flow_state IS 'Arbitrary state carried between flow nodes (e.g. collected form data)';
