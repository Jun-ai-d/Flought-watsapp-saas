-- Migration: Atomic Quota Reservation
-- Replaces TOCTOU vulnerable check_tenant_quota with atomic lock and decrement

CREATE OR REPLACE FUNCTION reserve_tenant_quota(p_tenant_id uuid)
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

  IF v_cap_messages IS NULL THEN
    RETURN FALSE;
  END IF;

  v_billing_period := date_trunc('month', current_date)::date;

  -- 2. Ensure row exists so we can lock it
  INSERT INTO usage_tracking (tenant_id, billing_period, messages_sent, llm_calls, stt_minutes)
  VALUES (p_tenant_id, v_billing_period, 0, 0, 0)
  ON CONFLICT DO NOTHING;

  -- 3. Lock the row for update (prevents concurrent checks from reading stale data)
  SELECT messages_sent INTO v_used_messages
  FROM usage_tracking
  WHERE tenant_id = p_tenant_id
    AND billing_period = v_billing_period
  FOR UPDATE;

  -- 4. Check quota and atomically reserve
  IF v_used_messages >= v_cap_messages THEN
    RETURN FALSE;
  ELSE
    -- Reserve one message slot
    UPDATE usage_tracking 
    SET messages_sent = messages_sent + 1 
    WHERE tenant_id = p_tenant_id 
      AND billing_period = v_billing_period;
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expose to API if necessary
ALTER FUNCTION public.reserve_tenant_quota(uuid) SET search_path = '';

CREATE OR REPLACE FUNCTION refund_tenant_quota(p_tenant_id uuid)
RETURNS void AS $$
DECLARE
  v_billing_period date;
BEGIN
  v_billing_period := date_trunc('month', current_date)::date;
  
  UPDATE usage_tracking 
  SET messages_sent = GREATEST(0, messages_sent - 1)
  WHERE tenant_id = p_tenant_id 
    AND billing_period = v_billing_period;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.refund_tenant_quota(uuid) SET search_path = '';
