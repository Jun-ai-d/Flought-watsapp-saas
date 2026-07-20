import { Router } from 'express';
import crypto from 'crypto';
import { supabaseAdmin } from '../lib/supabase';
import { boss } from '../services/jobQueue';

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

router.post('/webhook', async (req: any, res: any) => {
  const shopDomain = req.get('X-Shopify-Shop-Domain');
  const topic = req.get('X-Shopify-Topic');

  if (!shopDomain || !topic) {
    return res.status(400).send('Missing Shopify Headers');
  }

  try {
    // Lookup integration
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

    const { decryptToken } = await import('../bsp/crypto');
    const secret = decryptToken(integration.webhook_secret_encrypted);

    if (!verifyShopifyWebhook(req, secret)) {
      console.warn(`[Shopify] Invalid HMAC signature for ${shopDomain}`);
      return res.status(401).send('Unauthorized');
    }

    // SRE Rule: Acknowledge early so Shopify doesn't timeout!
    res.status(200).send('OK');

    const tenantId = integration.tenant_id;
    const payload = req.body;

    // Process asynchronously based on topic (detached from request lifecycle)
    (async () => {
      if (topic === 'carts/update') {
        // Basic Abandoned Cart Logic
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

// GET Integration Details
router.get('/:tenantId/integration', async (req: any, res: any) => {
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

    const { decryptToken } = await import('../bsp/crypto');
    const secret = decryptToken(integration.webhook_secret_encrypted);

    res.json({
      store_domain: integration.store_domain,
      webhook_secret: secret,
      is_active: integration.is_active
    });
  } catch (error) {
    console.error('[Shopify API] Error fetching integration:', error);
    res.status(500).json({ error: 'Failed to fetch integration' });
  }
});

// GET Dead Letter Queue (mock/simplified from job queue or a dlq table if one exists)
router.get('/:tenantId/dlq', async (req: any, res: any) => {
  // In a real app we would query pgBoss 'archive' or a dedicated DLQ table.
  // We'll return an empty array for now since there isn't a dedicated dlq table in the schema.
  res.json([]);
});

// GET Cart Recovery Stats
router.get('/:tenantId/carts/stats', async (req: any, res: any) => {
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
