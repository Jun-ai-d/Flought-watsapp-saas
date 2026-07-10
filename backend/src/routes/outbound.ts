import { Router } from 'express';
import { getBSPProvider } from '../bsp/providerFactory';
import { supabaseAdmin } from '../lib/supabase';
import { requireTenantMember } from '../middleware/requireTenantMember';
import { enforceQuota } from '../middleware/enforceQuota';
import { decryptToken } from '../bsp/crypto';

const router = Router();

// Endpoint for frontend to send replies
router.post('/send', requireTenantMember, enforceQuota, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    let { conversationId, text, providerName, isInternal = false, messageType = 'text', expectedVersion } = req.body;

    if (!providerName) {
      const { data: config } = await supabaseAdmin
        .from('tenant_bsp_config')
        .select('bsp_provider')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      providerName = config?.bsp_provider || 'meta';
    }

    if (!tenantId || !conversationId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!isInternal && messageType === 'text' && !text) {
      return res.status(400).json({ error: 'Text content is required' });
    }

    // 1. Fetch conversation details to get customer phone
    const { data: conv, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('customer_phone, version')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .single();

    if (convError || !conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // 1.2 Optimistic Concurrency Control
    if (expectedVersion !== undefined) {
      const { data: updatedConv, error: updateError } = await supabaseAdmin
        .from('conversations')
        .update({ version: expectedVersion + 1 })
        .eq('id', conversationId)
        .eq('version', expectedVersion)
        .select()
        .maybeSingle();

      if (updateError || !updatedConv) {
         return res.status(409).json({ error: 'Conflict: Conversation was modified by another agent or AI. Please refresh.' });
      }
    }

    let bspMessageId = `internal-${Date.now()}`;
    
    let sendResult = null;
    
    // Only send to WhatsApp if it's NOT an internal note
    if (!isInternal) {
      // 1.5 Enforce 24hr WhatsApp policy for human agent replies
      const { data: latestInbound } = await supabaseAdmin
        .from('messages')
        .select('created_at')
        .eq('conversation_id', conversationId)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestInbound) {
        const hoursSinceLastMessage = (Date.now() - new Date(latestInbound.created_at).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastMessage > 24) {
          return res.status(400).json({ error: 'Cannot send free-form message: Customer last replied over 24 hours ago. WhatsApp requires using an approved Template for new conversations.' });
        }
      }

      // 2. Load provider config for this tenant
      const { data: config, error: configError } = await supabaseAdmin
        .from('tenant_bsp_config')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('bsp_provider', providerName)
        .single();

      if (configError || !config) {
        return res.status(400).json({ error: 'No WhatsApp configuration found. Please complete setup in Settings.' });
      }

      // 3. Dispatch to BSP
      const provider = getBSPProvider(providerName);
      
      // Decrypt API key before passing to provider
      const decryptedConfig = { ...config };
      if (decryptedConfig.access_token_encrypted) {
        decryptedConfig.access_token_encrypted = decryptToken(decryptedConfig.access_token_encrypted);
      }
      
      let contentToSend: any = { type: 'text', text };
      
      if (messageType === 'catalog') {
        if (!config.catalog_id) {
           return res.status(400).json({ error: 'Catalog ID is not configured in WhatsApp Settings.' });
        }
        contentToSend = {
          type: 'catalog',
          text: 'View our Catalog' // Fallback text
        };
      }
      
      sendResult = await provider.sendSessionMessage({
        tenantId,
        to: conv.customer_phone,
        content: contentToSend,
        providerConfig: decryptedConfig
      });
      bspMessageId = sendResult.bspMessageId;
    }

    // 4. Save outbound message to database
    const { error: msgInsertError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        tenant_id: tenantId,
        direction: 'outbound',
        message_type: messageType,
        content: messageType === 'catalog' ? 'Sent Catalog' : text,
        sender: 'agent',
        wa_message_id: bspMessageId,
        is_internal: isInternal
      });

    if (msgInsertError) {
      console.error('Failed to save outbound message to DB:', msgInsertError);
    }
    
    // 5. Track message usage (only if sent to WhatsApp)
    if (!isInternal) {
      try { await supabaseAdmin.rpc('increment_usage', { p_tenant_id: tenantId, p_messages_sent: 1 }); } catch (e) { console.error(e); }
    }

    res.json({ success: true, result: sendResult || { bspMessageId } });
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post('/send-template', requireTenantMember, enforceQuota, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId;
    const { conversationId, templateId, templateParams, providerName = 'meta' } = req.body;

    if (!tenantId || !conversationId || !templateId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data: conv, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('customer_phone')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .single();

    if (convError || !conv) return res.status(404).json({ error: 'Conversation not found' });

    const { data: template } = await supabaseAdmin
      .from('message_templates')
      .select('*')
      .eq('id', templateId)
      .eq('tenant_id', tenantId)
      .single();

    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.status !== 'approved') return res.status(400).json({ error: 'Template is not approved' });

    const { data: config } = await supabaseAdmin
      .from('tenant_bsp_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single(); 
      
    if (!config) {
      return res.status(400).json({ error: 'No WhatsApp configuration found. Please complete setup in Settings.' });
    }
      
    const activeProvider = config?.bsp_provider || providerName;
    const provider = getBSPProvider(activeProvider);

    const decryptedConfig = { ...config };
    if (decryptedConfig.access_token_encrypted) {
      decryptedConfig.access_token_encrypted = decryptToken(decryptedConfig.access_token_encrypted);
    }

    const sendResult = await provider.sendTemplateMessage({
      tenantId,
      to: conv.customer_phone,
      templateId: template.bsp_template_id || template.name,
      category: template.category as any,
      templateParams: templateParams || [],
      providerConfig: decryptedConfig
    });

    let renderedBody = template.body;
    (templateParams || []).forEach((param: string, index: number) => {
      renderedBody = renderedBody.replace(`{{${index + 1}}}`, param);
    });

    const { error: msgInsertError } = await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      direction: 'outbound',
      message_type: 'template',
      content: renderedBody,
      sender: 'agent',
      wa_message_id: sendResult.bspMessageId
    });

    if (msgInsertError) {
      console.error('Failed to save outbound template message to DB:', msgInsertError);
    }

    try { await supabaseAdmin.rpc('increment_usage', { p_tenant_id: tenantId, p_messages_sent: 1 }); } catch (e) { console.error(e); }

    res.json({ success: true, result: sendResult });
  } catch (error: any) {
    console.error('Error sending template:', error);
    res.status(500).json({ error: 'Failed to send template' });
  }
});

export default router;
