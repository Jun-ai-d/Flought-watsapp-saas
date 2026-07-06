import { Job } from 'pg-boss';
import { boss } from './jobQueue';
import { supabaseAdmin } from '../lib/supabase';
import { getBSPProvider } from '../bsp/providerFactory';
import { decryptToken } from '../bsp/crypto';

export interface SendTemplateJobData {
  tenantId: string;
  contactPhone: string;
  templateId: string;
  bspTemplateId: string;
  category: string;
  templateName: string;
  bspProvider: string;
  traceId?: string;
}

export const initBroadcasterWorkers = async () => {
  // Create queue first (pg-boss v10+ requires explicit queue creation)
  await boss.createQueue('send-template-message');
  // We allow multiple concurrent jobs for high throughput
  await boss.work<SendTemplateJobData>('send-template-message', { batchSize: 50 }, async (jobs) => {
    for (const job of jobs) {
      const { data, id: jobId } = job;
      try {
        // Security: Re-fetch and decrypt BSP config at execution time
        // instead of reading it from the job payload (which is stored in Postgres)
        const { data: bspConfig } = await supabaseAdmin
          .from('tenant_bsp_config')
          .select('*')
          .eq('tenant_id', data.tenantId)
          .single();

        if (!bspConfig) {
          console.error('BSP config not found for tenant', { tenantId: data.tenantId, jobId });
          continue;
        }

        const providerConfig = { ...bspConfig };
        if (providerConfig.access_token_encrypted) {
          providerConfig.access_token_encrypted = decryptToken(providerConfig.access_token_encrypted);
        }

        const provider = getBSPProvider(data.bspProvider);

        const result = await provider.sendTemplateMessage({
          tenantId: data.tenantId,
          to: data.contactPhone,
          templateId: data.bspTemplateId || data.templateId,
          category: data.category as any,
          templateParams: [],
          providerConfig
        });

        await supabaseAdmin.from('messages').insert({
          tenant_id: data.tenantId,
          conversation_id: null,
          wa_message_id: result.bspMessageId,
          direction: 'outbound',
          type: 'template',
          sender_type: 'bot',
          status: result.status,
          content: { text: `Template broadcast: ${data.templateName}` }
        } as any);

        console.log('Successfully processed broadcast job', { jobId, phone: data.contactPhone, trace_id: data.traceId });
      } catch (error) {
        console.error('Failed to process broadcast job', { jobId, phone: data.contactPhone, error, trace_id: data.traceId });
        throw error; // Let pg-boss handle retries
      }
    }
  });
};
