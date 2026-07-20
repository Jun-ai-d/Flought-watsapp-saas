import { Router } from 'express';
import QRCode from 'qrcode';
import rateLimit from 'express-rate-limit';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

// Strict rate limiter for public widget endpoint
const widgetRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// 1. WhatsApp QR Code Generator (F3)
router.get('/qr', async (req: any, res: any) => {
  const { phone, text, size = 300 } = req.query;

  if (!phone) {
    return res.status(400).json({ error: 'Missing phone number parameter' });
  }

  // Construct wa.me URL
  const waUrl = new URL(`https://wa.me/${phone}`);
  if (text) {
    waUrl.searchParams.append('text', text as string);
  }

  try {
    // Generate QR Code as PNG Buffer
    const qrBuffer = await QRCode.toBuffer(waUrl.toString(), {
      width: parseInt(size as string),
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    res.type('png');
    res.send(qrBuffer);
  } catch (error) {
    console.error('[Growth API] Failed to generate QR Code:', error);
    res.status(500).json({ error: 'Failed to generate QR Code' });
  }
});

// 2. Chat Widget Configuration (F1)
// Note: This endpoint is public so it can be fetched by the JS snippet embedded on tenant websites.
// We apply strict rate limiting to prevent database DoS attacks.
router.get('/widget/:tenantId', widgetRateLimiter, async (req: any, res: any) => {
  const { tenantId } = req.params;

  try {
    const { data: config, error } = await supabaseAdmin
      .from('widget_configurations')
      .select('theme_color, greeting_message, business_hours, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error || !config) {
      return res.status(404).json({ error: 'Widget configuration not found' });
    }

    // Fetch the BSP phone number to route the widget clicks to
    const { data: bsp } = await supabaseAdmin
      .from('tenant_bsp_config')
      .select('phone_number_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();
      
    // Ideally we would return the actual phone number, but for MVP we return the ID.
    // The frontend snippet uses this to build the wa.me link.
    res.json({
      ...config,
      phone_number_id: bsp?.phone_number_id || null
    });

  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
