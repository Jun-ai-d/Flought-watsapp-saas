CREATE OR REPLACE FUNCTION get_dashboard_metrics(p_tenant_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_messages BIGINT;
  v_bot_handled_count BIGINT;
  v_faq_match_total BIGINT;
  v_handover_count BIGINT;
  v_recent_handovers JSON;
  v_time_series JSON;
BEGIN
  -- Total messages
  SELECT COUNT(*) INTO v_total_messages 
  FROM messages 
  WHERE tenant_id = p_tenant_id;
  
  -- Bot handled count (from conversations resolved without an assigned agent)
  SELECT COUNT(*) INTO v_bot_handled_count 
  FROM conversations 
  WHERE tenant_id = p_tenant_id 
    AND status = 'resolved' 
    AND assigned_agent_id IS NULL;
    
  -- FAQ match total
  SELECT COALESCE(SUM(match_count), 0) INTO v_faq_match_total 
  FROM faqs 
  WHERE tenant_id = p_tenant_id;
  
  -- Handover count
  SELECT COUNT(*) INTO v_handover_count 
  FROM conversations 
  WHERE tenant_id = p_tenant_id 
    AND status IN ('handover_pending', 'handover_active');
    
  -- Recent handovers (up to 5)
  SELECT COALESCE(json_agg(row_to_json(rh)), '[]'::json) INTO v_recent_handovers
  FROM (
    SELECT id, customer_phone, last_message_at, status, handover_reason
    FROM conversations
    WHERE tenant_id = p_tenant_id
      AND status = 'handover_pending'
    ORDER BY last_message_at DESC
    LIMIT 5
  ) rh;
  
  -- Time series (last 7 days)
  SELECT COALESCE(json_agg(ts), '[]'::json) INTO v_time_series
  FROM (
    WITH dates AS (
      SELECT generate_series(
        current_date - interval '6 days',
        current_date,
        interval '1 day'
      )::date AS d
    )
    SELECT 
      to_char(d.d, 'Dy') AS name,
      d.d::text AS "fullDate",
      COALESCE(SUM(CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS messages,
      COALESCE(SUM(CASE WHEN m.sender_type = 'bot' THEN 1 ELSE 0 END), 0)::int AS "botHandled"
    FROM dates d
    LEFT JOIN messages m 
      ON m.tenant_id = p_tenant_id 
      AND m.created_at::date = d.d
    GROUP BY d.d
    ORDER BY d.d ASC
  ) ts;
  
  RETURN json_build_object(
    'totalMessages', v_total_messages,
    'botHandledCount', v_bot_handled_count,
    'faqMatchTotal', v_faq_match_total,
    'handoverCount', v_handover_count,
    'recentHandovers', v_recent_handovers,
    'timeSeries', v_time_series
  );
END;
$$;
