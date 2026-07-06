-- Migration: Platform Expenses

create table if not exists platform_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount_inr numeric(10,2) not null,
  created_at timestamptz default now()
);

-- Note: We do not enable RLS on platform_expenses because it is only accessed via the service_role key
-- by the platform admin dashboard in the Node backend. No direct client access is allowed.
