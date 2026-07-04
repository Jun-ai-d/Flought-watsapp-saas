-- Phase 9: Elevate yourself to Platform Admin
-- Run this in your Supabase SQL Editor.
-- Replace 'YOUR_EMAIL_HERE' with the email you use to log in.

INSERT INTO platform_admins (user_id)
SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL_HERE'
ON CONFLICT (user_id) DO NOTHING;
