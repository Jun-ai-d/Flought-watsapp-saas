-- ensure_widget_token: create token if missing (idempotent)
CREATE OR REPLACE FUNCTION public.ensure_widget_token(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT public.is_tenant_admin(p_tenant_id) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT token INTO v_token
  FROM public.widget_tokens
  WHERE tenant_id = p_tenant_id AND is_active = true;

  IF v_token IS NOT NULL THEN
    RETURN v_token;
  END IF;

  v_token := 'wgt_' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.widget_tokens (tenant_id, token)
  VALUES (p_tenant_id, v_token)
  ON CONFLICT (tenant_id) DO UPDATE SET token = EXCLUDED.token, is_active = true;

  RETURN v_token;
END;
$$;

-- Reconcile trial_kb_doc_count with actual document rows
CREATE OR REPLACE FUNCTION public.reconcile_trial_kb_doc_count(p_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actual integer;
BEGIN
  IF NOT public.is_tenant_member(p_tenant_id) THEN
    RAISE EXCEPTION 'Not a tenant member';
  END IF;

  SELECT count(*)::integer INTO v_actual
  FROM public.knowledge_documents
  WHERE tenant_id = p_tenant_id;

  UPDATE public.tenants
  SET trial_kb_doc_count = v_actual
  WHERE id = p_tenant_id;

  RETURN v_actual;
END;
$$;
