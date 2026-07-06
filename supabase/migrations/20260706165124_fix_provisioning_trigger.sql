-- Fix missing price_inr column in subscriptions insert

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
        INSERT INTO public.subscriptions (tenant_id, status, plan, cap_messages, price_inr, created_at)
        VALUES (new_tenant_id, 'active', 'free', 100, 0.00, now());

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
