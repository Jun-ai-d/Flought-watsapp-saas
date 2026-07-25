import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { encryptToken } from '../bsp/crypto';
import { requireTenantMember, requireTenantAdminRole, TenantRequest } from '../middleware/requireTenantMember';

const router = Router();

const VALID_PROVIDERS = ['hubspot', 'salesforce', 'zoho'] as const;
type CrmProvider = typeof VALID_PROVIDERS[number];

function parseProvider(raw: string): CrmProvider | null {
  return VALID_PROVIDERS.includes(raw as CrmProvider) ? (raw as CrmProvider) : null;
}

function tenantIdFromRequest(req: TenantRequest): string | undefined {
  return req.tenantId || (req.headers['x-tenant-id'] as string | undefined);
}

router.get('/:provider', requireTenantMember, async (req: TenantRequest, res) => {
  const provider = parseProvider(String(req.params.provider));
  const tenantId = tenantIdFromRequest(req);

  if (!provider) {
    return res.status(400).json({ error: 'Invalid CRM provider' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('crm_credentials')
      .select('is_active, portal_id, created_at, updated_at')
      .eq('tenant_id', tenantId!)
      .eq('crm_provider', provider)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.json({ is_active: false, has_credentials: false });
    }

    res.json({
      is_active: data.is_active ?? true,
      has_credentials: true,
      portal_id: data.portal_id,
    });
  } catch (error: unknown) {
    console.error('[CRM Route] Failed to fetch credentials', error);
    res.status(500).json({ error: 'Failed to fetch CRM configuration' });
  }
});

router.post('/:provider', requireTenantMember, requireTenantAdminRole, async (req: TenantRequest, res) => {
  const provider = parseProvider(String(req.params.provider));
  const tenantId = tenantIdFromRequest(req);
  const { api_key, accessToken, is_active = true, portalId } = req.body;
  const token = api_key || accessToken;

  if (!provider) {
    return res.status(400).json({ error: 'Invalid CRM provider' });
  }

  try {
    const { data: existing } = await supabaseAdmin
      .from('crm_credentials')
      .select('id')
      .eq('tenant_id', tenantId!)
      .eq('crm_provider', provider)
      .maybeSingle();

    if (!token && !existing) {
      return res.status(400).json({ error: 'Access token is required for initial setup' });
    }

    const updatePayload: Record<string, unknown> = {
      tenant_id: tenantId,
      crm_provider: provider,
      is_active,
    };

    if (token) {
      updatePayload.access_token_encrypted = encryptToken(token);
    }
    if (portalId !== undefined) {
      updatePayload.portal_id = portalId;
    }

    const { error } = await supabaseAdmin
      .from('crm_credentials')
      .upsert(updatePayload, { onConflict: 'tenant_id, crm_provider' });

    if (error) throw error;
    res.status(200).json({ success: true, is_active, has_credentials: true });
  } catch (error: unknown) {
    console.error('[CRM Route] Failed to save credentials', error);
    const message = error instanceof Error ? error.message : 'Failed to save CRM configuration';
    res.status(500).json({ error: message });
  }
});

router.post('/credentials', requireTenantMember, requireTenantAdminRole, async (req: TenantRequest, res) => {
  const { tenantId, provider, accessToken, refreshToken, portalId } = req.body;

  if (!tenantId || !provider || !accessToken) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!parseProvider(provider)) {
    return res.status(400).json({ error: 'Invalid CRM provider' });
  }

  if (req.tenantId && req.tenantId !== tenantId) {
    return res.status(403).json({ error: 'Forbidden: tenantId mismatch' });
  }

  try {
    const encryptedAccess = encryptToken(accessToken);
    const encryptedRefresh = refreshToken ? encryptToken(refreshToken) : null;

    const { error } = await supabaseAdmin
      .from('crm_credentials')
      .upsert({
        tenant_id: tenantId,
        crm_provider: provider,
        access_token_encrypted: encryptedAccess,
        refresh_token_encrypted: encryptedRefresh,
        portal_id: portalId,
      }, { onConflict: 'tenant_id, crm_provider' });

    if (error) throw error;
    res.status(200).json({ success: true });
  } catch (error: unknown) {
    console.error('[CRM Route] Failed to save credentials', error);
    const message = error instanceof Error ? error.message : 'Failed to save credentials';
    res.status(500).json({ error: message });
  }
});

export default router;
