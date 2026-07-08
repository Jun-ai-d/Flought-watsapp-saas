-- Fix privilege escalation vulnerability by securing search_path
create or replace function is_tenant_member(check_tenant_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.tenant_users
    where tenant_id = check_tenant_id and user_id = auth.uid()
  );
$$ language sql security definer set search_path = '' stable;

create or replace function is_tenant_admin(check_tenant_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.tenant_users
    where tenant_id = check_tenant_id and user_id = auth.uid() and role = 'admin'
  );
$$ language sql security definer set search_path = '' stable;
