-- Usage Tracking Increment RPC
-- Safely handles concurrent counter updates using ON CONFLICT upsert.
create or replace function increment_usage(
  p_tenant_id uuid,
  p_messages_sent integer default 0,
  p_llm_calls integer default 0,
  p_stt_minutes numeric default 0
) returns void as $$
declare
  v_billing_period date;
begin
  v_billing_period := date_trunc('month', current_date)::date;

  insert into usage_tracking (
    tenant_id, 
    billing_period, 
    messages_sent, 
    llm_calls, 
    stt_minutes
  ) values (
    p_tenant_id, 
    v_billing_period, 
    p_messages_sent, 
    p_llm_calls, 
    p_stt_minutes
  )
  on conflict (tenant_id, billing_period)
  do update set 
    messages_sent = usage_tracking.messages_sent + excluded.messages_sent,
    llm_calls = usage_tracking.llm_calls + excluded.llm_calls,
    stt_minutes = usage_tracking.stt_minutes + excluded.stt_minutes;
end;
$$ language plpgsql security definer;
