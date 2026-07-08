import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { encryptToken } from '../bsp/crypto';

const router = Router();

interface AuthRequest extends Request {
  user?: any;
}

// Middleware to verify user and get tenant_id from header or token
const requireTenantAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({ error: 'Missing x-tenant-id header' });
  }

  // Check if user is admin of this tenant
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('tenant_users')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single();

  if (membershipError || !membership || membership.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Requires Tenant Admin privileges' });
  }

  req.user = user;
  next();
};

router.use(requireTenantAdmin);

/**
 * GET /api/tenant/bsp
 * Fetches the BSP configuration for the current tenant.
 */
router.get('/bsp', async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_bsp_config')
      .select('bsp_provider, waba_id, phone_number_id, webhook_verify_token, catalog_id, is_active')
      .eq('tenant_id', tenantId)
      .single();
      
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    res.json(data || null);
  } catch (error) {
    console.error('Error fetching BSP config:', error);
    res.status(500).json({ error: 'Failed to fetch BSP configuration' });
  }
});

/**
 * POST /api/tenant/bsp
 * Upserts the BSP configuration for the current tenant.
 */
router.post('/bsp', async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  const { bsp_provider, waba_id, phone_number_id, api_key, catalog_id } = req.body;
  
  if (!bsp_provider || !waba_id || !phone_number_id) {
    return res.status(400).json({ error: 'Missing required BSP fields' });
  }

  try {
    const updateData: any = {
      tenant_id: tenantId,
      bsp_provider,
      waba_id,
      phone_number_id,
      catalog_id,
      // webhook_verify_token is required. We will generate one if it doesn't exist, or keep it.
      // But upsert doesn't easily let us say "keep existing if exists".
      // We'll query first.
    };
    
    // Only update the encrypted token if they provided a new one
    if (api_key) {
      updateData.access_token_encrypted = encryptToken(api_key);
    }
    
    // Check existing
    const { data: existing } = await supabaseAdmin
      .from('tenant_bsp_config')
      .select('webhook_verify_token')
      .eq('tenant_id', tenantId)
      .single();
      
    updateData.webhook_verify_token = existing?.webhook_verify_token || `wh-${tenantId}-${Date.now()}`;
    
    // Default is_active to true for new configs. Explicit false in the request body can deactivate.
    if (req.body.is_active !== undefined) {
      updateData.is_active = req.body.is_active;
    } else if (!existing) {
      updateData.is_active = true;
    }
    
    const { data, error } = await supabaseAdmin
      .from('tenant_bsp_config')
      .upsert(updateData, { onConflict: 'tenant_id' })
      .select('bsp_provider, waba_id, phone_number_id, webhook_verify_token, is_active')
      .single();
      
    if (error) throw error;
    
    // Invalidate the cache to ensure real-time messaging picks up the new config instantly
    const { appCache } = require('../lib/cache');
    appCache.delete(`bsp_config_${tenantId}`);
    
    res.json(data);
  } catch (error: any) {
    console.error('Error saving BSP config:', error);
    res.status(500).json({ error: 'Failed to save BSP configuration', detail: error?.message || String(error), code: error?.code });
  }
});

import crypto from 'crypto';

/**
 * GET /api/tenant/developer
 * Fetches or creates developer settings for the current tenant.
 */
router.get('/developer', async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  try {
    let { data, error } = await supabaseAdmin
      .from('developer_settings')
      .select('api_key, webhook_url')
      .eq('tenant_id', tenantId)
      .single();
      
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    // If none exists, return null so frontend can show "Generate" button
    if (!data) {
      return res.json(null);
    }
    
    // Do not return the hashed key to the frontend
    res.json({
      has_key: true,
      webhook_url: data.webhook_url
    });
  } catch (error) {
    console.error('Error fetching developer settings:', error);
    res.status(500).json({ error: 'Failed to fetch developer settings' });
  }
});

/**
 * POST /api/tenant/developer
 * Updates webhook_url
 */
router.post('/developer', async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  const { webhook_url } = req.body;
  
  try {
    const { data, error } = await supabaseAdmin
      .from('developer_settings')
      .update({ webhook_url })
      .eq('tenant_id', tenantId)
      .select('api_key, webhook_url')
      .single();
      
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error saving developer settings:', error);
    res.status(500).json({ error: 'Failed to save developer settings' });
  }
});

/**
 * POST /api/tenant/developer/rotate-key
 */
router.post('/developer/rotate-key', async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  
  try {
    const rawKey = 'sk_live_' + crypto.randomBytes(24).toString('hex');
    const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

    const rawWebhookSecret = 'whsec_' + crypto.randomBytes(24).toString('hex');
    const encryptedWebhookSecret = encryptToken(rawWebhookSecret);

    const { data, error } = await supabaseAdmin
      .from('developer_settings')
      .upsert({ 
        tenant_id: tenantId, 
        api_key: hashedKey,
        webhook_secret_encrypted: encryptedWebhookSecret
      }, { onConflict: 'tenant_id' })
      .select('webhook_url')
      .single();
      
    if (error) throw error;
    
    // Return the raw key and raw webhook secret ONCE so the frontend can display them
    res.json({
      api_key: rawKey,
      webhook_secret: rawWebhookSecret,
      webhook_url: data.webhook_url
    });
  } catch (error) {
    console.error('Error rotating API key:', error);
    res.status(500).json({ error: 'Failed to rotate API key' });
  }
});

/**
 * GET /api/tenant/integrations/shopify
 */
router.get('/integrations/shopify', async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  try {
    const { data, error } = await supabaseAdmin
      .from('shopify_settings')
      .select('store_url, webhook_secret, is_active')
      .eq('tenant_id', tenantId)
      .single();
      
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    res.json(data || null);
  } catch (error) {
    console.error('Error fetching Shopify settings:', error);
    res.status(500).json({ error: 'Failed to fetch Shopify settings' });
  }
});

router.post('/integrations/shopify', async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  const { store_url, webhook_secret, is_active } = req.body;
  
  try {
    const encryptedSecret = webhook_secret ? encryptToken(webhook_secret) : null;
    
    const updateData: any = {
      tenant_id: tenantId,
      store_url,
      is_active
    };
    
    if (encryptedSecret) {
      updateData.webhook_secret = encryptedSecret;
    }
    
    const { data, error } = await supabaseAdmin
      .from('shopify_settings')
      .upsert(updateData, { onConflict: 'tenant_id' })
      .select('store_url, is_active')
      .single();
      
    if (error) throw error;
    // Do not send back the secret
    res.json({ ...data, has_secret: !!encryptedSecret });
  } catch (error) {
    console.error('Error saving Shopify settings:', error);
    res.status(500).json({ error: 'Failed to save Shopify settings' });
  }
});

export default router;
