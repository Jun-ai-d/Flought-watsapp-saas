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
  // Step 1: Identify Tenant
  // We determine which business this message belongs to by looking at the destination phone number ID.
  let tenantId: string | null = null;
  
  const { data: configs } = await supabaseAdmin
    .from('tenant_bsp_config')
    .select('tenant_id, waba_id, phone_number_id');
    
  const match = configs?.find(c => c.phone_number_id === msg.toPhoneNumberId || c.waba_id === msg.toPhoneNumberId);
  
  if (match) {
    tenantId = match.tenant_id;
  } else if (configs && configs.length > 0) {
    // Fallback: For local MVP testing, if no match is found, assign to the first available tenant.
    tenantId = configs[0].tenant_id; 
  }

  if (!tenantId) {
    console.error(`Could not resolve tenant for phone_number_id: ${msg.toPhoneNumberId}`);
    return;
  }

  // Step 2: Session Management (Find or Create Conversation)
  // We look for an existing conversation between this tenant and this customer's phone number.
  const { data: conv, error: convError } = await supabaseAdmin
    .from('conversations')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('customer_phone', msg.fromPhone)
    .single();

  let conversationId = conv?.id;

  if (!conversationId) {
    // If no conversation exists, create a fresh one and assign it to the 'bot' by default.
    const { data: newConv, error: newConvError } = await supabaseAdmin
      .from('conversations')
      .insert({
        tenant_id: tenantId,
        customer_phone: msg.fromPhone,
        customer_name: msg.customerName || 'Customer',
        status: 'bot', // Default state is bot-handled
        last_customer_message_at: msg.timestamp,
        last_message_at: msg.timestamp
      })
      .select('id')
      .single();
      
    if (newConvError) {
      console.error('Failed to create conversation:', newConvError);
      return;
    }
    conversationId = newConv.id;
  } else {
    // If it exists, just bump the "last active" timestamps.
    await supabaseAdmin
      .from('conversations')
      .update({
        last_customer_message_at: msg.timestamp,
        last_message_at: msg.timestamp
      })
      .eq('id', conversationId);
  }

  // Step 3: Message Persistence and Deduplication
  // Insert the raw message into the database. The `wa_message_id` has a UNIQUE constraint in Postgres.
  const { error: msgInsertError } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      direction: 'inbound',
      message_type: msg.type,
      content: msg.text || '',
      media_url: msg.mediaUrl,
      wa_message_id: msg.waMessageId,
      sender: 'customer'
    });

  if (msgInsertError) {
    // Postgres Error 23505 means Unique Violation. This safely deduplicates webhook retries from the BSP.
    if (msgInsertError.code === '23505') { 
      console.log(`[Dedup] Message ${msg.waMessageId} already exists. Ignoring.`);
      return;
    }
    console.error('Failed to insert message:', msgInsertError);
    return;
  }

  console.log(`✅ Processed inbound message from ${msg.fromPhone}`);
  
  // Step 4: Routing to Automation / AI Pipeline
  // PRD CRITICAL RULE 1: A bot MUST NEVER send an automated message while a conversation is in human handover state.
  const currentStatus = conv?.status || 'bot';
  
  if (msg.type === 'text' && msg.text && currentStatus === 'bot') {
    // If it's a text message and the bot is active, route to the AI generator.
    // This is executed asynchronously (.catch) so we can instantly return a 200 OK to the webhook provider.
    processAutomationPipeline(tenantId, conversationId, msg.text, msg.fromPhone, providerName).catch(e => {
      console.error('Error in automation pipeline:', e);
    });
  } else if (currentStatus !== 'bot') {
    // If the conversation is 'handover_pending' or 'handover_active', the bot is completely silenced.
    // The human agent will read the message via the Inbox UI and reply manually.
    console.log(`[Handover] Skipped automation pipeline for conv ${conversationId} because status is ${currentStatus}`);
  }
}
