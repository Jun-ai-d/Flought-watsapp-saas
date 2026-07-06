-- Migration: Free Trial Tier
-- Adds plan types, trial counters, domain verification, and limit enforcement.

-- 1. Modify tenants table
ALTER TABLE public.tenants
ADD COLUMN plan_type TEXT DEFAULT 'trial',
ADD COLUMN trial_started_at TIMESTAMPTZ,
ADD COLUMN trial_expires_at TIMESTAMPTZ,
ADD COLUMN trial_conversations_used INTEGER DEFAULT 0,
ADD COLUMN trial_conversations_limit INTEGER DEFAULT 100,
ADD COLUMN trial_kb_doc_count INTEGER DEFAULT 0,
ADD COLUMN trial_faq_count INTEGER DEFAULT 0;

-- 2. Create trial_verifications table for dedupe
CREATE TABLE public.trial_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  business_domain TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.trial_verifications ENABLE ROW LEVEL SECURITY;

-- 3. RPC to check eligibility
CREATE OR REPLACE FUNCTION public.check_domain_eligibility(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_domain TEXT;
  v_exists BOOLEAN;
BEGIN
  v_domain := split_part(p_email, '@', 2);
  
  -- Allow public domains to have multiple trials
  IF v_domain IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com') THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.trial_verifications WHERE business_domain = v_domain
  ) INTO v_exists;

  RETURN NOT v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-write the user provisioning trigger to wait for email confirmation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    new_tenant_id UUID;
    v_domain TEXT;
BEGIN
    -- Only provision when email is confirmed
    IF (TG_OP = 'INSERT' AND NEW.email_confirmed_at IS NOT NULL) OR
       (TG_OP = 'UPDATE' AND NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL) THEN

        -- 1. Create a new tenant for the user (on Trial by default)
        INSERT INTO public.tenants (
            business_name, 
            plan_type,
            trial_started_at,
            trial_expires_at,
            created_at
        )
        VALUES (
            COALESCE(new.raw_user_meta_data->>'business_name', 'My Business'),
            'trial',
            now(),
            now() + interval '14 days',
            now()
        )
        RETURNING id INTO new_tenant_id;

        -- 2. Add the user as an admin to their new tenant
        INSERT INTO public.tenant_users (tenant_id, user_id, role, created_at)
        VALUES (new_tenant_id, new.id, 'admin', now());

        -- 3. Create a free-tier subscription record (legacy compatibility)
        INSERT INTO public.subscriptions (tenant_id, status, plan, cap_messages, created_at)
        VALUES (new_tenant_id, 'active', 'free', 100, now());

        -- 4. Record the domain to prevent duplicate trials (if not a public domain)
        v_domain := split_part(NEW.email, '@', 2);
        IF v_domain NOT IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com') THEN
            -- Ignore insert conflicts just in case two signups happen simultaneously
            INSERT INTO public.trial_verifications (tenant_id, business_domain)
            VALUES (new_tenant_id, v_domain)
            ON CONFLICT (business_domain) DO NOTHING;
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_confirmed
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Triggers to enforce KB and FAQ limits and increment counts
-- KB Documents
CREATE OR REPLACE FUNCTION public.check_kb_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_plan TEXT;
  v_count INT;
BEGIN
  SELECT plan_type, trial_kb_doc_count INTO v_plan, v_count FROM public.tenants WHERE id = NEW.tenant_id;
  IF v_plan = 'trial' AND v_count >= 1 THEN
    RAISE EXCEPTION 'Upgrade to add more documents';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_kb_limit_trigger
  BEFORE INSERT ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.check_kb_limit();

CREATE OR REPLACE FUNCTION public.increment_kb_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tenants SET trial_kb_doc_count = trial_kb_doc_count + 1 WHERE id = NEW.tenant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER increment_kb_count_trigger
  AFTER INSERT ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.increment_kb_count();

CREATE OR REPLACE FUNCTION public.decrement_kb_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tenants SET trial_kb_doc_count = GREATEST(0, trial_kb_doc_count - 1) WHERE id = OLD.tenant_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER decrement_kb_count_trigger
  AFTER DELETE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.decrement_kb_count();


-- FAQs
CREATE OR REPLACE FUNCTION public.check_faq_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_plan TEXT;
  v_count INT;
BEGIN
  SELECT plan_type, trial_faq_count INTO v_plan, v_count FROM public.tenants WHERE id = NEW.tenant_id;
  IF v_plan = 'trial' AND v_count >= 10 THEN
    RAISE EXCEPTION 'Upgrade to add more FAQs';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_faq_limit_trigger
  BEFORE INSERT ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.check_faq_limit();

CREATE OR REPLACE FUNCTION public.increment_faq_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tenants SET trial_faq_count = trial_faq_count + 1 WHERE id = NEW.tenant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER increment_faq_count_trigger
  AFTER INSERT ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.increment_faq_count();

CREATE OR REPLACE FUNCTION public.decrement_faq_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tenants SET trial_faq_count = GREATEST(0, trial_faq_count - 1) WHERE id = OLD.tenant_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER decrement_faq_count_trigger
  AFTER DELETE ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.decrement_faq_count();
