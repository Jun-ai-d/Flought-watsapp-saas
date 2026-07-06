-- Phase 18: Strict Billing Enforcement

-- RPC to check if a tenant has remaining quota for the current billing cycle
CREATE OR REPLACE FUNCTION check_tenant_quota(p_tenant_id uuid)
RETURNS boolean AS $$
DECLARE
  v_cap_messages integer;
  v_used_messages integer;
  v_billing_period date;
BEGIN
  -- 1. Get the tenant's current cap limit from subscriptions
  SELECT cap_messages INTO v_cap_messages 
  FROM subscriptions 
  WHERE tenant_id = p_tenant_id 
    AND status = 'active';

  -- If no active subscription or cap found, assume 0 limit (false)
  IF v_cap_messages IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 2. Get the current month's usage
  v_billing_period := date_trunc('month', current_date)::date;
  
  SELECT messages_sent INTO v_used_messages
  FROM usage_tracking
  WHERE tenant_id = p_tenant_id
    AND billing_period = v_billing_period;
    
  IF v_used_messages IS NULL THEN
    v_used_messages := 0;
  END IF;

  -- 3. Return true if there is quota remaining
  IF v_used_messages >= v_cap_messages THEN
    RETURN FALSE;
  ELSE
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
