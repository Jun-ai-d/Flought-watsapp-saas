

-- MIGRATION: 20260704000001_tenants_and_users.sql
create extension if not exists "uuid-ossp";
create extension if not exists vector;
create extension if not exists pgcrypto;

create table tenants (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  vertical text,                     -- nullable, populated once specialization begins
  region text not null default 'IN',
  tier text not null default 'standard' check (tier in ('standard','vip')),
  status text not null default 'onboarding'
    check (status in ('onboarding','active','suspended','churned')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'agent' check (role in ('admin','agent')),
  created_at timestamptz default now(),
  unique (tenant_id, user_id)
);

create index idx_tenant_users_tenant on tenant_users(tenant_id);
create index idx_tenant_users_user on tenant_users(user_id);

alter table tenants enable row level security;
alter table tenant_users enable row level security;

-- Helper function: does the current user belong to this tenant?
create or replace function is_tenant_member(check_tenant_id uuid)
returns boolean as $$
  select exists (
    select 1 from tenant_users
    where tenant_id = check_tenant_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- Helper: is the current user an admin of this tenant?
create or replace function is_tenant_admin(check_tenant_id uuid)
returns boolean as $$
  select exists (
    select 1 from tenant_users
    where tenant_id = check_tenant_id and user_id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

create policy "members can view their tenant"
  on tenants for select
  using (is_tenant_member(id));

create policy "admins can update their tenant"
  on tenants for update
  using (is_tenant_admin(id));

create policy "members can view their own tenant_users rows"
  on tenant_users for select
  using (is_tenant_member(tenant_id));

create policy "admins can manage tenant_users"
  on tenant_users for all
  using (is_tenant_admin(tenant_id));


-- MIGRATION: 20260704000002_tenant_bsp_config.sql
create table tenant_bsp_config (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null unique,
  bsp_provider text not null check (bsp_provider in ('gupshup','twilio','360dialog','telnyx')),
  waba_id text not null,
  phone_number_id text not null,
  access_token_encrypted text not null,  -- encrypt via pgcrypto pgp_sym_encrypt before insert
  webhook_verify_token text not null,
  tier text not null default 'standard' check (tier in ('standard','vip')),
  region text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create index idx_bsp_config_waba on tenant_bsp_config(waba_id);
create index idx_bsp_config_tenant on tenant_bsp_config(tenant_id);
create index idx_bsp_config_provider on tenant_bsp_config(bsp_provider);

alter table tenant_bsp_config enable row level security;

create policy "admins can view own bsp config"
  on tenant_bsp_config for select
  using (is_tenant_admin(tenant_id));

-- No client-side insert/update policy: BSP config changes go through
-- service-role Edge Functions only (platform-admin controlled), never directly
-- from tenant dashboard client code.


-- MIGRATION: 20260704000003_conversations_and_messages.sql
create table conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  serial_number bigserial,             -- human-facing "No. 00482" per design direction
  customer_phone text not null,
  customer_name text,
  status text not null default 'bot'
    check (status in ('bot','handover_pending','handover_active','resolved')),
  assigned_agent_id uuid references auth.users(id),
  last_customer_message_at timestamptz,
  last_message_at timestamptz default now(),
  service_window_expires_at timestamptz,  -- 24hr free-form window tracker
  created_at timestamptz default now()
);

create index idx_conversations_tenant on conversations(tenant_id);
create index idx_conversations_status on conversations(tenant_id, status);
create index idx_conversations_phone on conversations(tenant_id, customer_phone);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  tenant_id uuid references tenants(id) on delete cascade not null,
  direction text not null check (direction in ('inbound','outbound')),
  message_type text not null check (message_type in ('text','image','document','audio','template','interactive')),
  content text,
  media_url text,
  transcript text,                     -- populated for audio via STT
  category text check (category in ('marketing','utility','authentication','service')),
  wa_message_id text unique,           -- dedup key, per TRD §4
  sender text check (sender in ('customer','bot','agent')),
  llm_model_used text,                 -- audit trail: which model generated this, if any
  retrieved_chunk_ids uuid[],          -- audit trail: which RAG chunks grounded this reply
  created_at timestamptz default now()
);

create index idx_messages_conversation on messages(conversation_id);
create index idx_messages_tenant on messages(tenant_id);
create index idx_messages_wa_id on messages(wa_message_id);

alter table conversations enable row level security;
alter table messages enable row level security;

create policy "tenant members can view their conversations"
  on conversations for select
  using (is_tenant_member(tenant_id));

create policy "tenant members can update their conversations"
  on conversations for update
  using (is_tenant_member(tenant_id));

create policy "tenant members can view their messages"
  on messages for select
  using (is_tenant_member(tenant_id));


-- MIGRATION: 20260704000004_knowledge_base.sql
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


-- MIGRATION: 20260704000005_billing_and_usage.sql
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null unique,
  plan text not null,
  cap_messages integer not null,
  price_inr numeric(10,2) not null,
  status text default 'active' check (status in ('active','past_due','cancelled')),
  renewed_at timestamptz default now(),
  created_at timestamptz default now()
);

create table usage_tracking (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  billing_period date not null,        -- first day of the billing month
  messages_sent integer default 0,
  llm_calls integer default 0,
  stt_minutes numeric(10,2) default 0,
  overage_count integer default 0,
  overage_charge_inr numeric(10,2) default 0,
  created_at timestamptz default now(),
  unique (tenant_id, billing_period)
);

create index idx_usage_tenant_period on usage_tracking(tenant_id, billing_period);

alter table subscriptions enable row level security;
alter table usage_tracking enable row level security;

create policy "admins can view their subscription"
  on subscriptions for select
  using (is_tenant_admin(tenant_id));

create policy "tenant members can view their usage"
  on usage_tracking for select
  using (is_tenant_member(tenant_id));


-- MIGRATION: 20260704000006_audit_and_admin.sql
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  action text not null,                -- e.g. 'bsp_config_changed', 'template_submitted'
  details jsonb default '{}',
  created_at timestamptz default now()
);

create index idx_audit_tenant on audit_log(tenant_id);

alter table audit_log enable row level security;

create policy "admins can view their tenant's audit log"
  on audit_log for select
  using (is_tenant_admin(tenant_id));

-- Inserts: service-role only, never from client code.

create table platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) unique not null,
  created_at timestamptz default now()
);
-- Used to gate the platform-admin dashboard (Khan's cross-tenant view).
-- Checked via service-role Edge Functions, not client-side RLS.


-- MIGRATION: 20260704000007_unified_message_rpc.sql
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_metrics ON conversations(tenant_id, status, assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tenant_bsp_phone ON tenant_bsp_config(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_tenant_bsp_waba ON tenant_bsp_config(waba_id);

-- RPC for processing inbound messages in a single transaction
CREATE OR REPLACE FUNCTION process_inbound_message(
  p_phone_number_id text,
  p_customer_phone text,
  p_customer_name text,
  p_message_type text,
  p_content text,
  p_media_url text,
  p_transcript text,
  p_wa_message_id text,
  p_timestamp timestamptz
) RETURNS json AS $$
DECLARE
  v_tenant_id uuid;
  v_conversation_id uuid;
  v_conv_status text;
  v_message_id uuid;
BEGIN
  -- 1. Identify Tenant
  SELECT tenant_id INTO v_tenant_id
  FROM tenant_bsp_config
  WHERE phone_number_id = p_phone_number_id OR waba_id = p_phone_number_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'reason', 'tenant_not_found');
  END IF;

  -- 2. Find or Create Conversation
  SELECT id, status INTO v_conversation_id, v_conv_status
  FROM conversations
  WHERE tenant_id = v_tenant_id AND customer_phone = p_customer_phone;

  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (tenant_id, customer_phone, customer_name, status, last_customer_message_at, last_message_at)
    VALUES (v_tenant_id, p_customer_phone, COALESCE(p_customer_name, 'Customer'), 'bot', p_timestamp, p_timestamp)
    RETURNING id, status INTO v_conversation_id, v_conv_status;
  ELSE
    UPDATE conversations
    SET last_customer_message_at = p_timestamp,
        last_message_at = p_timestamp
    WHERE id = v_conversation_id;
  END IF;

  -- 3. Insert Message (handling duplicates safely)
  BEGIN
    INSERT INTO messages (conversation_id, tenant_id, direction, message_type, content, media_url, transcript, wa_message_id, sender)
    VALUES (v_conversation_id, v_tenant_id, 'inbound', p_message_type, p_content, p_media_url, p_transcript, p_wa_message_id, 'customer')
    RETURNING id INTO v_message_id;
  EXCEPTION WHEN unique_violation THEN
    -- Message already exists, just return success with duplicate flag
    RETURN json_build_object(
      'status', 'duplicate',
      'tenant_id', v_tenant_id,
      'conversation_id', v_conversation_id,
      'conv_status', v_conv_status
    );
  END;

  -- 4. Return success
  RETURN json_build_object(
    'status', 'success',
    'tenant_id', v_tenant_id,
    'conversation_id', v_conversation_id,
    'conv_status', v_conv_status,
    'message_id', v_message_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- MIGRATION: 20260704000008_extreme_optimizations.sql
-- 1. Upgrade vector search index to HNSW for drastically better recall and performance
DROP INDEX IF EXISTS idx_chunks_embedding;
CREATE INDEX idx_chunks_embedding ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

-- 2. Add missing foreign key index to prevent full table scans on assigned agent queries or deletes
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(assigned_agent_id);

-- 3. Add JSONB GIN index to allow lightning fast pre-filtering by source before vector math
CREATE INDEX IF NOT EXISTS idx_chunks_metadata ON knowledge_chunks USING gin (metadata);


-- MIGRATION: 20260704163042_agent_invitations.sql
create table agent_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  email text not null,
  role text not null default 'agent' check (role in ('admin', 'agent')),
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  error_details text,
  created_at timestamptz default now()
);

create index idx_agent_invitations_tenant on agent_invitations(tenant_id);

alter table agent_invitations enable row level security;

-- Tenant Admins can view invitations for their tenant
create policy "Admins can view invitations"
  on agent_invitations for select
  using (is_tenant_admin(tenant_id));

-- Tenant Admins can create invitations for their tenant
create policy "Admins can create invitations"
  on agent_invitations for insert
  with check (is_tenant_admin(tenant_id));

-- No update/delete policies needed for clients (status is managed by backend script)


-- MIGRATION: 20260704163043_review_fixes.sql
-- 1. Add missing handover_reason column to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS handover_reason text;

-- 2. Add unique constraint to prevent race condition duplicates
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_tenant_phone') THEN
    ALTER TABLE conversations ADD CONSTRAINT unique_tenant_phone UNIQUE (tenant_id, customer_phone);
  END IF;
END $$;

-- 3. Create missing RPC to increment FAQ match count
CREATE OR REPLACE FUNCTION increment_faq_match(faq_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE faqs 
  SET match_count = COALESCE(match_count, 0) + 1 
  WHERE id = faq_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- MIGRATION: 20260705000000_usage_tracking_rpc.sql
-- Usage Tracking Increment RPC
-- Safely handles concurrent counter updates using ON CONFLICT upsert.
create or replace function increment_usage(
  p_tenant_id uuid,
  p_messages_sent integer default 0,
  p_llm_calls integer default 0,
  p_stt_minutes numeric default 0
) returns void as $$
declare
  v_billing_period date;
begin
  v_billing_period := date_trunc('month', current_date)::date;

  insert into usage_tracking (
    tenant_id, 
    billing_period, 
    messages_sent, 
    llm_calls, 
    stt_minutes
  ) values (
    p_tenant_id, 
    v_billing_period, 
    p_messages_sent, 
    p_llm_calls, 
    p_stt_minutes
  )
  on conflict (tenant_id, billing_period)
  do update set 
    messages_sent = usage_tracking.messages_sent + excluded.messages_sent,
    llm_calls = usage_tracking.llm_calls + excluded.llm_calls,
    stt_minutes = usage_tracking.stt_minutes + excluded.stt_minutes;
end;
$$ language plpgsql security definer;


-- MIGRATION: 20260706000000_allow_meta_provider.sql
-- Drop the existing check constraint on bsp_provider
ALTER TABLE tenant_bsp_config DROP CONSTRAINT IF EXISTS tenant_bsp_config_bsp_provider_check;

-- Add the new check constraint that includes 'meta'
ALTER TABLE tenant_bsp_config ADD CONSTRAINT tenant_bsp_config_bsp_provider_check 
  CHECK (bsp_provider in ('gupshup','twilio','360dialog','telnyx','meta'));


-- MIGRATION: 20260706000001_razorpay_schema.sql
-- Phase 12: Razorpay Payment Integration Schema Updates

-- Add razorpay customer mapping to tenants
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT;

-- Add razorpay subscription ID to subscriptions
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT;

-- Create an invoices table to track billing history
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    razorpay_invoice_id TEXT UNIQUE,
    amount_inr NUMERIC NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('paid', 'pending', 'failed', 'cancelled')),
    billing_period_start TIMESTAMPTZ,
    billing_period_end TIMESTAMPTZ,
    invoice_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies for invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own invoices" ON invoices;
CREATE POLICY "Users can view their own invoices"
ON invoices FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
);

-- Note: Invoices are inserted/updated strictly via the backend Webhook (Admin client),
-- so we do not need INSERT/UPDATE policies for authenticated users.


-- MIGRATION: 20260706165124_fix_provisioning_trigger.sql
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


-- MIGRATION: 20260707000000_templates_schema.sql
-- Phase 13: Templates Schema Updates

CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('marketing', 'utility', 'authentication')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    body TEXT NOT NULL,
    bsp_template_id TEXT, -- The ID given by the BSP upon submission
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies for message_templates
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their tenant's templates" ON message_templates;
CREATE POLICY "Users can view their tenant's templates"
ON message_templates FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can insert templates for their tenant" ON message_templates;
CREATE POLICY "Users can insert templates for their tenant"
ON message_templates FOR INSERT
TO authenticated
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
);


