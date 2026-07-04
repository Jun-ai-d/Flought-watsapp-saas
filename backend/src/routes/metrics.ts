import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { requireTenantMember } from '../middleware/requireTenantMember';

const router = Router();

router.get('/:tenantId', requireTenantMember, async (req, res) => {
  const { tenantId } = req.params;

  try {
    const [
      res1,
      res2,
      res3,
      res4,
      res5
    ] = await Promise.all([
      supabaseAdmin
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
        
      supabaseAdmin
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'resolved')
        .is('assigned_agent_id', null),
        
      supabaseAdmin
        .from('faqs')
        .select('match_count')
        .eq('tenant_id', tenantId),
        
      supabaseAdmin
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('status', ['handover_pending', 'handover_active']),
        
      supabaseAdmin
        .from('conversations')
        .select('id, customer_phone, last_message_at, status, handover_reason')
        .eq('tenant_id', tenantId)
        .eq('status', 'handover_pending')
        .order('last_message_at', { ascending: false })
        .limit(5)
    ]);

    if (res1.error) throw res1.error;
    if (res2.error) throw res2.error;
    if (res3.error) throw res3.error;
    if (res4.error) throw res4.error;
    if (res5.error) throw res5.error;

    const faqMatchTotal = (res3.data || []).reduce((sum, faq) => sum + (faq.match_count || 0), 0);

    res.json({
      totalMessages: res1.count || 0,
      botHandledCount: res2.count || 0,
      faqMatchTotal,
      handoverCount: res4.count || 0,
      recentHandovers: res5.data || []
    });
  } catch (error) {
    console.error('Metrics Error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

export default router;
