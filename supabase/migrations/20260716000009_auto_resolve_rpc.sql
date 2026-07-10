-- Migration: Auto Resolve Stale Conversations RPC

CREATE OR REPLACE FUNCTION auto_resolve_stale_conversations()
RETURNS void AS $$
BEGIN
  -- Auto-resolve handover_active conversations inactive for 24 hours
  UPDATE conversations 
  SET 
    status = 'resolved',
    resolved_at = NOW(),
    updated_at = NOW()
  WHERE 
    status = 'handover_active' 
    AND updated_at < NOW() - INTERVAL '24 hours';

  -- Escalate handover_pending conversations unclaimed for 24 hours
  -- (We just mark them as escalated here, a separate system or webhook could alert the admin)
  -- For now, we will just log or resolve them if no one claims them, but let's just resolve them 
  -- with a note so they don't sit in the queue forever.
  UPDATE conversations 
  SET 
    status = 'resolved',
    handover_summary = handover_summary || ' [Auto-closed: Unclaimed for 24 hours]',
    resolved_at = NOW(),
    updated_at = NOW()
  WHERE 
    status = 'handover_pending' 
    AND updated_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.auto_resolve_stale_conversations() SET search_path = '';
