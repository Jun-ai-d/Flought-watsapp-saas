-- Harden rotate_widget_token: only tenant admins may rotate.
CREATE OR REPLACE FUNCTION public.rotate_widget_token(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT public.is_tenant_admin(p_tenant_id) THEN
    RAISE EXCEPTION 'Unauthorized: tenant admin required';
  END IF;

  v_token := 'wgt_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.widget_tokens (tenant_id, token)
  VALUES (p_tenant_id, v_token)
  ON CONFLICT (tenant_id) DO UPDATE SET token = EXCLUDED.token, is_active = true;

  RETURN v_token;
END;
$$;
