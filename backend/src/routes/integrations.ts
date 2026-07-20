import { Router } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabase';
import { getBSPProvider } from '../bsp/providerFactory';
import { decryptToken } from '../bsp/crypto';

const router = Router();

/**
 * POST /api/integrations/shopify/webhook/:pathToken
 *
 * C-3 Fix: tenant_id is NO LONGER taken from the query string.
 * The Shopify webhook URL now embeds a per-tenant secret path token
 * (shopify_settings.webhook_path_token) so the tenant identity is derived
 * from the secret token, not from user-supplied input.
 *
 * Register the webhook in Shopify as:
 *   https://api.flought.com/api/integrations/shopify/webhook/{webhook_path_token}
 */
router.post('/shopify/webhook/:pathToken', async (req: any, res: any) => {
  const { pathToken } = req.params;
  const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;
  const topic = req.headers['x-shopify-topic'] as string;

  if (!pathToken || !hmacHeader || !topic) {
    return res.status(400).send('Missing required parameters or headers');
  }

  try {
    // 1. Resolve tenant from secret path token — never from query params
    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from('shopify_settings')
      .select('tenant_id, webhook_secret, is_active')
      .eq('webhook_path_token', pathToken)
      .single();

    if (settingsErr || !settings || !settings.is_active || !settings.webhook_secret) {
      // Generic 401 — don't reveal whether the token exists
      return res.status(401).send('Unauthorized');
    }

    const { tenant_id: tenantId, webhook_secret } = settings;
    const decryptedSecret = decryptToken(webhook_secret);

    // 2. Validate HMAC against raw body
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      console.error('No raw body available for Shopify webhook validation');
      return res.status(500).send('Server configuration error');
    }

    const genHash = crypto
      .createHmac('sha256', decryptedSecret)
      .update(rawBody)
      .digest('base64');

    // Constant-time comparison to prevent timing attacks
    const sigBuffer = Buffer.from(hmacHeader);
    const expectedBuffer = Buffer.from(genHash);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      console.warn(`[Shopify] HMAC mismatch for tenant ${tenantId}`);
      return res.status(401).send('Unauthorized');
    }

    // 3. Acknowledge immediately so Shopify doesn't retry
    res.status(200).send('OK');

    // 4. Process asynchronously
    processShopifyEvent(tenantId, topic, req.body).catch(err =>
      console.error('[Shopify] processShopifyEvent error:', err)
    );

  } catch (error) {
    console.error('Error processing Shopify webhook:', { error });
    // Response already sent (200) or not sent yet — if not sent, send 500
    if (!res.headersSent) res.status(500).send('Internal Server Error');
  }
});

async function processShopifyEvent(tenantId: string, topic: string, payload: any) {
  // Extract phone number from Shopify payload
  let phone = '';
  let customerName = 'Customer';

  if (payload.customer?.phone) {
    phone = payload.customer.phone;
    customerName = payload.customer.first_name || 'Customer';
  } else if (payload.shipping_address?.phone) {
    phone = payload.shipping_address.phone;
    customerName = payload.shipping_address.first_name || 'Customer';
  } else if (payload.billing_address?.phone) {
    phone = payload.billing_address.phone;
    customerName = payload.billing_address.first_name || 'Customer';
  }

  if (!phone) {
    console.log(`[Shopify] Ignored ${topic}: no phone number found`);
    return;
  }

  const cleanPhone = String(phone).replace(/\D/g, '');

  let templateName: string | null = null;
  let templateParams: string[] = [];

  if (topic === 'orders/create') {
    templateName = 'order_confirmation';
    templateParams = [customerName, payload.order_number?.toString() || ''];
  } else if (topic === 'checkouts/update' && payload.abandoned_checkout_url) {
    templateName = 'abandoned_cart';
    templateParams = [customerName, payload.abandoned_checkout_url];
  } else {
    console.log(`[Shopify] Unhandled topic: ${topic}`);
    return;
  }

  try {
    // Fetch BSP config
    const { data: config } = await supabaseAdmin
      .from('tenant_bsp_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (!config) {
      console.error(`[Shopify] Tenant ${tenantId} has no WhatsApp config`);
      return;
    }

    const decryptedConfig = { ...config };
    if (decryptedConfig.access_token_encrypted) {
      decryptedConfig.access_token_encrypted = decryptToken(decryptedConfig.access_token_encrypted);
    }

    // Fetch approved template
    const { data: template } = await supabaseAdmin
      .from('message_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('name', templateName)
      .eq('status', 'approved')
      .single();

    if (!template) {
      console.warn(`[Shopify] Tenant ${tenantId} has no approved template '${templateName}'`);
      return;
    }

    // Find or create conversation
    const { data: existingConv } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('customer_phone', cleanPhone)
      .maybeSingle();

    let conversationId: string | null = existingConv?.id ?? null;

    if (!conversationId) {
      const { data: newConv } = await supabaseAdmin
        .from('conversations')
        .insert({
          tenant_id: tenantId,
          customer_phone: cleanPhone,
          customer_name: customerName,
          status: 'bot'
        })
        .select('id')
        .single();
      conversationId = newConv?.id ?? null;
    }

    // Send template
    const provider = getBSPProvider(config.bsp_provider);
    const sendResult = await provider.sendTemplateMessage({
      tenantId,
      to: cleanPhone,
      templateId: template.bsp_template_id || template.name,
      category: template.category as any,
      templateParams,
      providerConfig: decryptedConfig
    });

    // Log message
    await supabaseAdmin.from('messages').insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      direction: 'outbound',
      message_type: 'template',
      content: `[Shopify: ${templateName}]`,
      sender: 'agent',
      wa_message_id: sendResult.bspMessageId
    });

    console.log(`[Shopify] Sent ${templateName} to ${cleanPhone}`);

  } catch (err: any) {
    console.error('[Shopify] Failed to send template:', { error: err.message, tenantId });
  }
}

export default router;
