import { supabaseAdmin } from '../../lib/supabase';

/**
 * Tracks Click-to-WhatsApp (CTWA) Ad conversions.
 * Intercepts incoming messages to look for the "referral" payload from Meta.
 */
export async function trackCTWAConversion(tenantId: string, messagePayload: any, conversationId: string) {
  try {
    if (!messagePayload?.referral) {
      return false; // Not an ad-driven message
    }

    const { referral } = messagePayload;
    
    // Insert ad tracking data
    await supabaseAdmin.from('ctwa_ad_conversions').insert({
      tenant_id: tenantId,
      conversation_id: conversationId,
      ad_id: referral.ad_id,
      ad_title: referral.headline || 'Unknown Ad',
      source_url: referral.source_url,
      customer_phone: messagePayload.from
    });

    console.log(`[CTWA Tracker] Logged ad conversion from ad ${referral.ad_id} for tenant ${tenantId}`);
    return true;

  } catch (error) {
    console.error(`[CTWA Tracker] Failed to track ad conversion:`, error);
    return false;
  }
}
