create or replace function increment_usage(
  p_tenant_id uuid,
  p_messages_sent integer default 0,
  p_llm_calls integer default 0,
  p_stt_minutes numeric default 0
) returns void as $$
declare
  v_billing_period date;
begin
  -- Get the first day of the current month
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
    stt_minutes = usage_tracking.stt_minutes + excluded.stt_minutes,
    updated_at = now(); -- Assuming there's no updated_at column in schema, wait let me check schema! Ah, there is no updated_at in usage_tracking, let me remove it.
end;
$$ language plpgsql security definer;

-- Remove updated_at from the ON CONFLICT since it doesn't exist
create or replace function increment_usage(
  p_tenant_id uuid,
  p_messages_sent integer default 0,
  p_llm_calls integer default 0,
  p_stt_minutes numeric default 0
) returns void as $$
declare
  v_billing_period date;
begin
  -- Get the first day of the current month
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
