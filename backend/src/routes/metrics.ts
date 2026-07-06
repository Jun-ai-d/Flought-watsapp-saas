import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireTenantMember } from '../middleware/requireTenantMember';

const router = Router();

router.get('/:tenantId', requireTenantMember, async (req, res) => {
  const tenantId = (req as any).tenantId;

  try {
    const { data, error } = await supabaseAdmin.rpc('get_dashboard_metrics', { 
      p_tenant_id: tenantId 
    });

    if (error) {
      throw error;
    }

    res.json(data);
  } catch (error) {
    console.error('Metrics Error:', { error, trace_id: req.traceId });
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

export default router;