-- MIGRATION: 20260708000000_onboarding_trigger.sql
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


-- MIGRATION: 20260708222609_realtime_messages.sql
DO $$ 
BEGIN 
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages, conversations;
  EXCEPTION 
    WHEN duplicate_object THEN 
      NULL; 
  END; 
END $$;


-- MIGRATION: 20260709000000_drip_campaigns.sql
-- Phase 15: Drip Campaigns Schema

CREATE TABLE IF NOT EXISTS drip_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drip_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES drip_campaigns(id) ON DELETE CASCADE NOT NULL,
    template_id UUID REFERENCES message_templates(id) ON DELETE CASCADE NOT NULL,
    delay_hours INTEGER NOT NULL DEFAULT 0,
    step_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drip_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES drip_campaigns(id) ON DELETE CASCADE NOT NULL,
    contact_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    enrolled_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE drip_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant's drip campaigns"
ON drip_campaigns FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert drip campaigns for their tenant"
ON drip_campaigns FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their tenant's drip steps"
ON drip_steps FOR SELECT TO authenticated
USING (campaign_id IN (SELECT id FROM drip_campaigns WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())));

CREATE POLICY "Users can insert drip steps"
ON drip_steps FOR INSERT TO authenticated
WITH CHECK (campaign_id IN (SELECT id FROM drip_campaigns WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())));

CREATE POLICY "Users can view enrollments"
ON drip_enrollments FOR SELECT TO authenticated
USING (campaign_id IN (SELECT id FROM drip_campaigns WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())));

CREATE POLICY "Users can insert enrollments"
ON drip_enrollments FOR INSERT TO authenticated
WITH CHECK (campaign_id IN (SELECT id FROM drip_campaigns WHERE tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid())));


-- MIGRATION: 20260710000000_agent_routing.sql
-- Phase 16: Advanced Agent Routing Schema Updates

-- Add departments to tenant_users to assign skills to agents
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS departments text[] DEFAULT '{}'::text[];

-- Add department to conversations for routing
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS department text DEFAULT 'general';


-- MIGRATION: 20260711000000_rich_templates.sql
-- Phase 17: Rich Media Templates Schema Updates

ALTER TABLE message_templates 
ADD COLUMN IF NOT EXISTS header_type TEXT CHECK (header_type IN ('text', 'image', 'video', 'document')),
ADD COLUMN IF NOT EXISTS header_content TEXT,
ADD COLUMN IF NOT EXISTS footer TEXT,
ADD COLUMN IF NOT EXISTS buttons JSONB DEFAULT '[]'::jsonb;


-- MIGRATION: 20260712000000_billing_enforcement.sql
-- Phase 18: Strict Billing Enforcement

-- RPC to check if a tenant has remaining quota for the current billing cycle
CREATE OR REPLACE FUNCTION check_tenant_quota(p_tenant_id uuid)
RETURNS boolean AS $$
DECLARE
  v_cap_messages integer;
  v_used_messages integer;
  v_billing_period date;
BEGIN
  -- 1. Get the tenant's current cap limit from subscriptions
  SELECT cap_messages INTO v_cap_messages 
  FROM subscriptions 
  WHERE tenant_id = p_tenant_id 
    AND status = 'active';

  -- If no active subscription or cap found, assume 0 limit (false)
  IF v_cap_messages IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 2. Get the current month's usage
  v_billing_period := date_trunc('month', current_date)::date;
  
  SELECT messages_sent INTO v_used_messages
  FROM usage_tracking
  WHERE tenant_id = p_tenant_id
    AND billing_period = v_billing_period;
    
  IF v_used_messages IS NULL THEN
    v_used_messages := 0;
  END IF;

  -- 3. Return true if there is quota remaining
  IF v_used_messages >= v_cap_messages THEN
    RETURN FALSE;
  ELSE
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- MIGRATION: 20260713000000_security_fixes.sql
-- Phase 19: Security & Code Review Fixes

-- 1. Prevent Privilege Escalation on tenants table
-- We drop the UPDATE policy so users cannot manipulate their own tier or status from the frontend.
-- All tenant updates (like business_name changes) must now go through a secure backend route 
-- that uses the service role key and explicitly filters allowed fields.
DROP POLICY IF EXISTS "admins can update their tenant" ON tenants;

-- 2. Add Missing RLS Policies for message_templates
-- Ensures users cannot update/delete templates of other tenants if they somehow bypass the backend.
DROP POLICY IF EXISTS "Users can update templates for their tenant" ON message_templates;
CREATE POLICY "Users can update templates for their tenant"
ON message_templates FOR UPDATE
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can delete templates for their tenant" ON message_templates;
CREATE POLICY "Users can delete templates for their tenant"
ON message_templates FOR DELETE
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
);

-- 3. Add Missing RLS Policies for drip_campaigns
DROP POLICY IF EXISTS "Users can update drip campaigns" ON drip_campaigns;
CREATE POLICY "Users can update drip campaigns"
ON drip_campaigns FOR UPDATE
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can delete drip campaigns" ON drip_campaigns;
CREATE POLICY "Users can delete drip campaigns"
ON drip_campaigns FOR DELETE
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
);

