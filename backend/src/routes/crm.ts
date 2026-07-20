import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { encryptToken } from '../bsp/crypto';

const router = Router();

// Endpoint to save OAuth credentials
router.post('/credentials', async (req: any, res: any) => {
  const { tenantId, provider, accessToken, refreshToken, portalId } = req.body;

  if (!tenantId || !provider || !accessToken) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const encryptedAccess = encryptToken(accessToken);
    const encryptedRefresh = refreshToken ? encryptToken(refreshToken) : null;

    const { data, error } = await supabaseAdmin
      .from('crm_credentials')
      .upsert({
        tenant_id: tenantId,
        crm_provider: provider,
        access_token_encrypted: encryptedAccess,
        refresh_token_encrypted: encryptedRefresh,
        portal_id: portalId
      }, { onConflict: 'tenant_id, crm_provider' });

    if (error) throw error;
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[CRM Route] Failed to save credentials', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
