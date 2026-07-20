import { boss } from '../jobQueue';
import { supabaseAdmin } from '../../lib/supabase';
import { getBSPProvider } from '../../bsp/providerFactory';

export const initOrderSyncWorker = () => {
  // Handles COD order confirmation requests
  boss.work('process-cod-confirmation', async (job: any) => {
    const jobData = Array.isArray(job) ? job[0].data : job.data;
    const { tenantId, orderId, customerPhone, templateName, orderDetails } = jobData;

    console.log(`[Order Sync] Processing COD confirmation for order ${orderId}`);

    try {
      const { data: bspConfig } = await supabaseAdmin
        .from('tenant_bsp_config')
        .select('bsp_provider, access_token_encrypted, waba_id, phone_number_id')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();

      if (!bspConfig) throw new Error('No active BSP config found');

      const { decryptToken } = await import('../../bsp/crypto');
      const decryptedConfig = {
        ...bspConfig,
        accessToken: decryptToken(bspConfig.access_token_encrypted)
      };

      const provider = getBSPProvider(decryptedConfig.bsp_provider);

      // Send the interactive template with a "Confirm Order" payload button
      await provider.sendTemplateMessage({
        tenantId,
        to: customerPhone,
        templateId: templateName || 'cod_order_confirmation',
        category: 'utility',
        templateParams: [orderDetails.orderNumber, orderDetails.totalPrice],
        providerConfig: decryptedConfig
      });

      await supabaseAdmin
        .from('order_confirmations')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('platform_order_id', orderId)
        .eq('tenant_id', tenantId);

    } catch (e: any) {
      console.error(`[Order Sync] COD Confirmation failed for ${orderId}:`, e.message);
      throw e;
    }
  });

  // Standard transactional updates (Out for delivery, etc)
  boss.work('process-order-update', async (job: any) => {
    const jobData = Array.isArray(job) ? job[0].data : job.data;
    const { tenantId, customerPhone, templateName, params } = jobData;

    try {
      const { data: bspConfig } = await supabaseAdmin
        .from('tenant_bsp_config')
        .select('bsp_provider, access_token_encrypted')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();

      if (!bspConfig) return;

      const { decryptToken } = await import('../../bsp/crypto');
      const provider = getBSPProvider(bspConfig.bsp_provider);
      
      await provider.sendTemplateMessage({
        tenantId,
        to: customerPhone,
        templateId: templateName,
        category: 'utility',
        templateParams: params || [],
        providerConfig: { ...bspConfig, accessToken: decryptToken(bspConfig.access_token_encrypted) }
      });
    } catch (e: any) {
      console.error(`[Order Sync] Update failed:`, e.message);
      throw e;
    }
  });
};
