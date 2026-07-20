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
