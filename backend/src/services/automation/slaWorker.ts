import { boss } from '../jobQueue';
import { supabaseAdmin } from '../../lib/supabase';

const OPEN_HANDOVER_STATUSES = new Set(['handover_pending', 'handover_active']);

export const initSLAWorker = async () => {
  await boss.createQueue('check-sla-breach');

  // Fires after a delayed job enqueued at handover time (default 15 minutes).
  await boss.work('check-sla-breach', async (job: any) => {
    const jobData = Array.isArray(job) ? job[0].data : job.data;
    const { tenantId, conversationId } = jobData;

    try {
      const { data: conversation } = await supabaseAdmin
        .from('conversations')
        .select('status, assignee_id, sla_breached')
        .eq('id', conversationId)
        .eq('tenant_id', tenantId)
        .single();

      if (
        conversation &&
        OPEN_HANDOVER_STATUSES.has(conversation.status) &&
        !conversation.sla_breached
      ) {
        console.warn(`[SLA Breach] Conversation ${conversationId} breached SLA. Alerting manager.`);

        await supabaseAdmin.from('conversation_notes').insert({
          tenant_id: tenantId,
          conversation_id: conversationId,
          content: '⚠️ SYSTEM: SLA Breach detected. Conversation unresolved for over 15 minutes.',
        });

        await supabaseAdmin
          .from('conversations')
          .update({ sla_breached: true })
          .eq('id', conversationId)
          .eq('tenant_id', tenantId);
      }
    } catch (error: any) {
      console.error(`[SLA Worker] Failed to check SLA for ${conversationId}:`, error.message);
      throw error;
    }
  });
};

/** Schedule a one-shot SLA check for an open handover conversation. */
export async function scheduleSLACheck(
  tenantId: string,
  conversationId: string,
  delaySeconds = 15 * 60
) {
  try {
    await boss.send(
      'check-sla-breach',
      { tenantId, conversationId },
      { startAfter: delaySeconds }
    );
  } catch (error: any) {
    console.error(`[SLA] Failed to schedule check for ${conversationId}:`, error.message);
  }
}
