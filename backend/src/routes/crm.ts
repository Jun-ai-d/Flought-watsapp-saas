import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { encryptToken, decryptToken } from '../bsp/crypto';

const router = Router();

// Middleware to require tenant admin
const requireTenantAdmin = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No auth header' });

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });

  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) return res.status(400).json({ error: 'Missing x-tenant-id' });

  const { data: membership } = await supabaseAdmin
    .from('tenant_users')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single();

  if (!membership || membership.role !== 'admin') {
    return res.status(403).json({ error: 'Requires Admin' });
  }

  req.user = user;
  req.tenantId = tenantId;
  next();
};

router.use(requireTenantAdmin);

router.get('/:provider', async (req: any, res: any) => {
  const { provider } = req.params;
  try {
    const { data } = await supabaseAdmin
      .from('crm_settings')
      .select('provider, is_active, sync_contacts, sync_chats')
      .eq('tenant_id', req.tenantId)
      .eq('provider', provider)
      .single();
    
    res.json(data || null);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch CRM config' });
  }
});

router.post('/:provider', async (req: any, res: any) => {
  const { provider } = req.params;
  const { api_key, sync_contacts, sync_chats, is_active } = req.body;
  
  const updateData: any = {
    tenant_id: req.tenantId,
    provider,
    sync_contacts: sync_contacts ?? true,
    sync_chats: sync_chats ?? true,
    is_active: is_active ?? true
  };

  if (api_key) {
    updateData.api_key_encrypted = encryptToken(api_key);
  }

  try {
    const { error } = await supabaseAdmin
      .from('crm_settings')
      .upsert(updateData, { onConflict: 'tenant_id, provider' });

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to save CRM settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

export default router;
