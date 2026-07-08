import { Router } from 'express';
import { requireApiKey, ApiAuthRequest } from '../middleware/apiAuth';
import { supabaseAdmin } from '../lib/supabase';
import { getBSPProvider } from '../bsp/providerFactory';
import { decryptToken } from '../bsp/crypto';

const router = Router();

router.use(requireApiKey);

/**
 * POST /api/v1/conversations/:id/takeover
 * Forces the conversation into human handover mode, silencing the AI bot.
 */
router.post('/conversations/:id/takeover', async (req: ApiAuthRequest, res) => {
  const tenantId = req.tenantId;
  const conversationId = req.params.id;

  try {
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .update({ status: 'handover_active' })
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Conversation not found or failed to update' });
    }

    res.json({ success: true, conversation: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/conversations/:id/resolve
 * Resolves the handover and turns the AI bot back on.
 */
router.post('/conversations/:id/resolve', async (req: ApiAuthRequest, res) => {
  const tenantId = req.tenantId;
  const conversationId = req.params.id;

  try {
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .update({ status: 'bot', handover_reason: null, handover_summary: null })
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Conversation not found or failed to update' });
    }

    res.json({ success: true, conversation: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/messages/send
 * Sends an outbound message via the API (usually from CRM or Zapier).
 * This behaves similarly to the internal send route.
 */
router.post('/messages/send', async (req: ApiAuthRequest, res) => {
  const tenantId = req.tenantId;
  let { conversationId, text, providerName } = req.body;

  if (!providerName) {
    const { data: config } = await supabaseAdmin
      .from('tenant_bsp_config')
      .select('bsp_provider')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();
    providerName = config?.bsp_provider || 'meta';
  }

  if (!tenantId || !conversationId || !text) {
    return res.status(400).json({ error: 'Missing required fields: conversationId, text' });
  }

  try {
    // 1. Fetch conversation details
    const { data: conv, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('customer_phone')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .single();

    if (convError || !conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // 2. Load provider config for this tenant
    const { data: config } = await supabaseAdmin
      .from('tenant_bsp_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('bsp_provider', providerName)
      .single();

    if (!config) {
      return res.status(400).json({ error: 'BSP configuration not found for tenant' });
    }

    // 3. Dispatch to BSP
    const provider = getBSPProvider(providerName);
    
    const decryptedConfig = { ...config };
    if (decryptedConfig.access_token_encrypted) {
      decryptedConfig.access_token_encrypted = decryptToken(decryptedConfig.access_token_encrypted);
    }
    
    const sendResult = await provider.sendSessionMessage({
      tenantId,
      to: conv.customer_phone,
      content: { type: 'text', text },
      providerConfig: decryptedConfig
    });

    // 4. Save outbound message to database
    const { error: msgInsertError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        tenant_id: tenantId,
        direction: 'outbound',
        message_type: 'text',
        content: text,
        sender: 'agent', // marked as agent since it's via API (human)
        wa_message_id: sendResult.bspMessageId
      });

    if (msgInsertError) {
      console.error('Failed to save outbound message to DB:', msgInsertError);
    }
    
    // 5. Track message usage
    try { await supabaseAdmin.rpc('increment_usage', { p_tenant_id: tenantId, p_messages_sent: 1 }); } catch (e) { console.error(e); }

    res.json({ success: true, result: sendResult });
  } catch (error: any) {
    console.error('Error sending message via API:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * POST /api/v1/contacts
 * Adds or updates a contact programmatically (e.g., from a Zapier webhook).
 */
router.post('/contacts', async (req: ApiAuthRequest, res) => {
  const tenantId = req.tenantId;
  const { phone_number, name, tags = [] } = req.body;

  if (!tenantId || !phone_number) {
    return res.status(400).json({ error: 'Missing required field: phone_number' });
  }

  // Ensure phone_number is digits only
  const cleanPhone = String(phone_number).replace(/\D/g, '');

  try {
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .upsert({
        tenant_id: tenantId,
        phone_number: cleanPhone,
        name: name || 'Unknown Contact',
        tags: tags,
        status: 'active',
        opted_in: true
      }, { onConflict: 'tenant_id, phone_number' })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, contact: data });
  } catch (error: any) {
    console.error('Error adding contact via API:', error);
    res.status(500).json({ error: 'Failed to add contact' });
  }
});

export default router;
