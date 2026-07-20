import { boss } from '../jobQueue';
import { supabaseAdmin } from '../../lib/supabase';
import { getBSPProvider } from '../../bsp/providerFactory';
import { fetchAudience } from './segmentation';

/**
 * Handles the actual execution of a broadcast.
 * This worker takes a broadcast ID, fetches the audience,
 * and fans out the messages as individual jobs to respect API rate limits.
 */
export const initBroadcastWorkers = () => {
  // 1. The fan-out worker (Takes 1 Broadcast -> Creates N Message Jobs)
  boss.work('process-broadcast', async (job: any) => {
    // pg-boss can sometimes pass an array of jobs if batching is enabled
    const jobData = Array.isArray(job) ? job[0].data : job.data;
    const { broadcastId, tenantId, templateName, audienceFilter } = jobData;
    console.log(`[Broadcast] Processing fan-out for broadcast ${broadcastId}`);

    try {
      // Fetch provider config
      const { data: bspConfig } = await supabaseAdmin
        .from('tenant_bsp_config')
        .select('bsp_provider, access_token_encrypted, waba_id, phone_number_id')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();

      if (!bspConfig) {
        throw new Error('No active BSP config found for tenant');
      }

      // Fetch audience
      const audience = await fetchAudience(tenantId, audienceFilter);
      
      if (audience.length === 0) {
        await supabaseAdmin.from('broadcasts').update({ status: 'completed', total_recipients: 0 }).eq('id', broadcastId);
        return;
      }

      // Update broadcast to processing
      await supabaseAdmin.from('broadcasts').update({ 
        status: 'processing', 
        total_recipients: audience.length 
      }).eq('id', broadcastId);

      // Fan out: create a queue job for each contact.
      const jobs = audience.map((contact: any) => ({
        broadcastId,
        tenantId,
        contactId: contact.id,
        phoneNumber: contact.phone_number,
        templateName,
        providerConfig: bspConfig
      }));

      // Map over and send safely
      await Promise.all(jobs.map((j: any) => boss.send('send-broadcast-message', j)));

    } catch (e: any) {
      console.error(`[Broadcast] Failed to process fan-out: ${e.message}`);
      await supabaseAdmin.from('broadcasts').update({ status: 'failed' }).eq('id', broadcastId);
    }
  });

  // 2. The sender worker (Executes 1 Message)
  boss.work('send-broadcast-message', async (job: any) => {
    const jobData = Array.isArray(job) ? job[0].data : job.data;
    const { broadcastId, tenantId, contactId, phoneNumber, templateName, providerConfig } = jobData;

    try {
      const provider = getBSPProvider(providerConfig.bsp_provider);
      
      // We need to decrypt the access token
      const { decryptToken } = await import('../../bsp/crypto');
      const decryptedConfig = {
        ...providerConfig,
        accessToken: decryptToken(providerConfig.access_token_encrypted)
      };

      const result = await provider.sendTemplateMessage({
        tenantId,
        to: phoneNumber,
        templateId: templateName,
        category: 'marketing',
        templateParams: [], // For now, dynamic variables aren't passed.
        providerConfig: decryptedConfig
      });

      // Log success to broadcast analytics
      await supabaseAdmin.rpc('increment_broadcast_success', { p_broadcast_id: broadcastId });
      
      // Log message to conversations (simplified)
      // In a robust system, we would first find/create the conversation.
      
    } catch (e: any) {
      console.error(`[Broadcast] Message failed for ${phoneNumber}:`, e.message);
      await supabaseAdmin.rpc('increment_broadcast_failure', { p_broadcast_id: broadcastId });
    }
  });
};
