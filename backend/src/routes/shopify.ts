import { Router } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabase';
import { boss } from '../services/jobQueue';
import { requireTenantMember, requireTenantAdminRole } from '../middleware/requireTenantMember';

const router = Router();

/**
 * Validates Shopify HMAC signature
 */
function verifyShopifyWebhook(req: any, secret: string): boolean {
  const hmacHeader = req.get('X-Shopify-Hmac-SHA256');
  if (!hmacHeader || !req.rawBody) return false;
  
  const generatedHash = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody, 'utf8')
    .digest('base64');
    
  return crypto.timingSafeEqual(Buffer.from(generatedHash), Buffer.from(hmacHeader));
}

function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

router.post('/webhook', async (req: any, res: any) => {
  const shopDomain = req.get('X-Shopify-Shop-Domain');
  const topic = req.get('X-Shopify-Topic');

  if (!shopDomain || !topic) {
    return res.status(400).send('Missing Shopify Headers');
  }

  try {
    const { data: integration } = await supabaseAdmin
      .from('ecommerce_integrations')
      .select('tenant_id, webhook_secret_encrypted')
      .eq('store_domain', shopDomain)
      .eq('platform', 'shopify')
      .eq('is_active', true)
      .single();

    if (!integration || !integration.webhook_secret_encrypted) {
      return res.status(401).send('Integration not found or inactive');
    }

    const { decryptToken, encryptToken } = await import('../bsp/crypto');
    const secret = decryptToken(integration.webhook_secret_encrypted);

    if (!verifyShopifyWebhook(req, secret)) {
      console.warn(`[Shopify] Invalid HMAC signature for ${shopDomain}`);
      return res.status(401).send('Unauthorized');
    }

    res.status(200).send('OK');

    const tenantId = integration.tenant_id;
    const payload = req.body;

    (async () => {
      if (topic === 'carts/update') {
        if (payload.token) {
          await supabaseAdmin.from('abandoned_carts').upsert({
            tenant_id: tenantId,
            platform_cart_id: payload.token,
            cart_url: payload.abandoned_checkout_url || `https://${shopDomain}/cart/${payload.token}`,
            total_price: payload.total_price || 0,
            currency: payload.currency || 'USD',
            status: 'pending'
          }, { onConflict: 'tenant_id, platform_cart_id' });

          await boss.send('process-abandoned-cart', {
            tenantId,
            cartId: payload.token,
            customerPhone: payload.customer?.phone || payload.phone,
            cartUrl: payload.abandoned_checkout_url
          }, { startAfter: 30 * 60 });
        }
      } else if (topic === 'orders/create') {
        if (payload.cart_token) {
          await supabaseAdmin.from('abandoned_carts')
            .update({ status: 'recovered' })
            .eq('platform_cart_id', payload.cart_token)
            .eq('tenant_id', tenantId);
        }

        const isCod = payload.payment_gateway_names?.includes('Cash on Delivery (COD)');
        
        if (isCod) {
          await supabaseAdmin.from('order_confirmations').insert({
            tenant_id: tenantId,
            platform_order_id: payload.id.toString(),
            customer_phone: payload.customer?.phone || payload.phone || payload.shipping_address?.phone,
            total_price: payload.total_price,
            currency: payload.currency,
            is_cod: true,
            status: 'pending'
          });

          await boss.send('process-cod-confirmation', {
            tenantId,
            orderId: payload.id.toString(),
            customerPhone: payload.customer?.phone || payload.phone || payload.shipping_address?.phone,
            orderDetails: {
              orderNumber: payload.order_number,
              totalPrice: payload.total_price
            }
          });
        }
      }
    })().catch(error => {
      console.error(`[Shopify Webhook] Detached processing error for ${topic}:`, error);
    });

  } catch (error) {
    console.error(`[Shopify Webhook] Error before response for ${topic}:`, error);
  }
});

router.get('/:tenantId/integration', requireTenantMember, async (req: any, res: any) => {
  const { tenantId } = req.params;
  try {
    const { data: integration, error } = await supabaseAdmin
      .from('ecommerce_integrations')
      .select('store_domain, webhook_secret_encrypted, is_active')
      .eq('tenant_id', tenantId)
      .eq('platform', 'shopify')
      .single();

    if (error || !integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    res.json({
      store_domain: integration.store_domain,
      is_active: integration.is_active,
      has_secret: !!integration.webhook_secret_encrypted,
    });
  } catch (error) {
    console.error('[Shopify API] Error fetching integration:', error);
    res.status(500).json({ error: 'Failed to fetch integration' });
  }
});

router.post('/:tenantId/integration', requireTenantMember, requireTenantAdminRole, async (req: any, res: any) => {
  const { tenantId } = req.params;
  const { store_domain, is_active = true } = req.body;

  if (!store_domain) {
    return res.status(400).json({ error: 'store_domain is required' });
  }

  try {
    const { encryptToken } = await import('../bsp/crypto');
    const plaintextSecret = generateWebhookSecret();

    const { data, error } = await supabaseAdmin
      .from('ecommerce_integrations')
      .upsert({
        tenant_id: tenantId,
        platform: 'shopify',
        store_domain,
        webhook_secret_encrypted: encryptToken(plaintextSecret),
        is_active,
      }, { onConflict: 'tenant_id, platform' })
      .select('store_domain, is_active')
      .single();

    if (error) throw error;

    res.json({
      ...data,
      webhook_secret: plaintextSecret,
      has_secret: true,
    });
  } catch (error) {
    console.error('[Shopify API] Error creating integration:', error);
    res.status(500).json({ error: 'Failed to create integration' });
  }
});

router.post('/:tenantId/integration/rotate-secret', requireTenantMember, requireTenantAdminRole, async (req: any, res: any) => {
  const { tenantId } = req.params;

  try {
    const { encryptToken } = await import('../bsp/crypto');
    const plaintextSecret = generateWebhookSecret();

    const { data, error } = await supabaseAdmin
      .from('ecommerce_integrations')
      .update({ webhook_secret_encrypted: encryptToken(plaintextSecret) })
      .eq('tenant_id', tenantId)
      .eq('platform', 'shopify')
      .select('store_domain, is_active')
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    res.json({
      ...data,
      webhook_secret: plaintextSecret,
      has_secret: true,
    });
  } catch (error) {
    console.error('[Shopify API] Error rotating secret:', error);
    res.status(500).json({ error: 'Failed to rotate webhook secret' });
  }
});

router.get('/:tenantId/dlq', requireTenantMember, async (_req: any, res: any) => {
  res.json([]);
});

router.get('/:tenantId/carts/stats', requireTenantMember, async (req: any, res: any) => {
  const { tenantId } = req.params;
  try {
    const { data: carts, error } = await supabaseAdmin
      .from('abandoned_carts')
      .select('status, total_price, currency')
      .eq('tenant_id', tenantId);

    if (error) throw error;

    let pending = 0;
    let recovered = 0;
    let revenue_recovered = 0;
    let currency = 'USD';

    for (const cart of carts || []) {
      if (cart.status === 'pending') pending++;
      else if (cart.status === 'recovered') {
        recovered++;
        revenue_recovered += parseFloat(cart.total_price || '0');
        currency = cart.currency || currency;
      }
    }

    res.json({ pending, recovered, revenue_recovered, currency });
  } catch (error) {
    console.error('[Shopify API] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
