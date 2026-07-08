-- Migration to make tenant provisioning transactional

CREATE OR REPLACE FUNCTION provision_tenant(
  p_business_name text,
  p_region text,
  p_tier text,
  p_cap_messages int,
  p_price_inr numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
  v_result json;
BEGIN
  -- 1. Insert Tenant Record
  INSERT INTO public.tenants (business_name, region, tier, status)
  VALUES (p_business_name, p_region, p_tier, 'active')
  RETURNING id INTO v_tenant_id;

  -- 2. Create Subscription Placeholder
  INSERT INTO public.subscriptions (tenant_id, plan, cap_messages, price_inr, status)
  VALUES (v_tenant_id, p_tier, p_cap_messages, p_price_inr, 'active');

  -- Return tenant details
  SELECT row_to_json(t) INTO v_result
  FROM (
    SELECT id, business_name, region, tier, status, created_at
    FROM public.tenants
    WHERE id = v_tenant_id
  ) t;

  RETURN v_result;
END;
$$;
