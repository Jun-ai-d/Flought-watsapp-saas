import { Router } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabase';
import { getBSPProvider } from '../bsp/providerFactory';
import { decryptToken } from '../bsp/crypto';

const router = Router();

/**
 * POST /api/integrations/shopify/webhook
 * Receives webhooks from Shopify (orders/create, checkouts/update, etc.)
 */
router.post('/shopify/webhook', async (req: any, res: any) => {
  const tenantId = req.query.tenant_id as string;
  const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;
  const topic = req.headers['x-shopify-topic'] as string;

  if (!tenantId || !hmacHeader || !topic) {
    return res.status(400).send('Missing required parameters or headers');
  }

  try {
    // 1. Fetch Shopify Settings for this tenant to get the Webhook Secret
    const { data: settings } = await supabaseAdmin
      .from('shopify_settings')
      .select('webhook_secret, is_active')
      .eq('tenant_id', tenantId)
      .single();

    if (!settings || !settings.is_active || !settings.webhook_secret) {
      return res.status(401).send('Integration not active or secret missing');
    }

    const decryptedSecret = decryptToken(settings.webhook_secret);

    // 2. Validate HMAC
    const rawBody = req.rawBody; // Captured by express.json verify function
    if (!rawBody) {
      console.error('No raw body available for Shopify webhook validation');
      return res.status(500).send('Server configuration error');
    }

    const genHash = crypto
      .createHmac('sha256', decryptedSecret)
      .update(rawBody)
      .digest('base64');

    const sigBuffer = Buffer.from(hmacHeader);
    const expectedBuffer = Buffer.from(genHash);

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      console.warn(`Shopify HMAC mismatch for tenant ${tenantId}`);
      return res.status(401).send('Unauthorized');
    }

    // 3. Immediately acknowledge Shopify so it doesn't retry
    res.status(200).send('Verified');

    // 4. Process Webhook asynchronously
    const payload = req.body;
    await processShopifyEvent(tenantId, topic, payload);

  } catch (error) {
    console.error('Error processing Shopify webhook:', { error, tenantId });
  }
});

async function processShopifyEvent(tenantId: string, topic: string, payload: any) {
  // Extract phone number from Shopify payload (varies by event)
  let phone = '';
  let customerName = 'Customer';
  
  if (payload.customer && payload.customer.phone) {
    phone = payload.customer.phone;
    customerName = payload.customer.first_name || 'Customer';
  } else if (payload.shipping_address && payload.shipping_address.phone) {
    phone = payload.shipping_address.phone;
    customerName = payload.shipping_address.first_name || 'Customer';
  } else if (payload.billing_address && payload.billing_address.phone) {
    phone = payload.billing_address.phone;
    customerName = payload.billing_address.first_name || 'Customer';
  }

  if (!phone) {
    console.log(`[Shopify] Ignored ${topic} because no phone number was found.`);
    return;
  }

  // Clean phone number (strip non-digits, ensuring it's in WhatsApp format if possible)
  const cleanPhone = String(phone).replace(/\D/g, '');

  let templateIdToSend = null;
  let templateParams: string[] = [];

  // Very basic routing logic for MVP
  if (topic === 'orders/create') {
    templateIdToSend = 'order_confirmation';
    templateParams = [customerName, payload.order_number?.toString() || ''];
  } else if (topic === 'checkouts/update') {
    // Note: checkouts/update triggers often, you'd usually filter by 'abandoned' status or use checkouts/delete
    templateIdToSend = 'abandoned_cart';
    templateParams = [customerName, payload.abandoned_checkout_url || ''];
  } else {
    console.log(`[Shopify] Unhandled topic: ${topic}`);
    return;
  }

  // Send the template
  try {
    // 1. Get BSP Config
    const { data: config } = await supabaseAdmin
      .from('tenant_bsp_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (!config) {
      console.error(`[Shopify] Tenant ${tenantId} has no active WhatsApp connection.`);
      return;
    }

    const decryptedConfig = { ...config };
    if (decryptedConfig.access_token_encrypted) {
      decryptedConfig.access_token_encrypted = decryptToken(decryptedConfig.access_token_encrypted);
    }

    // 2. Fetch the actual template from DB to get BSP ID
    const { data: template } = await supabaseAdmin
      .from('message_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('name', templateIdToSend)
      .eq('status', 'approved')
      .single();

    if (!template) {
      console.warn(`[Shopify] Tenant ${tenantId} does not have an approved template named '${templateIdToSend}'`);
      return;
    }

    // 3. Find an existing conversation if one exists, otherwise leave it null
    const { data: existingConv } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('customer_phone', cleanPhone)
      .single();
      
    const conversationId = existingConv ? existingConv.id : null;

    // 4. Send Message via Provider
    const provider = getBSPProvider(config.bsp_provider);
    const sendResult = await provider.sendTemplateMessage({
      tenantId,
      to: cleanPhone,
      templateId: template.bsp_template_id || template.name,
      category: template.category as any,
      templateParams: templateParams,
      providerConfig: decryptedConfig
    });

    // 5. Log outbound message
    await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      direction: 'outbound',
      message_type: 'template',
      content: `[Shopify Automated Template: ${templateIdToSend}]`,
      sender: 'agent',
      wa_message_id: sendResult.bspMessageId
    });

    console.log(`[Shopify] Successfully triggered ${templateIdToSend} to ${cleanPhone}`);
    
  } catch (err: any) {
    console.error(`[Shopify] Failed to send template message:`, { error: err.message, tenantId });
  }
}

export default router;
