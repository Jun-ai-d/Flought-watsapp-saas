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
$$ LANGUAGE plpgsql SECURITY DEFINER;
