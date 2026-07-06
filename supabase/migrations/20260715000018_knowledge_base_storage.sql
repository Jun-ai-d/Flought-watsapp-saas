-- Add file_path to track the physical file in storage
alter table public.knowledge_documents add column if not exists file_path text;

-- Create knowledge_base bucket if it doesn't exist
insert into storage.buckets (id, name, public) 
values ('knowledge_base', 'knowledge_base', false) 
on conflict (id) do nothing;

-- Enable RLS on storage objects if not already enabled
-- (Skipped as it causes permission errors on cloud instances and is already enabled by default)

-- Drop existing policies if any to avoid conflicts when re-running
drop policy if exists "Tenant members can upload knowledge base files" on storage.objects;
drop policy if exists "Tenant members can view knowledge base files" on storage.objects;
drop policy if exists "Tenant members can delete knowledge base files" on storage.objects;

-- RLS Policies for the bucket
-- Files are expected to be uploaded to paths like: {tenant_id}/{filename}

create policy "Tenant members can upload knowledge base files"
  on storage.objects for insert
  with check (
    bucket_id = 'knowledge_base' and
    (select public.is_tenant_member((string_to_array(name, '/'))[1]::uuid))
  );

create policy "Tenant members can view knowledge base files"
  on storage.objects for select
  using (
    bucket_id = 'knowledge_base' and
    (select public.is_tenant_member((string_to_array(name, '/'))[1]::uuid))
  );

create policy "Tenant members can delete knowledge base files"
  on storage.objects for delete
  using (
    bucket_id = 'knowledge_base' and
    (select public.is_tenant_member((string_to_array(name, '/'))[1]::uuid))
  );
