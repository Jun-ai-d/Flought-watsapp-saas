import { boss } from '../jobQueue';
import { supabaseAdmin } from '../../lib/supabase';
import { getBSPProvider } from '../../bsp/providerFactory';

/**
 * Initializes the E-Commerce Cart Recovery Worker
 */
export const initCartRecoveryWorker = () => {
  // SRE Focus: We use teamSize and limits to prevent spiking Meta's API during high cart abandonment periods (e.g. Black Friday)
  boss.work('process-abandoned-cart', async (job: any) => {
    const jobData = Array.isArray(job) ? job[0].data : job.data;
    const { tenantId, cartId, customerPhone, cartUrl, templateName } = jobData;

    console.log(`[Cart Recovery] Processing cart ${cartId} for tenant ${tenantId}`);

    try {
      // 1. Double-check cart status dynamically to prevent double-sending
      const { data: cart } = await supabaseAdmin
        .from('abandoned_carts')
        .select('status, platform_cart_id')
        .eq('platform_cart_id', cartId)
        .eq('tenant_id', tenantId)
        .single();

      // If cart is already recovered, completed, or doesn't exist, skip.
      if (!cart || cart.status !== 'pending') {
        console.log(`[Cart Recovery] Cart ${cartId} is no longer pending (status: ${cart?.status}). Skipping message.`);
        return;
      }

      // 2. Fetch BSP config
      const { data: bspConfig } = await supabaseAdmin
        .from('tenant_bsp_config')
        .select('bsp_provider, access_token_encrypted, waba_id, phone_number_id')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();

      if (!bspConfig) {
        throw new Error('No active BSP config found for tenant');
      }

      const { decryptToken } = await import('../../bsp/crypto');
      const decryptedConfig = {
        ...bspConfig,
        accessToken: decryptToken(bspConfig.access_token_encrypted)
      };

      const provider = getBSPProvider(decryptedConfig.bsp_provider);

      // 3. Send Recovery Template
      await provider.sendTemplateMessage({
        tenantId,
        to: customerPhone,
        templateId: templateName || 'abandoned_cart_recovery',
        category: 'marketing',
        templateParams: [cartUrl], // Passes the checkout URL to the template
        providerConfig: decryptedConfig
      });

      // 4. Mark as message sent
      await supabaseAdmin
        .from('abandoned_carts')
        .update({ status: 'message_sent', updated_at: new Date().toISOString() })
        .eq('platform_cart_id', cartId)
        .eq('tenant_id', tenantId);

      console.log(`[Cart Recovery] Recovery message sent for cart ${cartId}`);
      
    } catch (e: any) {
      console.error(`[Cart Recovery] Failed to process cart ${cartId}:`, e.message);
      // Let pg-boss handle retries based on configuration
      throw e; 
    }
  });
};
