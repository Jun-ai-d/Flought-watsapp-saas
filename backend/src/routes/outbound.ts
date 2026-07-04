import { Router } from 'express';
import { getBSPProvider } from '../bsp/providerFactory';
import { supabaseAdmin } from '../lib/supabase';
import { requireTenantMember } from '../middleware/requireTenantMember';

const router = Router();

// Endpoint for frontend to send replies
router.post('/send', requireTenantMember, async (req, res) => {
  try {
    const { tenantId, conversationId, text, providerName = 'gupshup' } = req.body;

    if (!tenantId || !conversationId || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Fetch conversation details to get customer phone
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

    // 3. Dispatch to BSP
    const provider = getBSPProvider(providerName);
    const sendResult = await provider.sendSessionMessage({
      tenantId,
      to: conv.customer_phone,
      content: { type: 'text', text },
      providerConfig: config || {} // Pass decrypted token here in real life
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
        sender: 'agent',
        wa_message_id: sendResult.bspMessageId
      });

    if (msgInsertError) {
      console.error('Failed to save outbound message to DB:', msgInsertError);
    }

    res.json({ success: true, result: sendResult });
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
