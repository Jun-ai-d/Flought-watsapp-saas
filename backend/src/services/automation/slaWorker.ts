import { boss } from '../jobQueue';
import { supabaseAdmin } from '../../lib/supabase';

export const initSLAWorker = () => {
  // Checks if a conversation is still unresolved after the SLA timer expires
  boss.work('check-sla-breach', async (job: any) => {
    const jobData = Array.isArray(job) ? job[0].data : job.data;
    const { tenantId, conversationId } = jobData;

    try {
      const { data: conversation } = await supabaseAdmin
        .from('conversations')
        .select('status, assignee_id, sla_breached')
        .eq('id', conversationId)
        .eq('tenant_id', tenantId)
        .single();

      // If still open/assigned and not closed, and NOT already breached, it's a breach
      if (conversation && conversation.status !== 'closed' && !conversation.sla_breached) {
        console.warn(`[SLA Breach] Conversation ${conversationId} breached SLA. Alerting manager.`);
        
        // Add a note about the breach
        await supabaseAdmin.from('conversation_notes').insert({
          tenant_id: tenantId,
          conversation_id: conversationId,
          content: '⚠️ SYSTEM: SLA Breach detected. Conversation unresolved for over 15 minutes.'
        });

        // Mark as breached so we don't spam duplicate notes
        await supabaseAdmin.from('conversations')
          .update({ sla_breached: true })
          .eq('id', conversationId)
          .eq('tenant_id', tenantId);

        // Here we could trigger a webhook or email to the tenant admins
      }
    } catch (error: any) {
      console.error(`[SLA Worker] Failed to check SLA for ${conversationId}:`, error.message);
      throw error;
    }
  });
};
