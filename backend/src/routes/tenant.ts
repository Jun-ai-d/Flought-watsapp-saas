import { Router, Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { encryptToken } from '../bsp/crypto';
import { enqueueKbIngest } from '../services/kb/ingestWorker';

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
 * POST /api/tenant/conversations/:id/resolve
 * Manually resolve a conversation and generate its summary
 */
router.post('/conversations/:id/resolve', async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  const conversationId = req.params.id;
  
  if (!tenantId || !conversationId) {
    return res.status(400).json({ error: 'Missing tenantId or conversationId' });
  }

  try {
    // 1. Update DB to resolved
    const { data: conv, error: updateError } = await supabaseAdmin
      .from('conversations')
      .update({ 
        status: 'resolved',
        resolved_at: new Date().toISOString()
      })
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError) throw updateError;

    // 2. Extract Topic (Existing background logic)
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:4000';
    fetch(`${apiUrl}/api/topics/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization || ''
      },
      body: JSON.stringify({ conversationId })
    }).catch(console.error);

    // 3. Generate Summary & Append to Contact History
    const { generateConversationSummary } = require('../services/llm/generator');
    const { data: history } = await supabaseAdmin
      .from('messages')
      .select('direction, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (history && history.length > 0) {
      const formattedHistory = history.reverse().map((h: any) => ({
        direction: h.direction as 'inbound' | 'outbound',
        content: h.content
      }));
      
      const summary = await generateConversationSummary(formattedHistory);
      
      if (summary && conv.customer_phone) {
        const historyEntry = {
          timestamp: new Date().toISOString(),
          summary: summary
        };
        
        // Use RPC or raw SQL to append to JSONB array. 
        // We can do it by fetching the current array, appending, and updating.
        const { data: contact } = await supabaseAdmin
          .from('contacts')
          .select('interaction_history')
          .eq('tenant_id', tenantId)
          .eq('phone_number', conv.customer_phone)
          .single();
          
        if (contact) {
          const newHistory = [...(contact.interaction_history || []), historyEntry];
          // Limit to last 10 entries to save tokens
          const trimmedHistory = newHistory.slice(-10);
          
          await supabaseAdmin
            .from('contacts')
            .update({ interaction_history: trimmedHistory })
            .eq('tenant_id', tenantId)
            .eq('phone_number', conv.customer_phone);
        }
      }
    }

    res.json(conv);
  } catch (error: any) {
    console.error('Error resolving conversation:', error);
    res.status(500).json({ error: 'Failed to resolve conversation' });
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
      .select('store_url, webhook_secret, webhook_path_token, is_active')
      .eq('tenant_id', tenantId)
      .single();
      
    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return res.json(null);
    }
    
    res.json({
      store_url: data.store_url,
      is_active: data.is_active,
      has_secret: !!data.webhook_secret,
      webhook_path_token: data.webhook_path_token,
    });
  } catch (error) {
    console.error('Error fetching Shopify settings:', error);
    res.status(500).json({ error: 'Failed to fetch Shopify settings' });
  }
});

router.post('/integrations/shopify', async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  const { store_url, webhook_secret, is_active } = req.body;
  
  try {
    const { data: existing } = await supabaseAdmin
      .from('shopify_settings')
      .select('webhook_secret')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const encryptedSecret = webhook_secret ? encryptToken(webhook_secret) : null;
    
    const updateData: Record<string, unknown> = {
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
    res.json({
      ...data,
      has_secret: !!encryptedSecret || !!existing?.webhook_secret,
      ...(encryptedSecret && webhook_secret ? { webhook_secret } : {}),
    });
  } catch (error) {
    console.error('Error saving Shopify settings:', error);
    res.status(500).json({ error: 'Failed to save Shopify settings' });
  }
});

/**
 * POST /api/tenant/integrations/meta/oauth
 * Exchanges short-lived Facebook token for a long-lived one and fetches WABA details.
 */
router.post('/integrations/meta/oauth', async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  const { access_token } = req.body; // Actually passing 'code' here now, but variable is named access_token from frontend

  if (!access_token) {
    return res.status(400).json({ error: 'Missing code' });
  }

  const metaAppId = process.env.META_APP_ID;
  const metaAppSecret = process.env.META_APP_SECRET;

  if (!metaAppId || !metaAppSecret) {
    return res.status(500).json({ error: 'Server missing Meta App credentials' });
  }

  try {
    // 1. Exchange authorization code for access token using POST to avoid secret exposure in URL
    const exchangeUrl = `https://graph.facebook.com/v21.0/oauth/access_token`;
    const exchangeRes = await fetch(exchangeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: metaAppId,
        client_secret: metaAppSecret,
        code: access_token,
        redirect_uri: ''
      })
    });
    const exchangeData = await exchangeRes.json();
    
    if (exchangeData.error) {
      console.error('Meta Token Exchange Error:', exchangeData.error);
      return res.status(400).json({ error: exchangeData.error.message });
    }

    const longLivedToken = exchangeData.access_token;

    // 2. Fetch User's Businesses
    let wabaId = null;
    let phoneId = null;
    
    try {
      const bizRes = await fetch(`https://graph.facebook.com/v21.0/me/businesses?access_token=${longLivedToken}`);
      const bizData = await bizRes.json();
      
      const bizId = bizData.data?.[0]?.id;
      
      if (bizId) {
        // Fetch WABAs owned by this business
        const wabaRes = await fetch(`https://graph.facebook.com/v21.0/${bizId}/owned_whatsapp_business_accounts?access_token=${longLivedToken}`);
        const wabaData = await wabaRes.json();
        wabaId = wabaData.data?.[0]?.id;
        
        if (wabaId) {
          // Fetch Phone Numbers for this WABA
          const phoneRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?access_token=${longLivedToken}`);
          const phoneData = await phoneRes.json();
          phoneId = phoneData.data?.[0]?.id;
        }
      }
    } catch (e) {
      console.warn('Could not auto-fetch WABA details, falling back to empty fields', e);
    }

    // 3. Save to database
    const encryptedApiKey = encryptToken(longLivedToken);

    const { data: existing } = await supabaseAdmin
      .from('tenant_bsp_config')
      .select('webhook_verify_token, waba_id, phone_number_id')
      .eq('tenant_id', tenantId)
      .single();

    const webhookVerifyToken = existing?.webhook_verify_token || `wh-${tenantId}-${Date.now()}`;
    
    const updateData: any = {
      tenant_id: tenantId,
      bsp_provider: 'meta',
      access_token_encrypted: encryptedApiKey,
      webhook_verify_token: webhookVerifyToken,
      is_active: true
    };
    
    // Only overwrite WABA/Phone ID if we successfully fetched them, otherwise keep existing
    if (wabaId) updateData.waba_id = wabaId;
    if (phoneId) updateData.phone_number_id = phoneId;

    const { error: upsertError } = await supabaseAdmin
      .from('tenant_bsp_config')
      .upsert(updateData, { onConflict: 'tenant_id' });

    if (upsertError) throw upsertError;

    // Invalidate cache
    const { appCache } = require('../lib/cache');
    appCache.delete(`bsp_config_${tenantId}`);

    res.json({ success: true, waba_id: wabaId, phone_number_id: phoneId });

  } catch (error: any) {
    console.error('Error during Meta OAuth:', error);
    res.status(500).json({ error: 'Failed to complete Meta integration' });
  }
});

/** POST /api/tenant/kb/documents/:id/ingest — enqueue vectorization */
router.post('/kb/documents/:id/ingest', async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  const documentId = String(req.params.id);

  const { data: doc } = await supabaseAdmin
    .from('knowledge_documents')
    .select('id, status')
    .eq('id', documentId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!doc) return res.status(404).json({ error: 'Document not found' });

  if (doc.status === 'failed' || doc.status === 'ready') {
    await supabaseAdmin
      .from('knowledge_documents')
      .update({ status: 'processing', error_message: null })
      .eq('id', documentId)
      .eq('tenant_id', tenantId);
  }

  await enqueueKbIngest(tenantId, documentId);
  return res.json({ ok: true, documentId });
});

export default router;
