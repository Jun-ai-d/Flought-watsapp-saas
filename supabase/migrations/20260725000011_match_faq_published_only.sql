-- FAQ RPC: ignore draft/rejected entries (only published FAQs auto-reply)
CREATE OR REPLACE FUNCTION match_faq(p_tenant_id uuid, p_query text)
RETURNS TABLE (faq_id uuid, answer text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT f.id, f.answer
  FROM faqs f, unnest(f.keywords) AS kw
  WHERE f.tenant_id = p_tenant_id
    AND coalesce(f.status, 'published') = 'published'
    AND p_query ILIKE '%' || trim(kw) || '%'
  LIMIT 1;
END;
$$;
