-- 1. Add missing handover_reason column to conversations
ALTER TABLE conversations ADD COLUMN handover_reason text;

-- 2. Add unique constraint to prevent race condition duplicates
ALTER TABLE conversations ADD CONSTRAINT unique_tenant_phone UNIQUE (tenant_id, customer_phone);

-- 3. Create missing RPC to increment FAQ match count
CREATE OR REPLACE FUNCTION increment_faq_match(faq_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE faqs 
  SET match_count = COALESCE(match_count, 0) + 1 
  WHERE id = faq_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
