import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireTenantMember, TenantRequest } from '../middleware/requireTenantMember';

const router = Router();

router.get('/dashboard', requireTenantMember, async (req: TenantRequest, res) => {
  const tenantId = req.tenantId || (req.query.tenantId as string);

  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId is required' });
  }

  try {
    const { count: messagesSent } = await supabaseAdmin
      .from('broadcasts')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'completed');

    const { count: adConversions } = await supabaseAdmin
      .from('ctwa_ad_conversions')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    const { data: recoveredCarts } = await supabaseAdmin
      .from('abandoned_carts')
      .select('total_price')
      .eq('tenant_id', tenantId)
      .eq('status', 'recovered');
      
    const recoveredRevenue = (recoveredCarts || []).reduce((acc: number, curr: { total_price?: string | number }) => acc + Number(curr.total_price), 0);

    res.json({
      metrics: {
        messagesSent: messagesSent || 0,
        adConversions: adConversions || 0,
        recoveredRevenue,
      },
    });

  } catch (error) {
    console.error('[Analytics API] Failed to fetch dashboard metrics', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
