-- Trial expiry fixes: respect paid subscriptions in setup-cap triggers

CREATE OR REPLACE FUNCTION public.check_kb_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_plan TEXT;
  v_count INT;
  v_sub_plan TEXT;
BEGIN
  SELECT t.plan_type, t.trial_kb_doc_count, s.plan
  INTO v_plan, v_count, v_sub_plan
  FROM public.tenants t
  LEFT JOIN public.subscriptions s ON s.tenant_id = t.id AND s.status = 'active'
  WHERE t.id = NEW.tenant_id;

  -- Trial setup caps only when on trial without a paid subscription
  IF v_plan = 'trial' AND COALESCE(v_sub_plan, 'free') = 'free' AND v_count >= 1 THEN
    RAISE EXCEPTION 'Upgrade to add more documents';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_faq_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_plan TEXT;
  v_count INT;
  v_sub_plan TEXT;
BEGIN
  SELECT t.plan_type, t.trial_faq_count, s.plan
  INTO v_plan, v_count, v_sub_plan
  FROM public.tenants t
  LEFT JOIN public.subscriptions s ON s.tenant_id = t.id AND s.status = 'active'
  WHERE t.id = NEW.tenant_id;

  IF v_plan = 'trial' AND COALESCE(v_sub_plan, 'free') = 'free' AND v_count >= 10 THEN
    RAISE EXCEPTION 'Upgrade to add more FAQs';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill plan_type for tenants with active paid subscriptions stuck on trial
UPDATE public.tenants t
SET plan_type = s.plan
FROM public.subscriptions s
WHERE s.tenant_id = t.id
  AND s.status = 'active'
  AND s.plan IN ('standard', 'pro')
  AND t.plan_type = 'trial';
