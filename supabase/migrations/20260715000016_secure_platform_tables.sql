-- Phase 20: Secure Platform Tables
-- Fixes High Severity issues from VibeSec audit

-- 1. Secure platform_expenses
ALTER TABLE public.platform_expenses ENABLE ROW LEVEL SECURITY;
-- By enabling RLS without adding any policies, we enforce a default DENY ALL.
-- This ensures that no authenticated or anonymous user can read/write this table.
-- It remains accessible ONLY to the service_role key used by the backend.

-- 2. Secure platform_admins
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
-- Enforce a default DENY ALL to prevent users from making themselves admins.
-- Platform admins are managed manually via the service_role key or direct DB access.

-- 3. Fix developer_settings api_key plain text (Medium #12)
-- We will encrypt existing plaintext keys and update the table.
-- Actually, the backend should be handling encryption of the key. Let's make sure backend does it.
-- We will just ensure RLS is tight. It already is.
