-- Phase 1: Marketing & Webhooks Foundation

-- 1. Add attributes to contacts for deep segmentation
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb;

-- 2. Broadcasts Table
CREATE TABLE IF NOT EXISTS broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'processing', 'completed', 'failed')),
    template_name TEXT NOT NULL,
    audience_filter JSONB, -- Stores the segmentation rules (e.g., {"tags": ["VIP"], "city": "Delhi"})
    scheduled_at TIMESTAMPTZ,
    total_recipients INTEGER DEFAULT 0,
    successful_sends INTEGER DEFAULT 0,
    failed_sends INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_tenant ON broadcasts(tenant_id);

ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their tenant's broadcasts"
ON broadcasts FOR ALL TO authenticated
USING (is_tenant_member(tenant_id));

-- 3. Webhook Subscriptions Table (for Zapier/Make integrations)
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}', -- e.g., ['message.received', 'contact.created', 'order.placed']
    secret TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_subs_tenant ON webhook_subscriptions(tenant_id);

ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their tenant's webhook subscriptions"
ON webhook_subscriptions FOR ALL TO authenticated
USING (is_tenant_member(tenant_id));

-- Helper RPC for matching audience
CREATE OR REPLACE FUNCTION get_broadcast_audience(p_tenant_id uuid, p_tags text[] DEFAULT NULL)
RETURNS TABLE(contact_id uuid, phone_number text, name text, attributes jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_tags IS NULL OR array_length(p_tags, 1) IS NULL THEN
    RETURN QUERY SELECT c.id, c.phone_number, c.name, c.attributes 
                 FROM contacts c WHERE c.tenant_id = p_tenant_id;
  ELSE
    RETURN QUERY SELECT c.id, c.phone_number, c.name, c.attributes 
                 FROM contacts c WHERE c.tenant_id = p_tenant_id AND c.tags && p_tags;
  END IF;
END;
$$;

-- RPCs for worker tracking
CREATE OR REPLACE FUNCTION increment_broadcast_success(p_broadcast_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE broadcasts 
  SET successful_sends = successful_sends + 1
  WHERE id = p_broadcast_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_broadcast_failure(p_broadcast_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE broadcasts 
  SET failed_sends = failed_sends + 1
  WHERE id = p_broadcast_id;
END;
$$;
