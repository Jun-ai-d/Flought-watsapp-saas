-- Update dashboard metrics to include usage and avg response time

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
  v_topic_distribution JSON;
  v_current_usage JSON;
  v_avg_response_time TEXT;
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
      COALESCE(SUM(CASE WHEN m.sender = 'bot' THEN 1 ELSE 0 END), 0)::int AS "botHandled"
    FROM dates d
    LEFT JOIN messages m 
      ON m.tenant_id = p_tenant_id 
      AND m.created_at::date = d.d
    GROUP BY d.d
    ORDER BY d.d ASC
  ) ts;
  
  -- Topic Distribution
  SELECT COALESCE(json_agg(td), '[]'::json) INTO v_topic_distribution
  FROM (
    SELECT topic as name, COUNT(*) as value
    FROM conversation_topics
    WHERE tenant_id = p_tenant_id
    GROUP BY topic
    ORDER BY value DESC
    LIMIT 6
  ) td;

  -- Current Usage
  SELECT COALESCE(
    (
      SELECT row_to_json(ut)
      FROM usage_tracking ut
      WHERE tenant_id = p_tenant_id AND billing_period = date_trunc('month', current_date)::date
    ),
    '{"messages_sent":0,"llm_calls":0,"stt_minutes":0}'::json
  ) INTO v_current_usage;

  -- Avg Response Time (LATERAL join for the very next outbound message)
  SELECT COALESCE(
    TO_CHAR(
      (AVG(EXTRACT(EPOCH FROM (outbound.created_at - inbound.created_at))) || ' second')::interval,
      'MI:SS'
    ),
    '00:00'
  ) INTO v_avg_response_time
  FROM (
    SELECT conversation_id, created_at
    FROM messages
    WHERE tenant_id = p_tenant_id AND direction = 'inbound'
  ) inbound
  JOIN LATERAL (
    SELECT created_at
    FROM messages
    WHERE conversation_id = inbound.conversation_id AND direction = 'outbound' AND created_at > inbound.created_at
    ORDER BY created_at ASC
    LIMIT 1
  ) outbound ON true;
  
  RETURN json_build_object(
    'totalMessages', v_total_messages,
    'botHandledCount', v_bot_handled_count,
    'faqMatchTotal', v_faq_match_total,
    'handoverCount', v_handover_count,
    'recentHandovers', v_recent_handovers,
    'timeSeries', v_time_series,
    'topicDistribution', v_topic_distribution,
    'currentUsage', v_current_usage,
    'avgResponseTime', v_avg_response_time
  );
END;
$$;
