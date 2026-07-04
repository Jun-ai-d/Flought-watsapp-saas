create table faqs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  question text not null,
  answer text not null,
  keywords text[],
  match_count integer default 0,        -- how often this FAQ resolved a query (feedback loop)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_faqs_tenant on faqs(tenant_id);
create index idx_faqs_keywords on faqs using gin(keywords);

create table knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  source_name text not null,
  uploaded_by uuid references auth.users(id),
  status text default 'processing' check (status in ('processing','ready','failed')),
  uploaded_at timestamptz default now()
);

create table knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references knowledge_documents(id) on delete cascade not null,
  tenant_id uuid references tenants(id) on delete cascade not null,
  content text not null,
  embedding vector(1536),              -- adjust dimension to chosen embedding model
  metadata jsonb default '{}',         -- {source, section, parent_chunk_id}
  created_at timestamptz default now()
);

create index idx_chunks_tenant on knowledge_chunks(tenant_id);
create index idx_chunks_document on knowledge_chunks(document_id);
create index idx_chunks_embedding on knowledge_chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table faqs enable row level security;
alter table knowledge_documents enable row level security;
alter table knowledge_chunks enable row level security;

create policy "tenant members manage their faqs"
  on faqs for all
  using (is_tenant_member(tenant_id));

create policy "tenant members manage their documents"
  on knowledge_documents for all
  using (is_tenant_member(tenant_id));

create policy "tenant members view their chunks"
  on knowledge_chunks for select
  using (is_tenant_member(tenant_id));
