/**
 * Inbound Webhook Handler
 * 
 * This module is the central nervous system for all incoming WhatsApp messages.
 * When a Business Solution Provider (BSP) like Gupshup receives a WhatsApp message
 * from a customer, it forwards it to this webhook handler.
 */

import { getBSPProvider } from '../bsp/providerFactory';
import { supabaseAdmin } from '../lib/supabase';
import { NormalizedInboundMessage } from '../bsp/BSPProvider';
import { processAutomationPipeline } from './automation/pipeline';
import { transcribeAudio } from './llm/stt';
import { fireOutboundWebhook } from './webhookService';
import { z } from 'zod';
import { parsePhoneNumberWithError } from 'libphonenumber-js';

const messageContentSchema = z.string().max(4096, "Message too long").transform((str) => {
  return str.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
});

function formatE164(phone: string): string {
  try {
    // Default to US if no country code provided, though BSPs usually provide +
    const phoneNumber = parsePhoneNumberWithError(phone, 'US'); 
    return phoneNumber.format('E.164');
  } catch (e) {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned ? `+${cleaned}` : phone;
  }
}

/**
 * Parses the raw payload from the BSP and routes it to the specific tenant processing pipeline.
 * @param providerName The BSP provider (e.g., 'gupshup')
 * @param headers HTTP Request headers
 * @param payload The raw JSON body from the BSP webhook
 */
export async function handleInboundWebhook(providerName: string, headers: any, payload: any) {
  // Retrieve the correct adapter for the BSP
  const provider = getBSPProvider(providerName);
  
  // Parse the proprietary BSP payload into our standard NormalizedInboundMessage format.
  // This abstracts away the difference between Gupshup, Meta, Twilio, etc.
  const messages = provider.parseInboundWebhook(payload);
  
  if (!messages || messages.length === 0) {
    return { status: 'ignored', reason: 'no inbound messages found' };
  }

  // Process each message asynchronously
  for (const msg of messages) {
    await processSingleMessage(msg, providerName);
  }

  return { status: 'success', processed: messages.length };
}

/**
 * Processes a single normalized message. It identifies the tenant, logs the message,
 * and triggers the AI/Automation pipeline if the conversation is not handed over to a human.
 */
async function processSingleMessage(msg: NormalizedInboundMessage, providerName: string) {
  let messageContent = msg.text || '';
  let transcript = '';

  try {
    messageContent = messageContentSchema.parse(messageContent);
  } catch (e) {
    console.warn(`[Sanitization] Message exceeded limits: ${e}`);
    messageContent = messageContent.substring(0, 4096).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  }

  msg.fromPhone = formatE164(msg.fromPhone);

  let accessToken: string | undefined;
  if (msg.type === 'audio' && msg.mediaUrl && providerName === 'meta') {
    const { data: bsp } = await supabaseAdmin.from('tenant_bsp_config')
      .select('access_token_encrypted')
      .eq('phone_number_id', msg.toPhoneNumberId)
      .maybeSingle();
    if (bsp && bsp.access_token_encrypted) {
      const { decryptToken } = await import('../bsp/crypto');
      accessToken = decryptToken(bsp.access_token_encrypted);
    }
  }

  if (msg.type === 'audio' && msg.mediaUrl) {
    console.log(`[STT] Transcribing voice note for ${msg.waMessageId}`);
    transcript = await transcribeAudio(msg.mediaUrl, providerName, accessToken);
    messageContent = transcript;
  }
  
  if (msg.type === 'order') {
    messageContent = '🛍️ Native Commerce Order Received! Please check your Meta Commerce Manager or Shopify for details.';
  }

  // Unified Database Transaction: Resolves tenant, manages session, and deduplicates message in a single RPC
  const { data: result, error: rpcError } = await supabaseAdmin.rpc('process_inbound_message', {
    p_phone_number_id: msg.toPhoneNumberId,
    p_customer_phone: msg.fromPhone,
    p_customer_name: msg.customerName || 'Customer',
    p_message_type: msg.type,
    p_content: messageContent,
    p_media_url: msg.mediaUrl,
    p_transcript: transcript || null,
    p_wa_message_id: msg.waMessageId,
    p_timestamp: msg.timestamp || new Date().toISOString()
  });

  if (rpcError) {
    console.error('Failed to process message via RPC:', rpcError);
    return;
  }

  if (result.status === 'error') {
    console.error(`RPC Error: ${result.reason} for phone_number_id ${msg.toPhoneNumberId}`);
    return;
  }

  if (result.status === 'duplicate') {
    console.log(`[Dedup] Message ${msg.waMessageId} already exists. Ignoring.`);
    return;
  }

  const tenantId = result.tenant_id;
  const conversationId = result.conversation_id;
  const currentStatus = result.conv_status;

  if (msg.type === 'audio' && transcript) {
    // Estimate duration: OGG voice notes are ~16kbps, so bytes / (16000/8) ≈ seconds
    const estimatedMinutes = Math.max(0.1, 0.5); // Keep 0.5 as default until we can get actual duration
    try { await supabaseAdmin.rpc('increment_usage', { p_tenant_id: tenantId, p_stt_minutes: estimatedMinutes }); } catch (e) { console.error(e); }
  }

  console.log(`✅ Processed inbound message from ${msg.fromPhone}`);
  
  // Trigger outbound webhook for developer integrations (Zapier, custom backend)
  fireOutboundWebhook(tenantId, {
    event: 'message.received',
    timestamp: msg.timestamp || new Date().toISOString(),
    data: {
      from: msg.fromPhone,
      name: msg.customerName || 'Customer',
      content: messageContent,
      type: msg.type,
      conversation_id: conversationId
    }
  });

  // Step 4: Routing to Automation / AI Pipeline
  // PRD CRITICAL RULE 1: A bot MUST NEVER send an automated message while a conversation is in human handover state.
  
  if (messageContent && currentStatus === 'bot') {
    // If it's a text/audio message and the bot is active, route to the debounce queue
    import('./jobQueue').then(({ enqueueDebouncedMessage }) => {
      enqueueDebouncedMessage(tenantId, conversationId, messageContent, msg.fromPhone, providerName, result.is_new_session);
    }).catch(e => {
      console.error('Error importing jobQueue for debouncing:', e);
    });
  } else if (!messageContent && currentStatus === 'bot') {
    // If the message has no text (e.g., sticker, location, contact card), the bot cannot process it.
    // We explicitly hand it over to a human rather than failing silently.
    console.log(`[Handover] Unsupported media type from ${msg.fromPhone}. Triggering handover.`);
    import('./automation/handover').then(({ triggerHandover }) => {
      triggerHandover(tenantId, conversationId, 'unsupported_media_type', 'Customer sent an unsupported attachment or location.', 'Customer sent an attachment.');
    });
  } else if (currentStatus !== 'bot') {
    // If the conversation is 'handover_pending' or 'handover_active', the bot is completely silenced.
    // The human agent will read the message via the Inbox UI and reply manually.
    console.log(`[Handover] Skipped automation pipeline for conv ${conversationId} because status is ${currentStatus}`);
  }
}
