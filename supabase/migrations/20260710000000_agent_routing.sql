-- Phase 16: Advanced Agent Routing Schema Updates

-- Add departments to tenant_users to assign skills to agents
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS departments text[] DEFAULT '{}'::text[];

-- Add department to conversations for routing
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS department text DEFAULT 'general';
