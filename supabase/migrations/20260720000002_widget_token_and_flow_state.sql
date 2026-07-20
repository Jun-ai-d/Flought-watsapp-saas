-- Migration: C-2 Widget token auth + H-8 Flow state tracking + H-9 Semantic cache RLS fix

-- ============================================================
-- C-2: Widget token table for secure widget authentication
-- ============================================================
CREATE TABLE IF NOT EXISTS public.widget_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_widget_tokens_token ON public.widget_tokens(token) WHERE is_active = true;

ALTER TABLE public.widget_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can manage widget tokens"
  ON public.widget_tokens FOR ALL
  USING (public.is_tenant_admin(tenant_id));

-- RPC for tenants to rotate their widget token
CREATE OR REPLACE FUNCTION public.rotate_widget_token(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := 'wgt_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.widget_tokens (tenant_id, token)
  VALUES (p_tenant_id, v_token)
  ON CONFLICT (tenant_id) DO UPDATE SET token = EXCLUDED.token;

  RETURN v_token;
END;
$$;

-- ============================================================
-- H-8: Conversation flow state tracking for multi-step flows
-- ============================================================



-- ============================================================
-- H-9: Fix semantic_cache RLS — tenant_id != auth.uid()
-- ============================================================
DROP POLICY IF EXISTS "Tenants can access own semantic cache" ON public.semantic_cache;

CREATE POLICY "Tenant members can access own semantic cache"
  ON public.semantic_cache FOR ALL
  USING (public.is_tenant_member(tenant_id));

-- ============================================================
-- M-6: Postgres advisory lock helper for pipeline concurrency
-- Used by Node.js pipeline to prevent multi-instance race conditions
-- ============================================================
CREATE OR REPLACE FUNCTION public.acquire_conversation_lock(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_try_advisory_xact_lock(hashtext(p_conversation_id::text));
$$;

-- ============================================================
-- M-16: Fix semantic_cache missing search_path on match function
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_semantic_cache(
  query_embedding vector(1536),
  match_threshold float,
  p_tenant_id uuid
)
RETURNS TABLE (
  id uuid,
  response text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.response,
    1 - (sc.query_embedding <=> query_embedding) AS similarity
  FROM public.semantic_cache sc
  WHERE sc.tenant_id = p_tenant_id
    AND 1 - (sc.query_embedding <=> query_embedding) > match_threshold
  ORDER BY sc.query_embedding <=> query_embedding
  LIMIT 1;
END;
$$;