-- 4. Add Missing RLS Policies for drip_steps
DROP POLICY IF EXISTS "Users can update drip steps" ON drip_steps;
CREATE POLICY "Users can update drip steps"
ON drip_steps FOR UPDATE
TO authenticated
USING (
    campaign_id IN (
        SELECT id FROM drip_campaigns WHERE tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
        )
    )
)
WITH CHECK (
    campaign_id IN (
        SELECT id FROM drip_campaigns WHERE tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Users can delete drip steps" ON drip_steps;
CREATE POLICY "Users can delete drip steps"
ON drip_steps FOR DELETE
TO authenticated
USING (
    campaign_id IN (
        SELECT id FROM drip_campaigns WHERE tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
        )
    )
);

-- 5. Add Missing RLS Policies for drip_enrollments
DROP POLICY IF EXISTS "Users can update enrollments" ON drip_enrollments;
CREATE POLICY "Users can update enrollments"
ON drip_enrollments FOR UPDATE
TO authenticated
USING (
    campaign_id IN (
        SELECT id FROM drip_campaigns WHERE tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
        )
    )
)
WITH CHECK (
    campaign_id IN (
        SELECT id FROM drip_campaigns WHERE tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Users can delete enrollments" ON drip_enrollments;
CREATE POLICY "Users can delete enrollments"
ON drip_enrollments FOR DELETE
TO authenticated
USING (
    campaign_id IN (
        SELECT id FROM drip_campaigns WHERE tenant_id IN (
            SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
        )
    )
);


-- MIGRATION: 20260714000000_dashboard_metrics_rpc.sql
CREATE OR REPLACE FUNCTION get_dashboard_metrics(p_tenant_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_messages BIGINT;
  v_bot_handled_count BIGINT;
  v_faq_match_total BIGINT;
  v_handover_count BIGINT;
  v_recent_handovers JSON;
  v_time_series JSON;
BEGIN
  -- Total messages
  SELECT COUNT(*) INTO v_total_messages 
  FROM messages 
  WHERE tenant_id = p_tenant_id;
  
  -- Bot handled count (from conversations resolved without an assigned agent)
  SELECT COUNT(*) INTO v_bot_handled_count 
  FROM conversations 
  WHERE tenant_id = p_tenant_id 
    AND status = 'resolved' 
    AND assigned_agent_id IS NULL;
    
  -- FAQ match total
  SELECT COALESCE(SUM(match_count), 0) INTO v_faq_match_total 
  FROM faqs 
  WHERE tenant_id = p_tenant_id;
  
  -- Handover count
  SELECT COUNT(*) INTO v_handover_count 
  FROM conversations 
  WHERE tenant_id = p_tenant_id 
    AND status IN ('handover_pending', 'handover_active');
    
  -- Recent handovers (up to 5)
  SELECT COALESCE(json_agg(row_to_json(rh)), '[]'::json) INTO v_recent_handovers
  FROM (
    SELECT id, customer_phone, last_message_at, status, handover_reason
    FROM conversations
    WHERE tenant_id = p_tenant_id
      AND status = 'handover_pending'
    ORDER BY last_message_at DESC
    LIMIT 5
  ) rh;
  
  -- Time series (last 7 days)
  SELECT COALESCE(json_agg(ts), '[]'::json) INTO v_time_series
  FROM (
    WITH dates AS (
      SELECT generate_series(
        current_date - interval '6 days',
        current_date,
        interval '1 day'
      )::date AS d
    )
    SELECT 
      to_char(d.d, 'Dy') AS name,
      d.d::text AS "fullDate",
      COALESCE(SUM(CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS messages,
      COALESCE(SUM(CASE WHEN m.sender_type = 'bot' THEN 1 ELSE 0 END), 0)::int AS "botHandled"
    FROM dates d
    LEFT JOIN messages m 
      ON m.tenant_id = p_tenant_id 
      AND m.created_at::date = d.d
    GROUP BY d.d
    ORDER BY d.d ASC
  ) ts;
  
  RETURN json_build_object(
    'totalMessages', v_total_messages,
    'botHandledCount', v_bot_handled_count,
    'faqMatchTotal', v_faq_match_total,
    'handoverCount', v_handover_count,
    'recentHandovers', v_recent_handovers,
    'timeSeries', v_time_series
  );
END;
$$;


-- MIGRATION: 20260715000000_theme_preferences.sql
-- Add preferences JSONB column to tenant_users to store theme settings
alter table tenant_users add column if not exists preferences jsonb default '{}'::jsonb;


-- MIGRATION: 20260715000001_handoff_summary.sql
-- Add AI Handoff Summarization fields
alter table conversations add column if not exists handover_summary text;
alter table conversations add column if not exists handover_reason text;


-- MIGRATION: 20260715000002_contacts_schema.sql
-- Phase 3: Contact Management & Tagging (Mini-CRM)

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  phone_number text not null,
  name text,
  tags text[] default '{}',
  notes text,
  last_contacted_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(tenant_id, phone_number)
);

create index if not exists idx_contacts_tenant on contacts(tenant_id);
create index if not exists idx_contacts_phone on contacts(tenant_id, phone_number);

alter table contacts enable row level security;

create policy "tenant members can manage their contacts"
  on contacts for all
  using (is_tenant_member(tenant_id));

-- Update RPC to auto-create/update contacts
CREATE OR REPLACE FUNCTION process_inbound_message(
  p_phone_number_id text,
  p_customer_phone text,
  p_customer_name text,
  p_message_type text,
  p_content text,
  p_media_url text,
  p_transcript text,
  p_wa_message_id text,
  p_timestamp timestamptz
) RETURNS json AS $$
DECLARE
  v_tenant_id uuid;
  v_conversation_id uuid;
  v_conv_status text;
  v_message_id uuid;
BEGIN
  -- 1. Identify Tenant
  SELECT tenant_id INTO v_tenant_id
  FROM tenant_bsp_config
  WHERE phone_number_id = p_phone_number_id OR waba_id = p_phone_number_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'reason', 'tenant_not_found');
  END IF;

  -- 2. Upsert Contact (Mini-CRM)
  INSERT INTO contacts (tenant_id, phone_number, name, last_contacted_at)
  VALUES (v_tenant_id, p_customer_phone, p_customer_name, p_timestamp)
  ON CONFLICT (tenant_id, phone_number) 
  DO UPDATE SET 
    last_contacted_at = p_timestamp,
    name = COALESCE(contacts.name, p_customer_name);

  -- 3. Find or Create Conversation
  SELECT id, status INTO v_conversation_id, v_conv_status
  FROM conversations
  WHERE tenant_id = v_tenant_id AND customer_phone = p_customer_phone;

  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (tenant_id, customer_phone, customer_name, status, last_customer_message_at, last_message_at)
    VALUES (v_tenant_id, p_customer_phone, COALESCE(p_customer_name, 'Customer'), 'bot', p_timestamp, p_timestamp)
    RETURNING id, status INTO v_conversation_id, v_conv_status;
  ELSE
    UPDATE conversations
    SET last_customer_message_at = p_timestamp,
        last_message_at = p_timestamp
    WHERE id = v_conversation_id;
  END IF;

  -- 4. Insert Message (handling duplicates safely)
  BEGIN
    INSERT INTO messages (conversation_id, tenant_id, direction, message_type, content, media_url, transcript, wa_message_id, sender)
    VALUES (v_conversation_id, v_tenant_id, 'inbound', p_message_type, p_content, p_media_url, p_transcript, p_wa_message_id, 'customer')
    RETURNING id INTO v_message_id;
  EXCEPTION WHEN unique_violation THEN
    -- Message already exists, just return success with duplicate flag
    RETURN json_build_object(
      'status', 'duplicate',
      'tenant_id', v_tenant_id,
      'conversation_id', v_conversation_id,
      'conv_status', v_conv_status
    );
  END;

  -- 5. Return success
  RETURN json_build_object(
    'status', 'success',
    'tenant_id', v_tenant_id,
    'conversation_id', v_conversation_id,
    'conv_status', v_conv_status,
    'message_id', v_message_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- MIGRATION: 20260715000003_analytics_topics.sql
-- Phase 5: Analytics & Topic Extraction

create table if not exists conversation_topics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  conversation_id uuid references conversations(id) on delete cascade not null,
  topic text not null,
  created_at timestamptz default now()
);

create index if not exists idx_conv_topics_tenant on conversation_topics(tenant_id);
create index if not exists idx_conv_topics_topic on conversation_topics(tenant_id, topic);

alter table conversation_topics enable row level security;

create policy "tenant members can view topics"
  on conversation_topics for select
  using (is_tenant_member(tenant_id));


-- MIGRATION: 20260715000004_dashboard_topics_rpc.sql
-- Update dashboard metrics to include topic distribution

CREATE OR REPLACE FUNCTION get_dashboard_metrics(p_tenant_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_messages BIGINT;
  v_bot_handled_count BIGINT;
  v_faq_match_total BIGINT;
  v_handover_count BIGINT;
  v_recent_handovers JSON;
  v_time_series JSON;
  v_topic_distribution JSON;
BEGIN
  -- Total messages
  SELECT COUNT(*) INTO v_total_messages 
  FROM messages 
  WHERE tenant_id = p_tenant_id;
  
  -- Bot handled count (from conversations resolved without an assigned agent)
  SELECT COUNT(*) INTO v_bot_handled_count 
  FROM conversations 
  WHERE tenant_id = p_tenant_id 
    AND status = 'resolved' 
    AND assigned_agent_id IS NULL;
    
  -- FAQ match total
  SELECT COALESCE(SUM(match_count), 0) INTO v_faq_match_total 
  FROM faqs 
  WHERE tenant_id = p_tenant_id;
  
  -- Handover count
  SELECT COUNT(*) INTO v_handover_count 
  FROM conversations 
  WHERE tenant_id = p_tenant_id 
    AND status IN ('handover_pending', 'handover_active');
    
  -- Recent handovers (up to 5)
  SELECT COALESCE(json_agg(row_to_json(rh)), '[]'::json) INTO v_recent_handovers
  FROM (
    SELECT id, customer_phone, last_message_at, status, handover_reason
    FROM conversations
    WHERE tenant_id = p_tenant_id
      AND status = 'handover_pending'
    ORDER BY last_message_at DESC
    LIMIT 5
  ) rh;
  
  -- Time series (last 7 days)
  SELECT COALESCE(json_agg(ts), '[]'::json) INTO v_time_series
  FROM (
    WITH dates AS (
      SELECT generate_series(
        current_date - interval '6 days',
        current_date,
        interval '1 day'
      )::date AS d
    )
    SELECT 
      to_char(d.d, 'Dy') AS name,
      d.d::text AS "fullDate",
      COALESCE(SUM(CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS messages,
      COALESCE(SUM(CASE WHEN m.sender = 'bot' THEN 1 ELSE 0 END), 0)::int AS "botHandled"
    FROM dates d
    LEFT JOIN messages m 
      ON m.tenant_id = p_tenant_id 
      AND m.created_at::date = d.d
    GROUP BY d.d
    ORDER BY d.d ASC
  ) ts;
  
  -- Topic Distribution (Phase 5)
  SELECT COALESCE(json_agg(td), '[]'::json) INTO v_topic_distribution
  FROM (
    SELECT topic as name, COUNT(*) as value
    FROM conversation_topics
    WHERE tenant_id = p_tenant_id
    GROUP BY topic
    ORDER BY value DESC
    LIMIT 6
  ) td;
  
  RETURN json_build_object(
    'totalMessages', v_total_messages,
    'botHandledCount', v_bot_handled_count,
    'faqMatchTotal', v_faq_match_total,
    'handoverCount', v_handover_count,
    'recentHandovers', v_recent_handovers,
    'timeSeries', v_time_series,
    'topicDistribution', v_topic_distribution
  );
END;
$$;


-- MIGRATION: 20260715000005_developer_settings.sql
-- Create developer settings table
CREATE TABLE IF NOT EXISTS public.developer_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    api_key TEXT NOT NULL,
    webhook_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id),
    UNIQUE(api_key)
);

-- Enable RLS
ALTER TABLE public.developer_settings ENABLE ROW LEVEL SECURITY;

-- Policies for developer_settings
CREATE POLICY "Users can view developer settings for their tenant"
    ON public.developer_settings FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can update developer settings for their tenant"
    ON public.developer_settings FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can insert developer settings for their tenant"
    ON public.developer_settings FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Create trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.developer_settings
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);


-- MIGRATION: 20260715000006_admin_aggregations.sql
-- Create RPC to get total MRR (sum of active subscriptions)
CREATE OR REPLACE FUNCTION get_total_mrr()
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM(price_inr), 0)
  FROM public.subscriptions
  WHERE status = 'active';
$$;

-- Create RPC to get total usage for a billing period
CREATE OR REPLACE FUNCTION get_total_usage(p_billing_period text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'total_messages_sent', COALESCE(SUM(messages_sent), 0),
    'total_llm_calls', COALESCE(SUM(llm_calls), 0),
    'total_stt_minutes', COALESCE(SUM(stt_minutes), 0)
  )
  FROM public.usage_tracking
  WHERE billing_period = p_billing_period::date;
$$;


-- MIGRATION: 20260715000007_inbox_collaboration.sql
-- Add is_internal flag to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false;

-- Create quick_replies table
CREATE TABLE IF NOT EXISTS public.quick_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    shortcut TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, shortcut)
);

-- Enable RLS
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;

-- Policies for quick_replies
CREATE POLICY "Users can view quick_replies for their tenant"
    ON public.quick_replies FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert quick_replies for their tenant"
    ON public.quick_replies FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update quick_replies for their tenant"
    ON public.quick_replies FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete quick_replies for their tenant"
    ON public.quick_replies FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );


-- MIGRATION: 20260715000008_bot_flows.sql
CREATE TABLE IF NOT EXISTS public.bot_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT false,
    nodes JSONB DEFAULT '[]'::jsonb,
    edges JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.bot_flows ENABLE ROW LEVEL SECURITY;

-- Policies for bot_flows
CREATE POLICY "Users can view bot_flows for their tenant"
    ON public.bot_flows FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert bot_flows for their tenant"
    ON public.bot_flows FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update bot_flows for their tenant"
    ON public.bot_flows FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete bot_flows for their tenant"
    ON public.bot_flows FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );


-- MIGRATION: 20260715000009_dashboard_analytics_v2.sql
-- Update dashboard metrics to include usage and avg response time

CREATE OR REPLACE FUNCTION get_dashboard_metrics(p_tenant_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_messages BIGINT;
  v_bot_handled_count BIGINT;
  v_faq_match_total BIGINT;
  v_handover_count BIGINT;
  v_recent_handovers JSON;
  v_time_series JSON;
  v_topic_distribution JSON;
  v_current_usage JSON;
  v_avg_response_time TEXT;
BEGIN
  -- Total messages
  SELECT COUNT(*) INTO v_total_messages 
  FROM messages 
  WHERE tenant_id = p_tenant_id;
  
  -- Bot handled count (from conversations resolved without an assigned agent)
  SELECT COUNT(*) INTO v_bot_handled_count 
  FROM conversations 
  WHERE tenant_id = p_tenant_id 
    AND status = 'resolved' 
    AND assigned_agent_id IS NULL;
    
  -- FAQ match total
  SELECT COALESCE(SUM(match_count), 0) INTO v_faq_match_total 
  FROM faqs 
  WHERE tenant_id = p_tenant_id;
  
  -- Handover count
  SELECT COUNT(*) INTO v_handover_count 
  FROM conversations 
  WHERE tenant_id = p_tenant_id 
    AND status IN ('handover_pending', 'handover_active');
    
  -- Recent handovers (up to 5)
  SELECT COALESCE(json_agg(row_to_json(rh)), '[]'::json) INTO v_recent_handovers
  FROM (
    SELECT id, customer_phone, last_message_at, status, handover_reason
    FROM conversations
    WHERE tenant_id = p_tenant_id
      AND status = 'handover_pending'
    ORDER BY last_message_at DESC
    LIMIT 5
  ) rh;
  
  -- Time series (last 7 days)
  SELECT COALESCE(json_agg(ts), '[]'::json) INTO v_time_series
  FROM (
    WITH dates AS (
      SELECT generate_series(
        current_date - interval '6 days',
        current_date,
        interval '1 day'
      )::date AS d
    )
    SELECT 
      to_char(d.d, 'Dy') AS name,
      d.d::text AS "fullDate",
      COALESCE(SUM(CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS messages,
      COALESCE(SUM(CASE WHEN m.sender = 'bot' THEN 1 ELSE 0 END), 0)::int AS "botHandled"
    FROM dates d
    LEFT JOIN messages m 
      ON m.tenant_id = p_tenant_id 
      AND m.created_at::date = d.d
    GROUP BY d.d
    ORDER BY d.d ASC
  ) ts;
  
  -- Topic Distribution
  SELECT COALESCE(json_agg(td), '[]'::json) INTO v_topic_distribution
  FROM (
    SELECT topic as name, COUNT(*) as value
    FROM conversation_topics
    WHERE tenant_id = p_tenant_id
    GROUP BY topic
    ORDER BY value DESC
    LIMIT 6
  ) td;

  -- Current Usage
  SELECT COALESCE(
    (
      SELECT row_to_json(ut)
      FROM usage_tracking ut
      WHERE tenant_id = p_tenant_id AND billing_period = date_trunc('month', current_date)::date
    ),
    '{"messages_sent":0,"llm_calls":0,"stt_minutes":0}'::json
  ) INTO v_current_usage;

  -- Avg Response Time (LATERAL join for the very next outbound message)
  SELECT COALESCE(
    TO_CHAR(
      (AVG(EXTRACT(EPOCH FROM (outbound.created_at - inbound.created_at))) || ' second')::interval,
      'MI:SS'
    ),
    '00:00'
  ) INTO v_avg_response_time
  FROM (
    SELECT conversation_id, created_at
    FROM messages
    WHERE tenant_id = p_tenant_id AND direction = 'inbound'
  ) inbound
  JOIN LATERAL (
    SELECT created_at
    FROM messages
    WHERE conversation_id = inbound.conversation_id AND direction = 'outbound' AND created_at > inbound.created_at
    ORDER BY created_at ASC
    LIMIT 1
  ) outbound ON true;
  
  RETURN json_build_object(
    'totalMessages', v_total_messages,
    'botHandledCount', v_bot_handled_count,
    'faqMatchTotal', v_faq_match_total,
    'handoverCount', v_handover_count,
    'recentHandovers', v_recent_handovers,
    'timeSeries', v_time_series,
    'topicDistribution', v_topic_distribution,
    'currentUsage', v_current_usage,
    'avgResponseTime', v_avg_response_time
  );
END;
$$;


-- MIGRATION: 20260715000010_commerce_catalog_id.sql
-- Add catalog_id to tenant_bsp_config
ALTER TABLE tenant_bsp_config ADD COLUMN IF NOT EXISTS catalog_id text;

-- Update the message_type constraint on messages
DO $$
BEGIN
  -- Try dropping the default constraint name
  BEGIN
    ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
  EXCEPTION
    WHEN undefined_object THEN NULL;
  END;

  -- Add the new constraint with 'order' and 'catalog'
  ALTER TABLE messages ADD CONSTRAINT messages_message_type_check 
    CHECK (message_type IN ('text','image','document','audio','template','interactive','catalog','order'));
END $$;


-- MIGRATION: 20260715000011_postgres_best_practices.sql
-- Phase 1: Foreign Key Indexes (schema-foreign-key-indexes.md)
-- Missing indexes on drip campaigns
CREATE INDEX IF NOT EXISTS idx_drip_campaigns_tenant ON drip_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drip_steps_campaign ON drip_steps(campaign_id);
CREATE INDEX IF NOT EXISTS idx_drip_steps_template ON drip_steps(template_id);
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_campaign ON drip_enrollments(campaign_id);

-- Missing indexes on knowledge base
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_uploaded_by ON knowledge_documents(uploaded_by);

-- Missing indexes on audit logs
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_user_id);

-- Missing index on conversations
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(assigned_agent_id);


-- Phase 2: RLS Performance (security-rls-performance.md)
-- Rewrite RLS policies to use scalar subquery caching
-- e.g. using ((select is_tenant_member(tenant_id))) instead of using (is_tenant_member(tenant_id))

-- Dropping old policies for conversations:
DROP POLICY IF EXISTS "tenant members can view their conversations" ON conversations;
DROP POLICY IF EXISTS "tenant members can update their conversations" ON conversations;
CREATE POLICY "tenant members can view their conversations" ON conversations FOR SELECT USING ((select is_tenant_member(tenant_id)));
CREATE POLICY "tenant members can update their conversations" ON conversations FOR UPDATE USING ((select is_tenant_member(tenant_id)));

-- Dropping old policies for messages:
DROP POLICY IF EXISTS "tenant members can view their messages" ON messages;
CREATE POLICY "tenant members can view their messages" ON messages FOR SELECT USING ((select is_tenant_member(tenant_id)));

-- Dropping old policies for contacts:
DROP POLICY IF EXISTS "tenant members can manage their contacts" ON contacts;
CREATE POLICY "tenant members can manage their contacts" ON contacts FOR ALL USING ((select is_tenant_member(tenant_id)));

-- Dropping old policies for drip_enrollments:
DROP POLICY IF EXISTS "Users can view enrollments" ON drip_enrollments;
DROP POLICY IF EXISTS "Users can insert enrollments" ON drip_enrollments;
DROP POLICY IF EXISTS "Users can update enrollments" ON drip_enrollments;
DROP POLICY IF EXISTS "Users can delete enrollments" ON drip_enrollments;

CREATE POLICY "Users can view enrollments" ON drip_enrollments FOR SELECT USING ((select is_tenant_member((select tenant_id from drip_campaigns where id = campaign_id))));
CREATE POLICY "Users can insert enrollments" ON drip_enrollments FOR INSERT WITH CHECK ((select is_tenant_member((select tenant_id from drip_campaigns where id = campaign_id))));
CREATE POLICY "Users can update enrollments" ON drip_enrollments FOR UPDATE USING ((select is_tenant_member((select tenant_id from drip_campaigns where id = campaign_id))));
CREATE POLICY "Users can delete enrollments" ON drip_enrollments FOR DELETE USING ((select is_tenant_member((select tenant_id from drip_campaigns where id = campaign_id))));


-- MIGRATION: 20260715000012_crm_settings.sql
-- Migration: CRM Settings (HubSpot/Salesforce)
-- Created At: 2026-07-15 00:00:12

CREATE TYPE crm_provider AS ENUM ('hubspot', 'salesforce');

CREATE TABLE crm_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider crm_provider NOT NULL,
  api_key_encrypted TEXT,
  sync_contacts BOOLEAN DEFAULT true,
  sync_chats BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, provider)
);

