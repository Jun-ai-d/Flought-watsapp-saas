/**
 * Human Handover Logic
 * 
 * This module is triggered when the AI is unable to confidently answer a customer's query,
 * or when a customer explicitly asks to "talk to a human". 
 * 
 * It transitions the conversation state from 'bot' to 'handover_pending', which immediately
 * mutes the bot and flags the conversation in the human agent's Inbox UI.
 */

import { supabaseAdmin } from '../../lib/supabase';

const HUMAN_INTENT_KEYWORDS = [
  'human', 'agent', 'person', 'representative', 'customer service',
  'speak to someone', 'talk to someone', 'help me'
];

/**
 * Checks if the customer explicitly requested human intervention using regex/keywords.
 */
export function checkHumanIntent(text: string): boolean {
  const normalized = text.toLowerCase();
  return HUMAN_INTENT_KEYWORDS.some(kw => normalized.includes(kw));
}

/**
 * Executes the handover protocol.
 * @param tenantId The ID of the business
 * @param conversationId The ID of the active conversation
 * @param reason Why the handover was triggered (e.g., 'low_confidence', 'explicit_request')
 */
export async function triggerHandover(tenantId: string, conversationId: string, reason: string) {
  // Update the conversation status in Postgres.
  // The 'inbox-changes' Realtime channel in the React frontend listens for this update
  // and will immediately flash this conversation in the agent's Inbox.
  const { error } = await supabaseAdmin
    .from('conversations')
    .update({ 
      status: 'handover_pending', 
      handover_reason: reason 
    })
    .eq('id', conversationId)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error(`Handover failed for conv ${conversationId}:`, error);
  } else {
    console.log(`[Handover Triggered] Conv ${conversationId} -> pending (${reason})`);
  }
}
