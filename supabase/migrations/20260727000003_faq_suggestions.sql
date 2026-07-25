-- FAQ suggestion workflow: source tracking, review flags, draft-only auto-miner inserts.

ALTER TABLE public.faqs
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual'
    CHECK (source IN ('manual', 'auto_miner')),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;

-- Draft suggestions must not consume trial FAQ quota
CREATE OR REPLACE FUNCTION public.increment_faq_count()
RETURNS TRIGGER AS $$
BEGIN
  IF coalesce(NEW.status, 'published') = 'published' THEN
    UPDATE public.tenants SET trial_faq_count = trial_faq_count + 1 WHERE id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.decrement_faq_count()
RETURNS TRIGGER AS $$
BEGIN
  IF coalesce(OLD.status, 'published') = 'published' THEN
    UPDATE public.tenants SET trial_faq_count = GREATEST(0, trial_faq_count - 1) WHERE id = OLD.tenant_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Keep trial_faq_count in sync when draft ↔ published
CREATE OR REPLACE FUNCTION public.sync_faq_count_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF coalesce(OLD.status, 'published') != 'published' AND coalesce(NEW.status, 'published') = 'published' THEN
    UPDATE public.tenants SET trial_faq_count = trial_faq_count + 1 WHERE id = NEW.tenant_id;
  ELSIF coalesce(OLD.status, 'published') = 'published' AND coalesce(NEW.status, 'published') != 'published' THEN
    UPDATE public.tenants SET trial_faq_count = GREATEST(0, trial_faq_count - 1) WHERE id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS faq_status_count_trigger ON public.faqs;
CREATE TRIGGER faq_status_count_trigger
  AFTER UPDATE OF status ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.sync_faq_count_on_status_change();

CREATE OR REPLACE FUNCTION public.check_faq_limit_on_publish()
RETURNS TRIGGER AS $$
DECLARE
  v_plan TEXT;
  v_count INT;
BEGIN
  IF coalesce(OLD.status, 'published') = 'published' OR coalesce(NEW.status, 'published') != 'published' THEN
    RETURN NEW;
  END IF;

  SELECT plan_type, trial_faq_count INTO v_plan, v_count FROM public.tenants WHERE id = NEW.tenant_id;
  IF v_plan = 'trial' AND v_count >= 10 THEN
    RAISE EXCEPTION 'Upgrade to add more FAQs';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS check_faq_publish_limit_trigger ON public.faqs;
CREATE TRIGGER check_faq_publish_limit_trigger
  BEFORE UPDATE OF status ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.check_faq_limit_on_publish();
