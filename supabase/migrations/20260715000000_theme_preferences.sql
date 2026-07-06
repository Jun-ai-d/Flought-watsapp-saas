-- Add preferences JSONB column to tenant_users to store theme settings
alter table tenant_users add column if not exists preferences jsonb default '{}'::jsonb;
