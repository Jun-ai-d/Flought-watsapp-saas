import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireTenantMember } from '../middleware/requireTenantMember';

const router = Router();

router.get('/:tenantId', requireTenantMember, async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_bsp_config')
      .select('bsp_provider, waba_id, phone_number_id, webhook_verify_token, is_active')
      .eq('tenant_id', tenantId)
      .single();
      
    if (error && error.code !== 'PGRST116') { // not found
      throw error;
    }
    
    res.json(data || null);
  } catch (error) {
    console.error('Error fetching BSP config:', error);
    res.status(500).json({ error: 'Failed to fetch BSP configuration' });
  }
});

router.post('/:tenantId', requireTenantMember, async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const { bsp_provider, waba_id, phone_number_id, api_key } = req.body;
  
  if (!bsp_provider || !waba_id || !phone_number_id) {
    return res.status(400).json({ error: 'Missing required BSP fields' });
  }

  try {
    // Upsert the config using Supabase Admin because client RLS blocks direct writes to this table
    const updateData: any = {
      tenant_id: tenantId,
      bsp_provider,
      waba_id,
      phone_number_id,
      webhook_verify_token: `wh-${tenantId}-${Date.now()}` // generate a new one or keep existing
    };
    
    // Only update the encrypted token if they provided a new one
    if (api_key) {
      // In a real app we would use pgcrypto here: 
      // e.g. access_token_encrypted: supabaseAdmin.raw(`pgp_sym_encrypt('${api_key}', '${process.env.DB_ENCRYPTION_KEY}')`)
      // But for this demo without pgcrypto enabled, we just store it.
      updateData.access_token_encrypted = api_key;
    }
    
    const { data, error } = await supabaseAdmin
      .from('tenant_bsp_config')
      .upsert(updateData, { onConflict: 'tenant_id' })
      .select('bsp_provider, waba_id, phone_number_id, webhook_verify_token, is_active')
      .single();
      
    if (error) throw error;
    
    res.json(data);
  } catch (error) {
    console.error('Error saving BSP config:', error);
    res.status(500).json({ error: 'Failed to save BSP configuration' });
  }
});

export default router;