-- RLS
ALTER TABLE crm_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage their crm settings"
  ON crm_settings
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND role = 'admin'
    )
  );


-- MIGRATION: 20260715000013_conversation_delete_policy.sql
-- Migration: Add DELETE policy to conversations
-- Allows tenant members to delete conversations (and via CASCADE, their messages).

create policy "tenant members can delete their conversations"
  on conversations for delete
  using (is_tenant_member(tenant_id));


-- MIGRATION: 20260715000014_crm_integrations.sql
-- CRM Integrations Table
-- Stores Private App Tokens / Personal Access Tokens for HubSpot and Salesforce

create table crm_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  provider text not null check (provider in ('hubspot', 'salesforce')),
  access_token text not null, -- Stored securely. In production, consider pgcrypto or Vault.
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(tenant_id, provider)
);

create index idx_crm_integrations_tenant on crm_integrations(tenant_id);

alter table crm_integrations enable row level security;

create policy "tenant members can view their crm integrations"
  on crm_integrations for select
  using (is_tenant_member(tenant_id));

create policy "tenant members can insert crm integrations"
  on crm_integrations for insert
  with check (is_tenant_member(tenant_id));

create policy "tenant members can update their crm integrations"
  on crm_integrations for update
  using (is_tenant_member(tenant_id));

create policy "tenant members can delete their crm integrations"
  on crm_integrations for delete
  using (is_tenant_member(tenant_id));


-- MIGRATION: 20260715000015_platform_expenses.sql
-- Migration: Platform Expenses

create table if not exists platform_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount_inr numeric(10,2) not null,
  created_at timestamptz default now()
);

-- Note: We do not enable RLS on platform_expenses because it is only accessed via the service_role key
-- by the platform admin dashboard in the Node backend. No direct client access is allowed.


-- MIGRATION: 20260715000016_secure_platform_tables.sql
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


-- MIGRATION: 20260715000017_dashboard_metrics_performance.sql
-- Optimization: Improve get_dashboard_metrics performance
-- Fixes latency on the SaaS dashboard by restricting the lateral join and using range queries.

