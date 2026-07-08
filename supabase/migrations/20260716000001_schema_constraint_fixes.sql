-- Phase 1 and 3 schema fixes

-- Fix Audit Issue #3: Add 'growth' tier
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_tier_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_tier_check
  CHECK (tier IN ('standard', 'growth', 'vip'));

-- Fix Audit Issue #4: Add 'catalog' message type
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text','image','document','audio','template','interactive','catalog','order'));

-- Fix Audit Issue (from #7 context): Add 'widget' to bsp_provider
ALTER TABLE tenant_bsp_config DROP CONSTRAINT IF EXISTS tenant_bsp_config_bsp_provider_check;
ALTER TABLE tenant_bsp_config ADD CONSTRAINT tenant_bsp_config_bsp_provider_check
  CHECK (bsp_provider IN ('gupshup','twilio','360dialog','telnyx','meta','widget'));

-- Fix Audit Issue #13: Trial usage increment RPC to fix race condition
CREATE OR REPLACE FUNCTION increment_trial_usage(p_tenant_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.tenants
  SET trial_conversations_used = trial_conversations_used + 1
  WHERE id = p_tenant_id;
$$;

-- Phase 5.1: FAQ matching function
CREATE OR REPLACE FUNCTION match_faq(p_tenant_id uuid, p_query text)
RETURNS TABLE(id uuid, answer text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT f.id, f.answer
  FROM public.faqs f, unnest(f.keywords) kw
  WHERE f.tenant_id = p_tenant_id
    AND position(lower(trim(kw)) in lower(p_query)) > 0
    AND trim(kw) != ''
  LIMIT 1;
$$;

