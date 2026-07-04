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
