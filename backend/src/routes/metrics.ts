import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

router.get('/:tenantId', async (req, res) => {
  const { tenantId } = req.params;

  try {
    // 1. Total Messages
    const { count: totalMessages, error: err1 } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (err1) throw err1;

    // 2. Bot Handled Conversations (Resolved without agent)
    // We proxy this by counting conversations that are resolved 
    // and have no assigned agent.
    const { count: botHandledCount, error: err2 } = await supabaseAdmin
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'resolved')
      .is('assigned_agent_id', null);

    if (err2) throw err2;

    // 3. FAQ Matches Total
    const { data: faqs, error: err3 } = await supabaseAdmin
      .from('faqs')
      .select('match_count')
      .eq('tenant_id', tenantId);

    if (err3) throw err3;
    const faqMatchTotal = faqs.reduce((sum, faq) => sum + (faq.match_count || 0), 0);

    // 4. Active Handovers (Pending or Active)
    const { count: handoverCount, error: err4 } = await supabaseAdmin
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', ['handover_pending', 'handover_active']);

    if (err4) throw err4;

    // 5. Recent Handovers
    const { data: recentHandovers, error: err5 } = await supabaseAdmin
      .from('conversations')
      .select('id, customer_phone, last_message_at, status, handover_reason')
      .eq('tenant_id', tenantId)
      .eq('status', 'handover_pending')
      .order('last_message_at', { ascending: false })
      .limit(5);

    if (err5) throw err5;

    res.json({
      totalMessages: totalMessages || 0,
      botHandledCount: botHandledCount || 0,
      faqMatchTotal,
      handoverCount: handoverCount || 0,
      recentHandovers
    });
  } catch (error) {
    console.error('Metrics Error:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

export default router;
