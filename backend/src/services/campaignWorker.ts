import { supabaseAdmin } from '../lib/supabase';
import { getBSPProvider } from '../bsp/providerFactory';
import { decryptToken } from '../bsp/crypto';

/**
 * Initializes the Campaign Polling Worker
 * This worker runs periodically to check for due drip campaign steps and fires them.
 */
export async function initCampaignWorker() {
  console.log('🔄 Initializing Drip Campaign Worker...');
  
  // Run every 60 seconds
  setInterval(async () => {
    await processDueCampaigns();
  }, 60 * 1000);
  
  // Kick off first run immediately
  processDueCampaigns();
}

async function processDueCampaigns() {
  try {
    // Find active enrollments where next_step_at is in the past
    const { data: enrollments, error: enrollError } = await supabaseAdmin
      .from('drip_enrollments')
      .select('id, campaign_id, contact_phone, current_step_order, next_step_at')
      .eq('status', 'active')
      .lte('next_step_at', new Date().toISOString());

    if (enrollError) {
      console.error('[Campaign Worker] Error fetching enrollments:', enrollError);
      return;
    }

    if (!enrollments || enrollments.length === 0) {
      return; // Nothing to process
    }

    console.log(`[Campaign Worker] Found ${enrollments.length} due enrollments.`);

    for (const enrollment of enrollments) {
      await processEnrollment(enrollment);
    }
  } catch (error) {
    console.error('[Campaign Worker] Unexpected error:', error);
  }
}

async function processEnrollment(enrollment: any) {
  try {
    // 1. Fetch the campaign to get tenant_id
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('drip_campaigns')
      .select('tenant_id')
      .eq('id', enrollment.campaign_id)
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Campaign not found for enrollment ${enrollment.id}`);
    }

    // 2. Fetch the current step
    const { data: step, error: stepError } = await supabaseAdmin
      .from('drip_steps')
      .select('*, message_templates(name, body, status, category)')
      .eq('campaign_id', enrollment.campaign_id)
      .eq('step_order', enrollment.current_step_order)
      .single();

    // If no step is found, it means the campaign is over.
    if (stepError || !step) {
      await supabaseAdmin
        .from('drip_enrollments')
        .update({ status: 'completed' })
        .eq('id', enrollment.id);
      return;
    }

    const tenantId = campaign.tenant_id;
    const template = step.message_templates;

    // 3. Send the Template via BSP
    if (template && template.status === 'approved') {
      const { data: config } = await supabaseAdmin
        .from('tenant_bsp_config')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('bsp_provider', 'gupshup') // Hardcoded default for MVP, can be extended to multi-provider
        .single();

      if (config) {
        const provider = getBSPProvider('gupshup');
        const decryptedConfig = { ...config };
        if (decryptedConfig.access_token_encrypted) {
          decryptedConfig.access_token_encrypted = decryptToken(decryptedConfig.access_token_encrypted);
        }

        console.log(`[Campaign Worker] Sending template ${template.name} to ${enrollment.contact_phone}`);
        
        await provider.sendTemplateMessage({
          tenantId,
          to: enrollment.contact_phone,
          templateId: template.name, // The BSP adapter currently uses the name as the provider's template identifier
          category: template.category as any || 'marketing',
          templateParams: [],
          providerConfig: decryptedConfig
        });
      }
    }

    // 4. Find the NEXT step to calculate delay
    const { data: nextStep, error: nextStepError } = await supabaseAdmin
      .from('drip_steps')
      .select('delay_hours')
      .eq('campaign_id', enrollment.campaign_id)
      .eq('step_order', enrollment.current_step_order + 1)
      .single();

    if (nextStepError || !nextStep) {
      // No more steps, mark as completed
      await supabaseAdmin
        .from('drip_enrollments')
        .update({ status: 'completed' })
        .eq('id', enrollment.id);
    } else {
      // Calculate next time
      const delayHours = nextStep.delay_hours || 0;
      const nextTime = new Date();
      nextTime.setHours(nextTime.getHours() + delayHours);

      await supabaseAdmin
        .from('drip_enrollments')
        .update({ 
          current_step_order: enrollment.current_step_order + 1,
          next_step_at: nextTime.toISOString()
        })
        .eq('id', enrollment.id);
    }

  } catch (err: any) {
    console.error(`[Campaign Worker] Failed to process enrollment ${enrollment.id}:`, err);
  }
}
