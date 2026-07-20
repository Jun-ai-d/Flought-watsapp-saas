-- Phase 4 Remediation: Sweeping all SECURITY DEFINER functions to prevent search_path escalation vulnerabilities.
-- Best practice requires explicitly setting search_path = '' for all SECURITY DEFINER functions.

-- 1. process_inbound_message
ALTER FUNCTION public.process_inbound_message(text, text, text, text, text, text, text, text, timestamptz) SET search_path = '';

-- 2. increment_usage
ALTER FUNCTION public.increment_usage(uuid, integer, integer, numeric) SET search_path = '';

-- 3. handle_new_user (Trigger function)
ALTER FUNCTION public.handle_new_user() SET search_path = '';



-- 5. check_tenant_quota
ALTER FUNCTION public.check_tenant_quota(uuid) SET search_path = '';

-- 6. get_dashboard_metrics (v1)
ALTER FUNCTION public.get_dashboard_metrics(uuid) SET search_path = '';

-- 7. sync_contact_on_message (Trigger function)
ALTER FUNCTION public.sync_contact_on_message() SET search_path = '';

-- 8. get_top_topics
ALTER FUNCTION public.get_top_topics(uuid, text) SET search_path = '';

-- 9. get_admin_metrics
ALTER FUNCTION public.get_admin_metrics(text) SET search_path = '';

-- 10. get_tenant_details
ALTER FUNCTION public.get_tenant_details(uuid) SET search_path = '';

-- 11. get_dashboard_metrics_v2
ALTER FUNCTION public.get_dashboard_metrics_v2(uuid, text) SET search_path = '';

-- 12. check_kb_limit (Trigger function)
ALTER FUNCTION public.check_kb_limit() SET search_path = '';

-- 13. increment_kb_count (Trigger function)
ALTER FUNCTION public.increment_kb_count() SET search_path = '';

-- 14. decrement_kb_count (Trigger function)
ALTER FUNCTION public.decrement_kb_count() SET search_path = '';

-- 15. check_faq_limit (Trigger function)
ALTER FUNCTION public.check_faq_limit() SET search_path = '';

-- 16. increment_faq_count (Trigger function)
ALTER FUNCTION public.increment_faq_count() SET search_path = '';

-- 17. decrement_faq_count (Trigger function)
ALTER FUNCTION public.decrement_faq_count() SET search_path = '';

-- 18. provision_tenant
ALTER FUNCTION public.provision_tenant(uuid, text, text, uuid, text, numeric, integer, integer) SET search_path = '';
