-- Optimization: Improve get_dashboard_metrics performance and separate AI vs Agent response times
-- Fixes latency on the SaaS dashboard and provides accurate separated metrics.

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_tenant_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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
  v_avg_ai_response_time INT;
  v_avg_agent_response_time INT;
BEGIN
  -- Total messages
  SELECT COUNT(*) INTO v_total_messages 
  FROM public.messages 
  WHERE tenant_id = p_tenant_id;
  
  -- Bot handled count (from conversations resolved without an assigned agent)
  SELECT COUNT(*) INTO v_bot_handled_count 
  FROM public.conversations 
  WHERE tenant_id = p_tenant_id 
    AND status = 'resolved' 
    AND assigned_agent_id IS NULL;
    
  -- FAQ match total
  SELECT COALESCE(SUM(match_count), 0) INTO v_faq_match_total 
  FROM public.faqs 
  WHERE tenant_id = p_tenant_id;
  
  -- Handover count
  SELECT COUNT(*) INTO v_handover_count 
  FROM public.conversations 
  WHERE tenant_id = p_tenant_id 
    AND status IN ('handover_pending', 'handover_active');
    
  -- Recent handovers (up to 5)
  SELECT COALESCE(json_agg(row_to_json(rh)), '[]'::json) INTO v_recent_handovers
  FROM (
    SELECT id, customer_phone, last_message_at, status, handover_reason
    FROM public.conversations
    WHERE tenant_id = p_tenant_id
      AND status = 'handover_pending'
    ORDER BY last_message_at DESC
    LIMIT 5
  ) rh;
  
  -- Pre-calculate response times for last 7 days to avoid repeated full table scans
  CREATE TEMP TABLE IF NOT EXISTS temp_resp_times (
    d DATE,
    sender TEXT,
    resp_time NUMERIC
  ) ON COMMIT DROP;
  
  -- Clear temp table in case of pooled connections
  DELETE FROM temp_resp_times;
  
  INSERT INTO temp_resp_times
  SELECT 
      inbound.created_at::date as d,
      outbound.sender,
      EXTRACT(EPOCH FROM (outbound.created_at - inbound.created_at)) as resp_time
  FROM (
      SELECT conversation_id, created_at
      FROM public.messages
      WHERE tenant_id = p_tenant_id 
      AND direction = 'inbound'
      AND created_at >= (current_date - interval '7 days')
  ) inbound
  JOIN LATERAL (
      SELECT created_at, sender
      FROM public.messages
      WHERE conversation_id = inbound.conversation_id 
      AND direction = 'outbound' 
      AND created_at > inbound.created_at
      ORDER BY created_at ASC
      LIMIT 1
  ) outbound ON true;

  -- Overall averages
  SELECT 
      COALESCE(AVG(CASE WHEN sender = 'bot' THEN resp_time END), 0)::int,
      COALESCE(AVG(CASE WHEN sender = 'agent' THEN resp_time END), 0)::int
  INTO v_avg_ai_response_time, v_avg_agent_response_time
  FROM temp_resp_times;

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
      COALESCE(SUM(CASE WHEN m.sender = 'bot' THEN 1 ELSE 0 END), 0)::int AS "botHandled",
      COALESCE((SELECT AVG(resp_time) FROM temp_resp_times rt WHERE rt.d = d.d AND rt.sender = 'agent'), 0)::int AS "agentResponseTime",
      COALESCE((SELECT AVG(resp_time) FROM temp_resp_times rt WHERE rt.d = d.d AND rt.sender = 'bot'), 0)::int AS "aiResponseTime"
    FROM dates d
    LEFT JOIN public.messages m 
      ON m.tenant_id = p_tenant_id 
      AND m.created_at >= d.d
      AND m.created_at < (d.d + interval '1 day')
    GROUP BY d.d
    ORDER BY d.d ASC
  ) ts;
  
  -- Topic Distribution
  SELECT COALESCE(json_agg(td), '[]'::json) INTO v_topic_distribution
  FROM (
    SELECT topic as name, COUNT(*) as value
    FROM public.conversation_topics
    WHERE tenant_id = p_tenant_id
    GROUP BY topic
    ORDER BY value DESC
    LIMIT 6
  ) td;

  -- Current Usage
  SELECT COALESCE(
    (
      SELECT row_to_json(ut)
      FROM public.usage_tracking ut
      WHERE tenant_id = p_tenant_id AND billing_period = date_trunc('month', current_date)::date
    ),
    '{"messages_sent":0,"llm_calls":0,"stt_minutes":0}'::json
  ) INTO v_current_usage;

  RETURN json_build_object(
    'totalMessages', v_total_messages,
    'botHandledCount', v_bot_handled_count,
    'faqMatchTotal', v_faq_match_total,
    'handoverCount', v_handover_count,
    'recentHandovers', v_recent_handovers,
    'timeSeries', v_time_series,
    'topicDistribution', v_topic_distribution,
    'currentUsage', v_current_usage,
    'avgAiResponseTime', v_avg_ai_response_time,
    'avgAgentResponseTime', v_avg_agent_response_time
  );
END;
$$;