CREATE OR REPLACE FUNCTION get_dashboard_metrics(p_tenant_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_messages BIGINT;
  v_bot_handled_count BIGINT;
  v_faq_match_total BIGINT;
  v_handover_count BIGINT;
  v_recent_handovers JSON;
  v_time_series JSON;
  v_topic_distribution JSON;
  v_current_usage JSON;
  v_avg_response_time TEXT;
BEGIN
  -- Total messages (Limit to recent months if performance becomes an issue again, but COUNT is usually fast with indexes)
  SELECT COUNT(*) INTO v_total_messages 
  FROM messages 
  WHERE tenant_id = p_tenant_id;
  
  -- Bot handled count (from conversations resolved without an assigned agent)
  SELECT COUNT(*) INTO v_bot_handled_count 
  FROM conversations 
  WHERE tenant_id = p_tenant_id 
    AND status = 'resolved' 
    AND assigned_agent_id IS NULL;
    
  -- FAQ match total
  SELECT COALESCE(SUM(match_count), 0) INTO v_faq_match_total 
  FROM faqs 
  WHERE tenant_id = p_tenant_id;
  
  -- Handover count
  SELECT COUNT(*) INTO v_handover_count 
  FROM conversations 
  WHERE tenant_id = p_tenant_id 
    AND status IN ('handover_pending', 'handover_active');
    
  -- Recent handovers (up to 5)
  SELECT COALESCE(json_agg(row_to_json(rh)), '[]'::json) INTO v_recent_handovers
  FROM (
    SELECT id, customer_phone, last_message_at, status, handover_reason
    FROM conversations
    WHERE tenant_id = p_tenant_id
      AND status = 'handover_pending'
    ORDER BY last_message_at DESC
    LIMIT 5
  ) rh;
  
  -- Time series (last 7 days)
  -- OPTIMIZATION: Replaced created_at::date = d.d with range query
  SELECT COALESCE(json_agg(ts), '[]'::json) INTO v_time_series
  FROM (
    WITH dates AS (
      SELECT generate_series(
        current_date - interval '6 days',
        current_date,
        interval '1 day'
      )::date AS d
    )
    SELECT 
      to_char(d.d, 'Dy') AS name,
      d.d::text AS "fullDate",
      COALESCE(SUM(CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS messages,
      COALESCE(SUM(CASE WHEN m.sender = 'bot' THEN 1 ELSE 0 END), 0)::int AS "botHandled"
    FROM dates d
    LEFT JOIN messages m 
      ON m.tenant_id = p_tenant_id 
      AND m.created_at >= d.d
      AND m.created_at < (d.d + interval '1 day')
    GROUP BY d.d
    ORDER BY d.d ASC
  ) ts;
  
  -- Topic Distribution
  SELECT COALESCE(json_agg(td), '[]'::json) INTO v_topic_distribution
  FROM (
    SELECT topic as name, COUNT(*) as value
    FROM conversation_topics
    WHERE tenant_id = p_tenant_id
    GROUP BY topic
    ORDER BY value DESC
    LIMIT 6
  ) td;

  -- Current Usage
  SELECT COALESCE(
    (
      SELECT row_to_json(ut)
      FROM usage_tracking ut
      WHERE tenant_id = p_tenant_id AND billing_period = date_trunc('month', current_date)::date
    ),
    '{"messages_sent":0,"llm_calls":0,"stt_minutes":0}'::json
  ) INTO v_current_usage;

  -- Avg Response Time
  -- OPTIMIZATION: Only evaluate the last 7 days of messages to avoid full table LATERAL JOIN
  SELECT COALESCE(
    TO_CHAR(
      (AVG(EXTRACT(EPOCH FROM (outbound.created_at - inbound.created_at))) || ' second')::interval,
      'MI:SS'
    ),
    '00:00'
  ) INTO v_avg_response_time
  FROM (
    SELECT conversation_id, created_at
    FROM messages
    WHERE tenant_id = p_tenant_id 
      AND direction = 'inbound'
      AND created_at >= (current_date - interval '7 days')
  ) inbound
  JOIN LATERAL (
    SELECT created_at
    FROM messages
    WHERE conversation_id = inbound.conversation_id 
      AND direction = 'outbound' 
      AND created_at > inbound.created_at
    ORDER BY created_at ASC
    LIMIT 1
  ) outbound ON true;
  
  RETURN json_build_object(
    'totalMessages', v_total_messages,
    'botHandledCount', v_bot_handled_count,
    'faqMatchTotal', v_faq_match_total,
    'handoverCount', v_handover_count,
    'recentHandovers', v_recent_handovers,
    'timeSeries', v_time_series,
    'topicDistribution', v_topic_distribution,
    'currentUsage', v_current_usage,
    'avgResponseTime', v_avg_response_time
  );
END;
$$;


-- MIGRATION: 20260715000018_knowledge_base_storage.sql
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


-- MIGRATION: 20260715000019_free_trial_tier.sql
-- Migration: Free Trial Tier
-- Adds plan types, trial counters, domain verification, and limit enforcement.

-- 1. Modify tenants table
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_conversations_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS trial_conversations_limit INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS trial_kb_doc_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS trial_faq_count INTEGER DEFAULT 0;

-- 2. Create trial_verifications table for dedupe
CREATE TABLE public.trial_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  business_domain TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.trial_verifications ENABLE ROW LEVEL SECURITY;

-- 3. RPC to check eligibility
CREATE OR REPLACE FUNCTION public.check_domain_eligibility(p_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_domain TEXT;
  v_exists BOOLEAN;
BEGIN
  v_domain := split_part(p_email, '@', 2);
  
  -- Allow public domains to have multiple trials
  IF v_domain IN ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com') THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.trial_verifications WHERE business_domain = v_domain
  ) INTO v_exists;

  RETURN NOT v_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Re-write the user provisioning trigger to wait for email confirmation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

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
        INSERT INTO public.subscriptions (tenant_id, status, plan, cap_messages, created_at)
        VALUES (new_tenant_id, 'active', 'free', 100, now());

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

CREATE TRIGGER on_auth_user_confirmed
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Triggers to enforce KB and FAQ limits and increment counts
-- KB Documents
CREATE OR REPLACE FUNCTION public.check_kb_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_plan TEXT;
  v_count INT;
BEGIN
  SELECT plan_type, trial_kb_doc_count INTO v_plan, v_count FROM public.tenants WHERE id = NEW.tenant_id;
  IF v_plan = 'trial' AND v_count >= 1 THEN
    RAISE EXCEPTION 'Upgrade to add more documents';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_kb_limit_trigger
  BEFORE INSERT ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.check_kb_limit();

CREATE OR REPLACE FUNCTION public.increment_kb_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tenants SET trial_kb_doc_count = trial_kb_doc_count + 1 WHERE id = NEW.tenant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER increment_kb_count_trigger
  AFTER INSERT ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.increment_kb_count();

CREATE OR REPLACE FUNCTION public.decrement_kb_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tenants SET trial_kb_doc_count = GREATEST(0, trial_kb_doc_count - 1) WHERE id = OLD.tenant_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER decrement_kb_count_trigger
  AFTER DELETE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.decrement_kb_count();


-- FAQs
CREATE OR REPLACE FUNCTION public.check_faq_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_plan TEXT;
  v_count INT;
BEGIN
  SELECT plan_type, trial_faq_count INTO v_plan, v_count FROM public.tenants WHERE id = NEW.tenant_id;
  IF v_plan = 'trial' AND v_count >= 10 THEN
    RAISE EXCEPTION 'Upgrade to add more FAQs';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_faq_limit_trigger
  BEFORE INSERT ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.check_faq_limit();

CREATE OR REPLACE FUNCTION public.increment_faq_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tenants SET trial_faq_count = trial_faq_count + 1 WHERE id = NEW.tenant_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER increment_faq_count_trigger
  AFTER INSERT ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.increment_faq_count();

CREATE OR REPLACE FUNCTION public.decrement_faq_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tenants SET trial_faq_count = GREATEST(0, trial_faq_count - 1) WHERE id = OLD.tenant_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER decrement_faq_count_trigger
  AFTER DELETE ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.decrement_faq_count();


-- MIGRATION: 20260715000020_fix_inbound_is_active.sql
-- Fix: Add is_active check to tenant resolution in process_inbound_message.
-- Without this, a deactivated BSP config still accepts and routes inbound messages.

CREATE OR REPLACE FUNCTION process_inbound_message(
  p_phone_number_id text,
  p_customer_phone text,
  p_customer_name text,
  p_message_type text,
  p_content text,
  p_media_url text,
  p_transcript text,
  p_wa_message_id text,
  p_timestamp timestamptz
) RETURNS json AS $$
DECLARE
  v_tenant_id uuid;
  v_conversation_id uuid;
  v_conv_status text;
  v_message_id uuid;
BEGIN
  -- 1. Identify Tenant (now filters by is_active = true)
  SELECT tenant_id INTO v_tenant_id
  FROM tenant_bsp_config
  WHERE (phone_number_id = p_phone_number_id OR waba_id = p_phone_number_id)
    AND is_active = true
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'reason', 'tenant_not_found');
  END IF;

  -- 2. Find or Create Conversation
  SELECT id, status INTO v_conversation_id, v_conv_status
  FROM conversations
  WHERE tenant_id = v_tenant_id AND customer_phone = p_customer_phone;

  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (tenant_id, customer_phone, customer_name, status, last_customer_message_at, last_message_at)
    VALUES (v_tenant_id, p_customer_phone, COALESCE(p_customer_name, 'Customer'), 'bot', p_timestamp, p_timestamp)
    RETURNING id, status INTO v_conversation_id, v_conv_status;
  ELSE
    UPDATE conversations
    SET last_customer_message_at = p_timestamp,
        last_message_at = p_timestamp
    WHERE id = v_conversation_id;
  END IF;

  -- 3. Insert Message (handling duplicates safely)
  BEGIN
    INSERT INTO messages (conversation_id, tenant_id, direction, message_type, content, media_url, transcript, wa_message_id, sender)
    VALUES (v_conversation_id, v_tenant_id, 'inbound', p_message_type, p_content, p_media_url, p_transcript, p_wa_message_id, 'customer')
    RETURNING id INTO v_message_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object(
      'status', 'duplicate',
      'tenant_id', v_tenant_id,
      'conversation_id', v_conversation_id,
      'conv_status', v_conv_status
    );
  END;

  -- 4. Return success
  RETURN json_build_object(
    'status', 'success',
    'tenant_id', v_tenant_id,
    'conversation_id', v_conversation_id,
    'conv_status', v_conv_status,
    'message_id', v_message_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- MIGRATION: 20260715000021_add_ai_settings.sql
-- Add ai_settings column to tenants table to store greeting configurations

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ai_settings JSONB DEFAULT '{
  "welcome_message_type": "fixed",
  "fixed_welcome_message": "Hi there! I am your AI assistant. How can I help you today?",
  "system_prompt": "You are a helpful AI assistant for our business. Answer questions concisely and politely."
}'::jsonb;


-- MIGRATION: 20260715000022_drip_tracking.sql
ALTER TABLE public.drip_enrollments ADD COLUMN IF NOT EXISTS current_step_order INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.drip_enrollments ADD COLUMN IF NOT EXISTS next_step_at TIMESTAMPTZ DEFAULT now();

-- MIGRATION: 20260715000023_security_definer_fix.sql
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


-- MIGRATION: 20260715000024_match_knowledge_chunks.sql
-- Migration for match_knowledge_chunks RPC

DROP FUNCTION IF EXISTS match_knowledge_chunks;

CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_tenant_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kc.id,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE kc.tenant_id = p_tenant_id
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;


-- MIGRATION: 20260715000025_provision_tenant_rpc.sql
-- Migration to make tenant provisioning transactional

CREATE OR REPLACE FUNCTION provision_tenant(
  p_business_name text,
  p_region text,
  p_tier text,
  p_cap_messages int,
  p_price_inr numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
  v_result json;
BEGIN
  -- 1. Insert Tenant Record
  INSERT INTO public.tenants (business_name, region, tier, status)
  VALUES (p_business_name, p_region, p_tier, 'active')
  RETURNING id INTO v_tenant_id;

  -- 2. Create Subscription Placeholder
  INSERT INTO public.subscriptions (tenant_id, plan, cap_messages, price_inr, status)
  VALUES (v_tenant_id, p_tier, p_cap_messages, p_price_inr, 'active');

  -- Return tenant details
  SELECT row_to_json(t) INTO v_result
  FROM (
    SELECT id, business_name, region, tier, status, created_at
    FROM public.tenants
    WHERE id = v_tenant_id
  ) t;

  RETURN v_result;
END;
$$;


-- MIGRATION: 20260715000026_security_definer_sweep.sql
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


-- MIGRATION: 20260715000027_webhook_secret.sql
-- Phase 8 Remediation: Add webhook_secret_encrypted for secure outbound webhooks

ALTER TABLE public.developer_settings
ADD COLUMN IF NOT EXISTS webhook_secret_encrypted text;


-- MIGRATION: 20260715000099_shopify_settings.sql
-- Create shopify_settings table
CREATE TABLE IF NOT EXISTS public.shopify_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    store_url TEXT NOT NULL,
    webhook_secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE public.shopify_settings ENABLE ROW LEVEL SECURITY;

-- Policies for shopify_settings
CREATE POLICY "Users can view shopify settings for their tenant"
    ON public.shopify_settings FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can update shopify settings for their tenant"
    ON public.shopify_settings FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can insert shopify settings for their tenant"
    ON public.shopify_settings FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can delete shopify settings for their tenant"
    ON public.shopify_settings FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Create trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.shopify_settings
  FOR EACH ROW EXECUTE PROCEDURE moddatetime (updated_at);


-- MIGRATION: 20260716000001_schema_constraint_fixes.sql
-- Phase 1 and 3 schema fixes

-- Fix Audit Issue #3: Add 'growth' tier
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_tier_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_tier_check
  CHECK (tier IN ('standard', 'growth', 'vip'));

-- Fix Audit Issue #4: Add 'catalog' message type
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text','image','document','audio','template','interactive','catalog','order'));

-- Fix Audit Issue (from #7 context): Add 'widget' to bsp_provider
ALTER TABLE tenant_bsp_config DROP CONSTRAINT IF EXISTS tenant_bsp_config_bsp_provider_check;
ALTER TABLE tenant_bsp_config ADD CONSTRAINT tenant_bsp_config_bsp_provider_check
  CHECK (bsp_provider IN ('gupshup','twilio','360dialog','telnyx','meta','widget'));

-- Fix Audit Issue #13: Trial usage increment RPC to fix race condition
CREATE OR REPLACE FUNCTION increment_trial_usage(p_tenant_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.tenants
  SET trial_conversations_used = trial_conversations_used + 1
  WHERE id = p_tenant_id;
$$;

-- Phase 5.1: FAQ matching function
CREATE OR REPLACE FUNCTION match_faq(p_tenant_id uuid, p_query text)
RETURNS TABLE(id uuid, answer text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT f.id, f.answer
  FROM public.faqs f, unnest(f.keywords) kw
  WHERE f.tenant_id = p_tenant_id
    AND position(lower(trim(kw)) in lower(p_query)) > 0
    AND trim(kw) != ''
  LIMIT 1;
$$;



-- MIGRATION: 20260716000002_add_campaign_state.sql
ALTER TABLE drip_enrollments ADD COLUMN IF NOT EXISTS current_step_order INTEGER NOT NULL DEFAULT 1;
ALTER TABLE drip_enrollments ADD COLUMN IF NOT EXISTS next_step_at TIMESTAMPTZ DEFAULT now();


-- MIGRATION: 20260716000003_fix_is_internal_column.sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='messages' AND column_name='is_internal'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN is_internal BOOLEAN DEFAULT false;
  END IF;
END $$;


-- MIGRATION: 20260716000004_fix_dashboard_response_times.sql
-- Optimization: Improve get_dashboard_metrics performance and separate AI vs Agent response times
-- Fixes latency on the SaaS dashboard and provides accurate separated metrics.

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_tenant_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total_messages BIGINT;
  v_bot_handled_count BIGINT;
  v_faq_match_total BIGINT;
  v_handover_count BIGINT;
  v_recent_handovers JSON;
  v_time_series JSON;
  v_topic_distribution JSON;
  v_current_usage JSON;
  v_avg_ai_response_time INT;
  v_avg_agent_response_time INT;
BEGIN
  -- Total messages
  SELECT COUNT(*) INTO v_total_messages 
  FROM public.messages 
  WHERE tenant_id = p_tenant_id;
  
  -- Bot handled count (from conversations resolved without an assigned agent)
  SELECT COUNT(*) INTO v_bot_handled_count 
  FROM public.conversations 
  WHERE tenant_id = p_tenant_id 
    AND status = 'resolved' 
    AND assigned_agent_id IS NULL;
    
  -- FAQ match total
  SELECT COALESCE(SUM(match_count), 0) INTO v_faq_match_total 
  FROM public.faqs 
  WHERE tenant_id = p_tenant_id;
  
  -- Handover count
  SELECT COUNT(*) INTO v_handover_count 
  FROM public.conversations 
  WHERE tenant_id = p_tenant_id 
    AND status IN ('handover_pending', 'handover_active');
    
  -- Recent handovers (up to 5)
  SELECT COALESCE(json_agg(row_to_json(rh)), '[]'::json) INTO v_recent_handovers
  FROM (
    SELECT id, customer_phone, last_message_at, status, handover_reason
    FROM public.conversations
    WHERE tenant_id = p_tenant_id
      AND status = 'handover_pending'
    ORDER BY last_message_at DESC
    LIMIT 5
  ) rh;
  
  -- Pre-calculate response times for last 7 days to avoid repeated full table scans
  CREATE TEMP TABLE IF NOT EXISTS temp_resp_times (
    d DATE,
    sender TEXT,
    resp_time NUMERIC
  ) ON COMMIT DROP;
  
  -- Clear temp table in case of pooled connections
  DELETE FROM temp_resp_times;
  
  INSERT INTO temp_resp_times
  SELECT 
      inbound.created_at::date as d,
      outbound.sender,
      EXTRACT(EPOCH FROM (outbound.created_at - inbound.created_at)) as resp_time
  FROM (
      SELECT conversation_id, created_at
      FROM public.messages
      WHERE tenant_id = p_tenant_id 
      AND direction = 'inbound'
      AND created_at >= (current_date - interval '7 days')
  ) inbound
  JOIN LATERAL (
      SELECT created_at, sender
      FROM public.messages
      WHERE conversation_id = inbound.conversation_id 
      AND direction = 'outbound' 
      AND created_at > inbound.created_at
      ORDER BY created_at ASC
      LIMIT 1
  ) outbound ON true;

  -- Overall averages
  SELECT 
      COALESCE(AVG(CASE WHEN sender = 'bot' THEN resp_time END), 0)::int,
      COALESCE(AVG(CASE WHEN sender = 'agent' THEN resp_time END), 0)::int
  INTO v_avg_ai_response_time, v_avg_agent_response_time
  FROM temp_resp_times;

  -- Time series (last 7 days)
  SELECT COALESCE(json_agg(ts), '[]'::json) INTO v_time_series
  FROM (
    WITH dates AS (
      SELECT generate_series(
        current_date - interval '6 days',
        current_date,
        interval '1 day'
      )::date AS d
    )
    SELECT 
      to_char(d.d, 'Dy') AS name,
      d.d::text AS "fullDate",
      COALESCE(SUM(CASE WHEN m.id IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS messages,
      COALESCE(SUM(CASE WHEN m.sender = 'bot' THEN 1 ELSE 0 END), 0)::int AS "botHandled",
      COALESCE((SELECT AVG(resp_time) FROM temp_resp_times rt WHERE rt.d = d.d AND rt.sender = 'agent'), 0)::int AS "agentResponseTime",
      COALESCE((SELECT AVG(resp_time) FROM temp_resp_times rt WHERE rt.d = d.d AND rt.sender = 'bot'), 0)::int AS "aiResponseTime"
    FROM dates d
    LEFT JOIN public.messages m 
      ON m.tenant_id = p_tenant_id 
      AND m.created_at >= d.d
      AND m.created_at < (d.d + interval '1 day')
    GROUP BY d.d
    ORDER BY d.d ASC
  ) ts;
  
  -- Topic Distribution
  SELECT COALESCE(json_agg(td), '[]'::json) INTO v_topic_distribution
  FROM (
    SELECT topic as name, COUNT(*) as value
    FROM public.conversation_topics
    WHERE tenant_id = p_tenant_id
    GROUP BY topic
    ORDER BY value DESC
    LIMIT 6
  ) td;

  -- Current Usage
  SELECT COALESCE(
    (
      SELECT row_to_json(ut)
      FROM public.usage_tracking ut
      WHERE tenant_id = p_tenant_id AND billing_period = date_trunc('month', current_date)::date
    ),
    '{"messages_sent":0,"llm_calls":0,"stt_minutes":0}'::json
  ) INTO v_current_usage;

  RETURN json_build_object(
    'totalMessages', v_total_messages,
    'botHandledCount', v_bot_handled_count,
    'faqMatchTotal', v_faq_match_total,
    'handoverCount', v_handover_count,
    'recentHandovers', v_recent_handovers,
    'timeSeries', v_time_series,
    'topicDistribution', v_topic_distribution,
    'currentUsage', v_current_usage,
    'avgAiResponseTime', v_avg_ai_response_time,
    'avgAgentResponseTime', v_avg_agent_response_time
  );
END;
$$;


-- MIGRATION: 20260716000005_wake_resolved_conversations.sql
-- Fix: Wake up resolved conversations when a new message arrives
CREATE OR REPLACE FUNCTION process_inbound_message(
  p_phone_number_id text,
  p_customer_phone text,
  p_customer_name text,
  p_message_type text,
  p_content text,
  p_media_url text,
  p_transcript text,
  p_wa_message_id text,
  p_timestamp timestamptz
) RETURNS json AS $$
DECLARE
  v_tenant_id uuid;
  v_conversation_id uuid;
  v_conv_status text;
  v_message_id uuid;
BEGIN
  -- 1. Identify Tenant (now filters by is_active = true)
  SELECT tenant_id INTO v_tenant_id
  FROM tenant_bsp_config
  WHERE (phone_number_id = p_phone_number_id OR waba_id = p_phone_number_id)
    AND is_active = true
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'reason', 'tenant_not_found');
  END IF;

  -- 2. Find or Create Conversation
  SELECT id, status INTO v_conversation_id, v_conv_status
  FROM conversations
  WHERE tenant_id = v_tenant_id AND customer_phone = p_customer_phone;

  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (tenant_id, customer_phone, customer_name, status, last_customer_message_at, last_message_at)
    VALUES (v_tenant_id, p_customer_phone, COALESCE(p_customer_name, 'Customer'), 'bot', p_timestamp, p_timestamp)
    RETURNING id, status INTO v_conversation_id, v_conv_status;
  ELSE
    -- Wake up the conversation if it was resolved
    IF v_conv_status = 'resolved' THEN
      v_conv_status := 'bot';
    END IF;

    UPDATE conversations
    SET last_customer_message_at = p_timestamp,
        last_message_at = p_timestamp,
        status = v_conv_status
    WHERE id = v_conversation_id;
  END IF;

  -- 3. Insert Message (handling duplicates safely)
  BEGIN
    INSERT INTO messages (conversation_id, tenant_id, direction, message_type, content, media_url, transcript, wa_message_id, sender)
    VALUES (v_conversation_id, v_tenant_id, 'inbound', p_message_type, p_content, p_media_url, p_transcript, p_wa_message_id, 'customer')
    RETURNING id INTO v_message_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object(
      'status', 'duplicate',
      'tenant_id', v_tenant_id,
      'conversation_id', v_conversation_id,
      'conv_status', v_conv_status
    );
  END;

  -- 4. Return success
  RETURN json_build_object(
    'status', 'success',
    'tenant_id', v_tenant_id,
    'conversation_id', v_conversation_id,
    'conv_status', v_conv_status,
    'message_id', v_message_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- MIGRATION: 20260716000006_fix_inbound_search_path.sql
-- Fix: Wake up resolved conversations when a new message arrives
CREATE OR REPLACE FUNCTION process_inbound_message(
  p_phone_number_id text,
  p_customer_phone text,
  p_customer_name text,
  p_message_type text,
  p_content text,
  p_media_url text,
  p_transcript text,
  p_wa_message_id text,
  p_timestamp timestamptz
) RETURNS json AS $$
DECLARE
  v_tenant_id uuid;
  v_conversation_id uuid;
  v_conv_status text;
  v_message_id uuid;
BEGIN
  -- 1. Identify Tenant (now filters by is_active = true)
  SELECT tenant_id INTO v_tenant_id
  FROM tenant_bsp_config
  WHERE (phone_number_id = p_phone_number_id OR waba_id = p_phone_number_id)
    AND is_active = true
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'reason', 'tenant_not_found');
  END IF;

  -- 2. Find or Create Conversation
  SELECT id, status INTO v_conversation_id, v_conv_status
  FROM conversations
  WHERE tenant_id = v_tenant_id AND customer_phone = p_customer_phone;

  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (tenant_id, customer_phone, customer_name, status, last_customer_message_at, last_message_at)
    VALUES (v_tenant_id, p_customer_phone, COALESCE(p_customer_name, 'Customer'), 'bot', p_timestamp, p_timestamp)
    RETURNING id, status INTO v_conversation_id, v_conv_status;
  ELSE
    -- Wake up the conversation if it was resolved
    IF v_conv_status = 'resolved' THEN
      v_conv_status := 'bot';
    END IF;

    UPDATE conversations
    SET last_customer_message_at = p_timestamp,
        last_message_at = p_timestamp,
        status = v_conv_status
    WHERE id = v_conversation_id;
  END IF;

  -- 3. Insert Message (handling duplicates safely)
  BEGIN
    INSERT INTO messages (conversation_id, tenant_id, direction, message_type, content, media_url, transcript, wa_message_id, sender)
    VALUES (v_conversation_id, v_tenant_id, 'inbound', p_message_type, p_content, p_media_url, p_transcript, p_wa_message_id, 'customer')
    RETURNING id INTO v_message_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object(
      'status', 'duplicate',
      'tenant_id', v_tenant_id,
      'conversation_id', v_conversation_id,
      'conv_status', v_conv_status
    );
  END;

  -- 4. Return success
  RETURN json_build_object(
    'status', 'success',
    'tenant_id', v_tenant_id,
    'conversation_id', v_conversation_id,
    'conv_status', v_conv_status,
    'message_id', v_message_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- MIGRATION: 20260716000007_add_is_new_session_flag.sql
-- Fix: Add is_new_session flag to process_inbound_message
CREATE OR REPLACE FUNCTION process_inbound_message(
  p_phone_number_id text,
  p_customer_phone text,
  p_customer_name text,
  p_message_type text,
  p_content text,
  p_media_url text,
  p_transcript text,
  p_wa_message_id text,
  p_timestamp timestamptz
) RETURNS json AS $$
DECLARE
  v_tenant_id uuid;
  v_conversation_id uuid;
  v_conv_status text;
  v_message_id uuid;
  v_is_new_session boolean := false;
BEGIN
  -- 1. Identify Tenant (now filters by is_active = true)
  SELECT tenant_id INTO v_tenant_id
  FROM tenant_bsp_config
  WHERE (phone_number_id = p_phone_number_id OR waba_id = p_phone_number_id)
    AND is_active = true
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'reason', 'tenant_not_found');
  END IF;

  -- 2. Find or Create Conversation
  SELECT id, status INTO v_conversation_id, v_conv_status
  FROM conversations
  WHERE tenant_id = v_tenant_id AND customer_phone = p_customer_phone;

  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (tenant_id, customer_phone, customer_name, status, last_customer_message_at, last_message_at)
    VALUES (v_tenant_id, p_customer_phone, COALESCE(p_customer_name, 'Customer'), 'bot', p_timestamp, p_timestamp)
    RETURNING id, status INTO v_conversation_id, v_conv_status;
    
    v_is_new_session := true;
  ELSE
    -- Wake up the conversation if it was resolved
    IF v_conv_status = 'resolved' THEN
      v_conv_status := 'bot';
      v_is_new_session := true;
    END IF;

    UPDATE conversations
    SET last_customer_message_at = p_timestamp,
        last_message_at = p_timestamp,
        status = v_conv_status
    WHERE id = v_conversation_id;
  END IF;

  -- 3. Insert Message (handling duplicates safely)
  BEGIN
    INSERT INTO messages (conversation_id, tenant_id, direction, message_type, content, media_url, transcript, wa_message_id, sender)
    VALUES (v_conversation_id, v_tenant_id, 'inbound', p_message_type, p_content, p_media_url, p_transcript, p_wa_message_id, 'customer')
    RETURNING id INTO v_message_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object(
      'status', 'duplicate',
      'tenant_id', v_tenant_id,
      'conversation_id', v_conversation_id,
      'conv_status', v_conv_status
    );
  END;

  -- 4. Return success
  RETURN json_build_object(
    'status', 'success',
    'tenant_id', v_tenant_id,
    'conversation_id', v_conversation_id,
    'conv_status', v_conv_status,
    'message_id', v_message_id,
    'is_new_session', v_is_new_session
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- MIGRATION: 20260716000008_atomic_quota_reservation.sql
-- Migration: Atomic Quota Reservation
-- Replaces TOCTOU vulnerable check_tenant_quota with atomic lock and decrement

CREATE OR REPLACE FUNCTION reserve_tenant_quota(p_tenant_id uuid)
RETURNS boolean AS $$
DECLARE
  v_cap_messages integer;
  v_used_messages integer;
  v_billing_period date;
BEGIN
  -- 1. Get the tenant's current cap limit from subscriptions
  SELECT cap_messages INTO v_cap_messages 
  FROM subscriptions 
  WHERE tenant_id = p_tenant_id 
    AND status = 'active';

  IF v_cap_messages IS NULL THEN
    RETURN FALSE;
  END IF;

  v_billing_period := date_trunc('month', current_date)::date;

  -- 2. Ensure row exists so we can lock it
  INSERT INTO usage_tracking (tenant_id, billing_period, messages_sent, llm_calls, stt_minutes)
  VALUES (p_tenant_id, v_billing_period, 0, 0, 0)
  ON CONFLICT DO NOTHING;

  -- 3. Lock the row for update (prevents concurrent checks from reading stale data)
  SELECT messages_sent INTO v_used_messages
  FROM usage_tracking
  WHERE tenant_id = p_tenant_id
    AND billing_period = v_billing_period
  FOR UPDATE;

  -- 4. Check quota and atomically reserve
  IF v_used_messages >= v_cap_messages THEN
    RETURN FALSE;
  ELSE
    -- Reserve one message slot
    UPDATE usage_tracking 
    SET messages_sent = messages_sent + 1 
    WHERE tenant_id = p_tenant_id 
      AND billing_period = v_billing_period;
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expose to API if necessary
ALTER FUNCTION public.reserve_tenant_quota(uuid) SET search_path = '';

CREATE OR REPLACE FUNCTION refund_tenant_quota(p_tenant_id uuid)
RETURNS void AS $$
DECLARE
  v_billing_period date;
BEGIN
  v_billing_period := date_trunc('month', current_date)::date;
  
  UPDATE usage_tracking 
  SET messages_sent = GREATEST(0, messages_sent - 1)
  WHERE tenant_id = p_tenant_id 
    AND billing_period = v_billing_period;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.refund_tenant_quota(uuid) SET search_path = '';


-- MIGRATION: 20260716000009_auto_resolve_rpc.sql
-- Migration: Auto Resolve Stale Conversations RPC

CREATE OR REPLACE FUNCTION auto_resolve_stale_conversations()
RETURNS void AS $$
BEGIN
  -- Auto-resolve handover_active conversations inactive for 24 hours
  UPDATE conversations 
  SET 
    status = 'resolved',
    resolved_at = NOW(),
    updated_at = NOW()
  WHERE 
    status = 'handover_active' 
    AND updated_at < NOW() - INTERVAL '24 hours';

  -- Escalate handover_pending conversations unclaimed for 24 hours
  -- (We just mark them as escalated here, a separate system or webhook could alert the admin)
  -- For now, we will just log or resolve them if no one claims them, but let's just resolve them 
  -- with a note so they don't sit in the queue forever.
  UPDATE conversations 
  SET 
    status = 'resolved',
    handover_summary = handover_summary || ' [Auto-closed: Unclaimed for 24 hours]',
    resolved_at = NOW(),
    updated_at = NOW()
  WHERE 
    status = 'handover_pending' 
    AND updated_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.auto_resolve_stale_conversations() SET search_path = '';


-- MIGRATION: 20260716000010_remove_gupshup.sql
-- Update existing records
UPDATE tenant_bsp_config
SET bsp_provider = 'meta'
WHERE bsp_provider = 'gupshup';

-- Change default to 'meta'
ALTER TABLE tenant_bsp_config
ALTER COLUMN bsp_provider SET DEFAULT 'meta';


-- MIGRATION: 20260716000011_conversation_summary.sql
-- Add summary column to conversations for long-term memory
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS summary TEXT;


-- MIGRATION: 20260716000012_contact_memory.sql
-- Add interaction_history array to contacts table for long-term AI memory

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS interaction_history jsonb[] DEFAULT '{}';


-- MIGRATION: 20260716000013_occ_version.sql
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;


-- MIGRATION: 20260716000015_ultimate_rag.sql
-- 1. Semantic Caching Table
CREATE TABLE IF NOT EXISTS semantic_cache (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  query_embedding vector(1536) not null,
  response text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE INDEX IF NOT EXISTS idx_semantic_cache_tenant ON semantic_cache(tenant_id);
-- HNSW index for ultra-fast vector search on cache
CREATE INDEX IF NOT EXISTS idx_semantic_cache_embedding ON semantic_cache USING hnsw (query_embedding vector_cosine_ops);

-- Enable RLS
ALTER TABLE semantic_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants can access own semantic cache" ON semantic_cache FOR ALL USING (tenant_id = auth.uid());

-- 2. Small-to-Big Retrieval Schema (Sentence Windowing)
-- We add a context_window column to hold the larger paragraph.
-- The existing `content` column will now represent the small "Sentence Chunk".
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS context_window text;

-- Add FTS column for BM25 hybrid search
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_fts ON knowledge_chunks USING GIN (fts);

-- 3. Semantic Cache Match Function
CREATE OR REPLACE FUNCTION match_semantic_cache(
  query_embedding vector(1536),
  match_threshold float,
  p_tenant_id uuid
)
RETURNS TABLE (
  id uuid,
  response text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.response,
    1 - (sc.query_embedding <=> query_embedding) AS similarity
  FROM semantic_cache sc
  WHERE sc.tenant_id = p_tenant_id
    AND 1 - (sc.query_embedding <=> query_embedding) > match_threshold
  ORDER BY sc.query_embedding <=> query_embedding
  LIMIT 1;
END;
$$;

-- 4. Hybrid Search Function (Vector + BM25 with Reciprocal Rank Fusion)
CREATE OR REPLACE FUNCTION match_knowledge_hybrid(
  query_text text,
  query_embedding vector(1536),
  match_count int,
  p_tenant_id uuid,
  full_text_weight float DEFAULT 1.0,
  semantic_weight float DEFAULT 1.0,
  rrf_k int DEFAULT 60
)
RETURNS TABLE (
  id uuid,
  content text,
  context_window text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH full_text AS (
    SELECT
      kc.id,
      ROW_NUMBER() OVER(ORDER BY ts_rank_cd(kc.fts, websearch_to_tsquery('english', query_text)) DESC) AS rank_ix
    FROM knowledge_chunks kc
    WHERE kc.tenant_id = p_tenant_id
      AND kc.fts @@ websearch_to_tsquery('english', query_text)
    ORDER BY rank_ix
    LIMIT LEAST(match_count * 2, 50)
  ),
  semantic AS (
    SELECT
      kc.id,
      ROW_NUMBER() OVER(ORDER BY kc.embedding <=> query_embedding) AS rank_ix
    FROM knowledge_chunks kc
    WHERE kc.tenant_id = p_tenant_id
    ORDER BY rank_ix
    LIMIT LEAST(match_count * 2, 50)
  )
  SELECT
    kc.id,
    kc.content,
    kc.context_window,
    -- Reciprocal Rank Fusion (RRF) score
    COALESCE(1.0 / (rrf_k + f.rank_ix), 0.0) * full_text_weight +
    COALESCE(1.0 / (rrf_k + s.rank_ix), 0.0) * semantic_weight AS similarity
  FROM knowledge_chunks kc
  LEFT JOIN full_text f ON f.id = kc.id
  LEFT JOIN semantic s ON s.id = kc.id
  WHERE kc.tenant_id = p_tenant_id AND (f.id IS NOT NULL OR s.id IS NOT NULL)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;


-- MIGRATION: 20260716000016_faq_draft_status.sql
-- Migration: Add status column to FAQs to prevent hallucination loops
-- This ensures that Auto-FAQ Miner generated FAQs don't go live immediately.

ALTER TABLE faqs 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'published' 
CHECK (status IN ('published', 'draft', 'rejected'));


-- MIGRATION: 20260716000020_audit_fixes.sql
-- Fix C-1: Re-add contact upsert to process_inbound_message
CREATE OR REPLACE FUNCTION process_inbound_message(
  p_phone_number_id text,
  p_customer_phone text,
  p_customer_name text,
  p_message_type text,
  p_content text,
  p_media_url text,
  p_transcript text,
  p_wa_message_id text,
  p_timestamp timestamptz
) RETURNS json AS $$
DECLARE
  v_tenant_id uuid;
  v_conversation_id uuid;
  v_conv_status text;
  v_message_id uuid;
  v_is_new_session boolean := false;
BEGIN
  -- 1. Identify Tenant (now filters by is_active = true)
  SELECT tenant_id INTO v_tenant_id
  FROM tenant_bsp_config
  WHERE (phone_number_id = p_phone_number_id OR waba_id = p_phone_number_id)
    AND is_active = true
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'reason', 'tenant_not_found');
  END IF;

  -- 1.5 Upsert Contact
  INSERT INTO contacts (tenant_id, phone_number, name, last_contacted_at)
  VALUES (v_tenant_id, p_customer_phone, p_customer_name, p_timestamp)
  ON CONFLICT (tenant_id, phone_number)
  DO UPDATE SET 
    last_contacted_at = p_timestamp,
    name = COALESCE(contacts.name, EXCLUDED.name);

  -- 2. Find or Create Conversation
  SELECT id, status INTO v_conversation_id, v_conv_status
  FROM conversations
  WHERE tenant_id = v_tenant_id AND customer_phone = p_customer_phone;

  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (tenant_id, customer_phone, customer_name, status, last_customer_message_at, last_message_at)
    VALUES (v_tenant_id, p_customer_phone, COALESCE(p_customer_name, 'Customer'), 'bot', p_timestamp, p_timestamp)
    RETURNING id, status INTO v_conversation_id, v_conv_status;
    
    v_is_new_session := true;
  ELSE
    -- Wake up the conversation if it was resolved
    IF v_conv_status = 'resolved' THEN
      v_conv_status := 'bot';
      v_is_new_session := true;
    END IF;

    UPDATE conversations
    SET last_customer_message_at = p_timestamp,
        last_message_at = p_timestamp,
        status = v_conv_status
    WHERE id = v_conversation_id;
  END IF;

  -- 3. Insert Message (handling duplicates safely)
  BEGIN
    INSERT INTO messages (conversation_id, tenant_id, direction, message_type, content, media_url, transcript, wa_message_id, sender)
    VALUES (v_conversation_id, v_tenant_id, 'inbound', p_message_type, p_content, p_media_url, p_transcript, p_wa_message_id, 'customer')
    RETURNING id INTO v_message_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object(
      'status', 'duplicate',
      'tenant_id', v_tenant_id,
      'conversation_id', v_conversation_id,
      'conv_status', v_conv_status
    );
  END;

  -- 4. Return success
  RETURN json_build_object(
    'status', 'success',
    'tenant_id', v_tenant_id,
    'conversation_id', v_conversation_id,
    'conv_status', v_conv_status,
    'message_id', v_message_id,
    'is_new_session', v_is_new_session
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;





-- Fix H-9: Fix semantic_cache RLS policy
-- Need to drop the old policy first if it exists
DROP POLICY IF EXISTS "Tenants can access own semantic cache" ON semantic_cache;

CREATE POLICY "Tenants can access own semantic cache" ON semantic_cache
  FOR ALL USING (is_tenant_member(tenant_id));

-- Fix M-4: FAQ Matcher RPC
CREATE OR REPLACE FUNCTION match_faq(p_tenant_id uuid, p_query text)
RETURNS TABLE (faq_id uuid, answer text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT f.id, f.answer
  FROM faqs f, unnest(f.keywords) AS kw
  WHERE f.tenant_id = p_tenant_id
    AND p_query ILIKE '%' || trim(kw) || '%'
  LIMIT 1;
END;
$$;


-- MIGRATION: 20260720000001_fix_process_inbound_message_contact_upsert.sql
-- Migration: Restore contact upsert in process_inbound_message
-- C-1 Fix: The 20260716000007 migration dropped the contacts upsert block.
-- This restores it and also fixes the search_path security definer requirement.

CREATE OR REPLACE FUNCTION process_inbound_message(
  p_phone_number_id text,
  p_customer_phone text,
  p_customer_name text,
  p_message_type text,
  p_content text,
  p_media_url text,
  p_transcript text,
  p_wa_message_id text,
  p_timestamp timestamptz
) RETURNS json AS $$
DECLARE
  v_tenant_id uuid;
  v_conversation_id uuid;
  v_conv_status text;
  v_message_id uuid;
  v_is_new_session boolean := false;
BEGIN
  -- 1. Identify Tenant (filter by is_active to prevent disabled configs from routing)
  SELECT tenant_id INTO v_tenant_id
  FROM public.tenant_bsp_config
  WHERE (phone_number_id = p_phone_number_id OR waba_id = p_phone_number_id)
    AND is_active = true
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'reason', 'tenant_not_found');
  END IF;

  -- 2. Upsert Contact (Mini-CRM) — restored from 20260715000002
  INSERT INTO public.contacts (tenant_id, phone_number, name, last_contacted_at)
  VALUES (v_tenant_id, p_customer_phone, p_customer_name, p_timestamp)
  ON CONFLICT (tenant_id, phone_number)
  DO UPDATE SET
    last_contacted_at = p_timestamp,
    -- Only update name if the contact doesn't already have one
    name = COALESCE(public.contacts.name, EXCLUDED.name);

  -- 3. Find or Create Conversation
  SELECT id, status INTO v_conversation_id, v_conv_status
  FROM public.conversations
  WHERE tenant_id = v_tenant_id AND customer_phone = p_customer_phone;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (
      tenant_id, customer_phone, customer_name, status,
      last_customer_message_at, last_message_at
    )
    VALUES (
      v_tenant_id, p_customer_phone, COALESCE(p_customer_name, 'Customer'), 'bot',
      p_timestamp, p_timestamp
    )
    RETURNING id, status INTO v_conversation_id, v_conv_status;

    v_is_new_session := true;

  ELSE
    -- Wake up a resolved conversation when the customer messages again
    IF v_conv_status = 'resolved' THEN
      v_conv_status := 'bot';
      v_is_new_session := true;
    END IF;

    UPDATE public.conversations
    SET
      last_customer_message_at = p_timestamp,
      last_message_at = p_timestamp,
      status = v_conv_status
    WHERE id = v_conversation_id;
  END IF;

  -- 4. Insert Message (idempotent: handles duplicates safely via unique wa_message_id)
  BEGIN
    INSERT INTO public.messages (
      conversation_id, tenant_id, direction, message_type,
      content, media_url, transcript, wa_message_id, sender
    )
    VALUES (
      v_conversation_id, v_tenant_id, 'inbound', p_message_type,
      p_content, p_media_url, p_transcript, p_wa_message_id, 'customer'
    )
    RETURNING id INTO v_message_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object(
      'status', 'duplicate',
      'tenant_id', v_tenant_id,
      'conversation_id', v_conversation_id,
      'conv_status', v_conv_status,
      'is_new_session', v_is_new_session
    );
  END;

  -- 5. Return success with all required fields
  RETURN json_build_object(
    'status', 'success',
    'tenant_id', v_tenant_id,
    'conversation_id', v_conversation_id,
    'conv_status', v_conv_status,
    'message_id', v_message_id,
    'is_new_session', v_is_new_session
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';


-- MIGRATION: 20260720000002_widget_token_and_flow_state.sql
-- Migration: C-2 Widget token auth + H-8 Flow state tracking + H-9 Semantic cache RLS fix

-- ============================================================
-- C-2: Widget token table for secure widget authentication
-- ============================================================
CREATE TABLE IF NOT EXISTS public.widget_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_widget_tokens_token ON public.widget_tokens(token) WHERE is_active = true;

ALTER TABLE public.widget_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can manage widget tokens"
  ON public.widget_tokens FOR ALL
  USING (public.is_tenant_admin(tenant_id));

-- RPC for tenants to rotate their widget token
CREATE OR REPLACE FUNCTION public.rotate_widget_token(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_token text;
BEGIN
  v_token := 'wgt_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.widget_tokens (tenant_id, token)
  VALUES (p_tenant_id, v_token)
  ON CONFLICT (tenant_id) DO UPDATE SET token = EXCLUDED.token;

  RETURN v_token;
END;
$$;

-- ============================================================
-- H-8: Conversation flow state tracking for multi-step flows
-- ============================================================



-- ============================================================
-- H-9: Fix semantic_cache RLS — tenant_id != auth.uid()
-- ============================================================
DROP POLICY IF EXISTS "Tenants can access own semantic cache" ON public.semantic_cache;

CREATE POLICY "Tenant members can access own semantic cache"
  ON public.semantic_cache FOR ALL
  USING (public.is_tenant_member(tenant_id));

-- ============================================================
-- M-6: Postgres advisory lock helper for pipeline concurrency
-- Used by Node.js pipeline to prevent multi-instance race conditions
-- ============================================================
CREATE OR REPLACE FUNCTION public.acquire_conversation_lock(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_try_advisory_xact_lock(hashtext(p_conversation_id::text));
$$;

-- ============================================================
-- M-16: Fix semantic_cache missing search_path on match function
-- ============================================================
CREATE OR REPLACE FUNCTION public.match_semantic_cache(
  query_embedding vector(1536),
  match_threshold float,
  p_tenant_id uuid
)
RETURNS TABLE (
  id uuid,
  response text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.response,
    1 - (sc.query_embedding <=> query_embedding) AS similarity
  FROM public.semantic_cache sc
  WHERE sc.tenant_id = p_tenant_id
    AND 1 - (sc.query_embedding <=> query_embedding) > match_threshold
  ORDER BY sc.query_embedding <=> query_embedding
  LIMIT 1;
END;
$$;


-- MIGRATION: 20260720000003_shopify_secret_path.sql
-- Migration: C-3 Shopify webhook secret path token
-- Adds a per-tenant secret URL token so the Shopify webhook URL no longer
-- exposes tenant_id as a query param (cross-tenant injection fix).

ALTER TABLE public.shopify_settings
  ADD COLUMN IF NOT EXISTS webhook_path_token text UNIQUE;

-- Populate existing rows with a random token
UPDATE public.shopify_settings
SET webhook_path_token = 'shpwh_' || replace(gen_random_uuid()::text, '-', '')
WHERE webhook_path_token IS NULL;

-- Make it NOT NULL going forward
ALTER TABLE public.shopify_settings
  ALTER COLUMN webhook_path_token SET NOT NULL,
  ALTER COLUMN webhook_path_token SET DEFAULT ('shpwh_' || replace(gen_random_uuid()::text, '-', ''));

CREATE INDEX IF NOT EXISTS idx_shopify_webhook_path_token
  ON public.shopify_settings(webhook_path_token)
  WHERE is_active = true;

COMMENT ON COLUMN public.shopify_settings.webhook_path_token IS
  'Secret token embedded in the Shopify webhook URL path. Never expose tenant_id in webhook URLs.';


-- MIGRATION: 20260721000000_marketing_phase_1.sql
-- Phase 1: Marketing & Webhooks Foundation

-- 1. Add attributes to contacts for deep segmentation
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}'::jsonb;

-- 2. Broadcasts Table
CREATE TABLE IF NOT EXISTS broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'processing', 'completed', 'failed')),
    template_name TEXT NOT NULL,
    audience_filter JSONB, -- Stores the segmentation rules (e.g., {"tags": ["VIP"], "city": "Delhi"})
    scheduled_at TIMESTAMPTZ,
    total_recipients INTEGER DEFAULT 0,
    successful_sends INTEGER DEFAULT 0,
    failed_sends INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_tenant ON broadcasts(tenant_id);

ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their tenant's broadcasts"
ON broadcasts FOR ALL TO authenticated
USING (is_tenant_member(tenant_id));

-- 3. Webhook Subscriptions Table (for Zapier/Make integrations)
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}', -- e.g., ['message.received', 'contact.created', 'order.placed']
    secret TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_subs_tenant ON webhook_subscriptions(tenant_id);

ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their tenant's webhook subscriptions"
ON webhook_subscriptions FOR ALL TO authenticated
USING (is_tenant_member(tenant_id));

-- Helper RPC for matching audience
CREATE OR REPLACE FUNCTION get_broadcast_audience(p_tenant_id uuid, p_tags text[] DEFAULT NULL)
RETURNS TABLE(contact_id uuid, phone_number text, name text, attributes jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_tags IS NULL OR array_length(p_tags, 1) IS NULL THEN
    RETURN QUERY SELECT c.id, c.phone_number, c.name, c.attributes 
                 FROM contacts c WHERE c.tenant_id = p_tenant_id;
  ELSE
    RETURN QUERY SELECT c.id, c.phone_number, c.name, c.attributes 
                 FROM contacts c WHERE c.tenant_id = p_tenant_id AND c.tags && p_tags;
  END IF;
END;
$$;

-- RPCs for worker tracking
CREATE OR REPLACE FUNCTION increment_broadcast_success(p_broadcast_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE broadcasts 
  SET successful_sends = successful_sends + 1
  WHERE id = p_broadcast_id;
END;
$$;

CREATE OR REPLACE FUNCTION increment_broadcast_failure(p_broadcast_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE broadcasts 
  SET failed_sends = failed_sends + 1
  WHERE id = p_broadcast_id;
END;
$$;


-- MIGRATION: 20260721000001_ecommerce_phase_2.sql
-- Phase 2: E-Commerce Automation Schema

-- 1. E-Commerce Integrations
CREATE TABLE IF NOT EXISTS ecommerce_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('shopify', 'woocommerce', 'custom')),
    store_domain TEXT NOT NULL,
    access_token_encrypted TEXT,
    webhook_secret_encrypted TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_ecom_tenant ON ecommerce_integrations(tenant_id);

ALTER TABLE ecommerce_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their tenant's ecommerce integrations"
ON ecommerce_integrations FOR ALL TO authenticated
USING (is_tenant_member(tenant_id));

-- 2. Abandoned Carts
CREATE TABLE IF NOT EXISTS abandoned_carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    platform_cart_id TEXT NOT NULL,
    customer_phone TEXT,
    cart_url TEXT NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'recovered', 'abandoned', 'message_sent')),
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, platform_cart_id)
);

CREATE INDEX IF NOT EXISTS idx_carts_tenant ON abandoned_carts(tenant_id);

ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their tenant's abandoned carts"
ON abandoned_carts FOR SELECT TO authenticated
USING (is_tenant_member(tenant_id));

-- 3. Order Confirmations (For COD flows)
CREATE TABLE IF NOT EXISTS order_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    platform_order_id TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    is_cod BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'timeout')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, platform_order_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant ON order_confirmations(tenant_id);

ALTER TABLE order_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their tenant's order confirmations"
ON order_confirmations FOR SELECT TO authenticated
USING (is_tenant_member(tenant_id));


-- MIGRATION: 20260721000002_crm_phase_3.sql
-- Phase 3: CRM & Workflow Automation Schema

-- 1. Bot Flow Graphs (Visual Drag-and-Drop flow builder)
CREATE TABLE IF NOT EXISTS bot_flow_graphs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    nodes JSONB NOT NULL DEFAULT '[]'::jsonb, -- AST representation of flow nodes
    edges JSONB NOT NULL DEFAULT '[]'::jsonb, -- Connections between nodes
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flow_graphs_tenant ON bot_flow_graphs(tenant_id);

ALTER TABLE bot_flow_graphs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage tenant flow graphs"
ON bot_flow_graphs FOR ALL TO authenticated
USING (is_tenant_member(tenant_id));

-- 2. CRM Credentials
CREATE TABLE IF NOT EXISTS crm_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    crm_provider TEXT NOT NULL CHECK (crm_provider IN ('hubspot', 'salesforce', 'zoho')),
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    expires_at TIMESTAMPTZ,
    portal_id TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(tenant_id, crm_provider)
);

CREATE INDEX IF NOT EXISTS idx_crm_creds_tenant ON crm_credentials(tenant_id);

ALTER TABLE crm_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage tenant crm credentials"
ON crm_credentials FOR ALL TO authenticated
USING (is_tenant_member(tenant_id));

-- 3. Conversation Notes (Internal Mentions)
CREATE TABLE IF NOT EXISTS conversation_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_conv ON conversation_notes(conversation_id);

ALTER TABLE conversation_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read tenant notes"
ON conversation_notes FOR SELECT TO authenticated
USING (is_tenant_member(tenant_id));

CREATE POLICY "Users can insert tenant notes"
ON conversation_notes FOR INSERT TO authenticated
WITH CHECK (is_tenant_member(tenant_id));

-- 4. Add flow state to conversations table
ALTER TABLE conversations 
  ADD COLUMN IF NOT EXISTS active_flow_id uuid REFERENCES bot_flow_graphs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_node_id text,
  ADD COLUMN IF NOT EXISTS flow_state jsonb DEFAULT '{}';

COMMENT ON COLUMN conversations.active_flow_id IS 'The bot flow currently in progress for this conversation';
COMMENT ON COLUMN conversations.active_node_id IS 'The node ID the conversation is waiting at for user input';
COMMENT ON COLUMN conversations.flow_state IS 'Arbitrary state carried between flow nodes (e.g. collected form data)';


-- MIGRATION: 20260721000003_growth_phase_4.sql
-- Phase 4: Growth Tools & Analytics Schema

-- 1. Widget Configurations
CREATE TABLE IF NOT EXISTS widget_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL UNIQUE,
    theme_color TEXT DEFAULT '#25D366',
    greeting_message TEXT DEFAULT 'Hi there! How can we help you today?',
    business_hours JSONB DEFAULT '{"enabled": false}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE widget_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read widget config"
ON widget_configurations FOR SELECT TO anon, authenticated
USING (true); -- Public so embed script can fetch it

CREATE POLICY "Users can manage tenant widget config"
ON widget_configurations FOR ALL TO authenticated
USING (is_tenant_member(tenant_id));

-- 2. CTWA Ad Conversions
CREATE TABLE IF NOT EXISTS ctwa_ad_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    ad_id TEXT,
    ad_title TEXT,
    source_url TEXT,
    customer_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ctwa_tenant ON ctwa_ad_conversions(tenant_id);

ALTER TABLE ctwa_ad_conversions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view tenant ad conversions"
ON ctwa_ad_conversions FOR SELECT TO authenticated
USING (is_tenant_member(tenant_id));

-- 3. Interactive Templates
CREATE TABLE IF NOT EXISTS interactive_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('button', 'list', 'carousel')),
    body TEXT NOT NULL,
    components JSONB NOT NULL DEFAULT '[]'::jsonb, -- Action buttons, rows, etc
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_tenant ON interactive_templates(tenant_id);

ALTER TABLE interactive_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage tenant interactive templates"
ON interactive_templates FOR ALL TO authenticated
USING (is_tenant_member(tenant_id));


-- MIGRATION: 20260721000004_sla_hardening.sql
-- SLA Hardening: Add tracking flag to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS sla_breached BOOLEAN DEFAULT false;
