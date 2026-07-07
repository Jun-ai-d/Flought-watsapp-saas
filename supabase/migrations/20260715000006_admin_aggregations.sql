-- Create RPC to get total MRR (sum of active subscriptions)
CREATE OR REPLACE FUNCTION get_total_mrr()
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(price_inr), 0)
  FROM public.subscriptions
  WHERE status = 'active';
$$;

-- Create RPC to get total usage for a billing period
CREATE OR REPLACE FUNCTION get_total_usage(p_billing_period text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'total_messages_sent', COALESCE(SUM(messages_sent), 0),
    'total_llm_calls', COALESCE(SUM(llm_calls), 0),
    'total_stt_minutes', COALESCE(SUM(stt_minutes), 0)
  )
  FROM public.usage_tracking
  WHERE billing_period = p_billing_period::date;
$$;
