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
import OpenAI from 'openai';
import { fireOutboundWebhook } from '../webhookService';
import { scheduleSLACheck } from './slaWorker';

const openai = new OpenAI();

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
 * Classifies the customer intent into a department and generates a brief summary using LLM.
 */
async function classifyAndSummarizeHandover(message: string, historyText: string = ''): Promise<{ department: string, summary: string }> {
  const systemPrompt = `You are a triage router for a WhatsApp customer service inbox. 
Analyze the conversation history and the latest customer message.

Your task:
1. Classify the request into ONE of these departments: "sales", "support", "billing", or "general".
   - sales: buying, pricing, product features
   - support: reporting an issue, bug, fixing something
   - billing: invoices, payments, refunds, subscriptions
   - general: anything else
2. Write a concise 1-2 sentence summary of what the customer is asking for or what issue they are facing. This summary will be read by a human agent to quickly understand the context without reading the whole chat.

You MUST respond with a JSON object containing EXACTLY two fields:
{
  "department": "sales|support|billing|general",
  "summary": "<your concise summary>"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `History:\n${historyText}\n\nLatest Message: ${message}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 150
    });
    
    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    
    let dept = (parsed.department || 'general').trim().toLowerCase();
    dept = dept.replace(/[^a-z]/g, ''); 
    if (!['sales', 'support', 'billing'].includes(dept)) {
      dept = 'general';
    }
    
    const summary = parsed.summary || 'Customer requested human assistance.';

    return { department: dept, summary };
  } catch (error) {
    console.error('Failed to classify and summarize handover via LLM:', error);
    return { department: 'general', summary: 'Customer requested human assistance. AI summarization failed.' };
  }
}

/**
 * Executes the handover protocol.
 * @param tenantId The ID of the business
 * @param conversationId The ID of the active conversation
 * @param reason Why the handover was triggered (e.g., 'low_confidence', 'explicit_request')
 * @param lastMessage The last message from the customer to classify
 * @param historyText String representation of the recent conversation history
 */
export async function triggerHandover(tenantId: string, conversationId: string, reason: string, lastMessage: string = '', historyText: string = '', skipClassification: boolean = false) {
  let department = 'general';
  let summary = 'Customer requested human assistance.';
  
  if (lastMessage && !skipClassification) {
    const result = await classifyAndSummarizeHandover(lastMessage, historyText);
    department = result.department;
    summary = result.summary;
    console.log(`[Handover] LLM Classified conversation ${conversationId} as department: ${department}`);
  } else if (reason === 'billing_quota_exceeded') {
    summary = 'Automated handover: AI processing aborted because the business has exceeded its monthly message/LLM quota. Please upgrade plan to restore bot functionality.';
  }

  const { error } = await supabaseAdmin
    .from('conversations')
    .update({ 
      status: 'handover_pending', 
      handover_reason: reason,
      department: department,
      handover_summary: summary,
      sla_breached: false,
    })
    .eq('id', conversationId)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error(`Handover failed for conv ${conversationId}:`, error);
  } else {
    console.log(`[Handover Triggered] Conv ${conversationId} -> pending (${reason}) [Dept: ${department}]`);

    await scheduleSLACheck(tenantId, conversationId);
    
    // Alert external CRM via webhook
    fireOutboundWebhook(tenantId, {
      event: 'handover.requested',
      timestamp: new Date().toISOString(),
      data: {
        conversation_id: conversationId,
        reason: reason,
        department: department,
        summary: summary
      }
    });
  }
}
