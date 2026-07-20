import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

// Get Unified Metrics Aggregation
router.get('/dashboard', async (req: any, res: any) => {
  const { tenantId, timeframe = '30d' } = req.query;

  if (!tenantId) {
    return res.status(400).json({ error: 'tenantId is required' });
  }

  try {
    // 1. Get Broadcast Message Volume
    const { count: messagesSent } = await supabaseAdmin
      .from('broadcasts')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'completed');

    // 2. Get CTWA Ad Conversions
    const { count: adConversions } = await supabaseAdmin
      .from('ctwa_ad_conversions')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // 3. Get Abandoned Carts Recovered Revenue
    const { data: recoveredCarts } = await supabaseAdmin
      .from('abandoned_carts')
      .select('total_price')
      .eq('tenant_id', tenantId)
      .eq('status', 'recovered');
      
    const recoveredRevenue = (recoveredCarts || []).reduce((acc: number, curr: any) => acc + Number(curr.total_price), 0);

    res.json({
      metrics: {
        messagesSent: messagesSent || 0,
        adConversions: adConversions || 0,
        recoveredRevenue: recoveredRevenue
      }
    });

  } catch (error) {
    console.error('[Analytics API] Failed to fetch dashboard metrics', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
