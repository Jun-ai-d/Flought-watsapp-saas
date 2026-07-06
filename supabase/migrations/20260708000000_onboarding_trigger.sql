-- Phase 14: Automated Tenant Provisioning Trigger

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    new_tenant_id UUID;
BEGIN
    -- 1. Create a new tenant for the user
    INSERT INTO public.tenants (business_name, created_at)
    VALUES (
        COALESCE(new.raw_user_meta_data->>'business_name', 'My Business'),
        now()
    )
    RETURNING id INTO new_tenant_id;

    -- 2. Add the user as an admin to their new tenant
    INSERT INTO public.tenant_users (tenant_id, user_id, role, created_at)
    VALUES (new_tenant_id, new.id, 'admin', now());

    -- 3. Create a free-tier subscription record
    INSERT INTO public.subscriptions (tenant_id, status, plan, cap_messages, created_at)
    VALUES (new_tenant_id, 'active', 'free', 100, now());

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
-- Note: Supabase auth.users is in a separate schema.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
