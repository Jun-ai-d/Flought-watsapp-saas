import { supabaseAdmin } from '../../lib/supabase';
import { checkHumanIntent, triggerHandover } from './handover';
import { matchFAQ } from './faqMatcher';
import { executeFlow } from './flowMatcher';
import { retrieveRelevantChunks } from '../kb/retrieval';
import { generateRAGResponse } from '../llm/generator';
import { getBSPProvider } from '../../bsp/providerFactory';
import { appCache } from '../../lib/cache';

/**
 * Note 1: The Automation Pipeline
 * This is the central brain of the bot. Every inbound message that is not actively 
 * being handled by a human agent is routed through this function. 
 * 
 * We use a "Waterfall Pattern" here. The system evaluates the message against a series 
 * of increasingly complex (and expensive) systems. If a faster, cheaper system can 
 * handle the message, the function returns early, preventing unnecessary database or LLM calls.
 * 
 * @param tenantId The unique UUID of the SaaS customer (the business)
 * @param conversationId The UUID linking this message to a specific thread
 * @param messageText The raw text the end-user sent
 * @param customerPhone The recipient's WhatsApp number
 * @param providerName The BSP (e.g., 'meta', 'gupshup') routing this message
 */
export async function processAutomationPipeline(
  tenantId: string, 
  conversationId: string, 
  messageText: string,
  customerPhone: string,
  providerName: string
) {
  console.log(`[Pipeline] Starting for conv ${conversationId}`);

  /**
   * Note 2: Human Handover Priority (Gate 1)
   * The most critical rule of a chatbot is knowing when to step aside.
   * `checkHumanIntent` uses fast Regex (e.g. checking for "talk to agent") to catch 
   * escalation requests. We do this BEFORE any database queries to save resources.
   */
  if (checkHumanIntent(messageText)) {
    // If the user is frustrated or explicitly asks for help, we immediately trigger a handover.
    // This updates the conversation state in Postgres and sends an alert to the tenant dashboard.
    await triggerHandover(tenantId, conversationId, 'explicit_request', messageText);
    return; // Fast exit!
  }

  /**
   * Note 3: Quota Enforcement (Gate 1.5)
   * Since this is a multi-tenant SaaS, we must ensure the business hasn't exceeded their 
   * plan's limits. We use a Supabase RPC (Remote Procedure Call) here.
   * RPCs are excellent because they allow us to execute complex aggregation logic 
   * entirely inside Postgres, rather than pulling rows into Node.js to count them.
   */
  const { data: hasQuota, error: quotaError } = await supabaseAdmin.rpc('check_tenant_quota', {
    p_tenant_id: tenantId
  });
  
  if (!quotaError && hasQuota === false) {
    console.log(`[Pipeline] Quota exceeded for tenant ${tenantId}. Aborting LLM and forcing handover.`);
    // We gracefully fail by handing the conversation over to a human with a system note.
    await triggerHandover(tenantId, conversationId, 'billing_quota_exceeded', messageText, '', true);
    return;
  }

  /**
   * Note 4: Visual Bot Flow (Gate 2)
   * Before applying AI, we check if the user is stuck inside a deterministic decision tree
   * (e.g., "Press 1 for Sales, 2 for Support"). Decision trees are stateful.
   */
  const flowResult = await executeFlow(tenantId, messageText);
  if (flowResult.matched) {
    if (flowResult.replyText) {
      console.log(`[Pipeline] Bot Flow Matched! Triggering visual flow response.`);
      await sendBotReply(tenantId, conversationId, customerPhone, providerName, flowResult.replyText, 'flow');
    } else {
      console.log(`[Pipeline] Bot Flow Matched but no response node connected.`);
    }
    return; // Deterministic flow match, exit pipeline.
  }

  /**
   * Note 5: Exact Match FAQ (Gate 3)
   * If they aren't in a flow, we check for exact keyword matches. This allows businesses 
   * to strictly control answers to common questions (like pricing or hours) without 
   * risking LLM hallucinations.
   */
  const faqResult = await matchFAQ(tenantId, messageText);
  if (faqResult.matched && faqResult.answer) {
    console.log(`[Pipeline] FAQ Matched: ${faqResult.faqId}`);
    await sendBotReply(tenantId, conversationId, customerPhone, providerName, faqResult.answer, 'faq');
    return; // Exact match found, exit pipeline.
  }

  /**
   * Note 6: Concurrent Data Fetching for LLM context
   * If all fast deterministic gates fail, we prepare for a slow Generative AI call.
   * The AI needs three things to respond intelligently:
   * 1. RAG context (semantic search against uploaded docs via pgvector)
   * 2. Tenant profile info (e.g., business name)
   * 3. Conversation history (the last 6 messages for short-term memory)
   * 
   * We use `Promise.all` to fetch all three over the network simultaneously. 
   * This is a crucial Node.js performance pattern that cuts latency by ~60% compared 
   * to awaiting them sequentially.
   */
  const [chunks, { data: tenant }, { data: history }] = await Promise.all([
    retrieveRelevantChunks(tenantId, messageText),
    supabaseAdmin.from('tenants').select('business_name, ai_settings').eq('id', tenantId).single(),
    supabaseAdmin
      .from('messages')
      .select('direction, content')
      .eq('conversation_id', conversationId)
      // We order by descending so we get the 6 most recent, then reverse them later.
      .order('created_at', { ascending: false })
      .limit(6)
  ]);

  // AI Settings check (fixed greeting vs LLM)
  const aiSettings = tenant?.ai_settings as Record<string, any> | undefined;
  
  // If the conversation is brand new (history is empty or only has the current inbound message),
  // and the tenant has selected a fixed greeting, we bypass RAG entirely.
  // Note: history contains the CURRENT message because it was inserted in processSingleMessage, 
  // so a "new" conversation has exactly 1 message in history.
  if (history && history.length === 1 && aiSettings?.greeting_type === 'fixed') {
    const fixedGreeting = aiSettings.fixed_greeting_message || 'Hi, how can we help you today?';
    console.log(`[Pipeline] New conversation. Using fixed greeting: "${fixedGreeting}"`);
    await sendBotReply(tenantId, conversationId, customerPhone, providerName, fixedGreeting, 'faq');
    return;
  }

  /**
   * Note 7: Safe Fallback for Empty Knowledge Bases
   * If the `retrieveRelevantChunks` function returns an empty array, it means either:
   * a) The tenant hasn't uploaded any documents.
   * b) The user's question was completely off-topic and matched nothing in the vector DB.
   * 
   * We NEVER want the LLM to guess (hallucinate) the answer, so we strictly 
   * hand over to a human instead.
   */
  if (chunks.length === 0) {
    console.log(`[Pipeline] No RAG chunks found.`);
    
    // We format the history so the human agent can read it quickly in the dashboard.
    const formattedHistoryText = (history || []).reverse().map(h => 
      h.direction === 'inbound' ? `Customer: ${h.content}` : `Bot: ${h.content}`
    ).join('\n');

    // Trigger handover per Technical Requirements Document (TRD) §3.2
    await triggerHandover(tenantId, conversationId, 'low_confidence_retrieval', messageText, formattedHistoryText);
    return;
  }

  /**
   * Note 8: Generative LLM Execution
   * The context is gathered, so we invoke the language model.
   * Notice how we use optional chaining (`?.`) with a fallback for the business name.
   */
  const businessName = tenant?.business_name || 'this business';
  
  // The LLM needs the history in chronological order (oldest to newest), 
  // so we reverse the array we got back from Postgres.
  const formattedHistory = (history || []).reverse().map(h => ({
    direction: h.direction as 'inbound' | 'outbound',
    content: h.content
  }));

  const systemPromptOverride = aiSettings?.system_prompt;

  const llmResponse = await generateRAGResponse(messageText, chunks, businessName, formattedHistory, systemPromptOverride);

  /**
   * Note 9: Non-blocking Analytics Tracking
   * We wrap the usage tracking in a try/catch and don't await its result for UI feedback. 
   * Analytics should NEVER break the core user experience if they fail.
   */
  try { await supabaseAdmin.rpc('increment_usage', { p_tenant_id: tenantId, p_llm_calls: 1 }); } catch (e) { console.error(e); }

  /**
   * Note 10: Confidence-Based Routing
   * Even after generating a response, the LLM evaluates its own confidence.
   * If confidence is low (e.g. the documents were slightly related, but didn't directly 
   * answer the question), we send the user the generated answer (usually an apology/deferral) 
   * BUT we still trigger a human handover so a staff member can step in.
   */
  if (llmResponse.confidence !== 'high') {
    console.log(`[Pipeline] LLM returned low confidence.`);
    await sendBotReply(tenantId, conversationId, customerPhone, providerName, llmResponse.content, 'rag', chunks.map(c => c.id));
    
    const formattedHistoryText = formattedHistory.map(h => 
      h.direction === 'inbound' ? `Customer: ${h.content}` : `Bot: ${h.content}`
    ).join('\n');
    
    await triggerHandover(tenantId, conversationId, 'low_confidence_generation', messageText, formattedHistoryText);
    return;
  }

  // If everything went perfectly, we dispatch the highly-confident AI response.
  console.log(`[Pipeline] LLM generated high confidence response.`);
  await sendBotReply(tenantId, conversationId, customerPhone, providerName, llmResponse.content, 'rag', chunks.map(c => c.id));
}


/**
 * Note 11: The Dispatcher Function
 * This helper isolates the complex logic of actually routing a message out to WhatsApp.
 * It handles caching, security decryption, WhatsApp policy checks, and database logging.
 */
async function sendBotReply(
  tenantId: string, 
  conversationId: string, 
  toPhone: string, 
  providerName: string, 
  text: string,
  source: 'faq' | 'rag' | 'flow',
  chunkIds?: string[]
) {
  /**
   * Note 12: In-Memory Caching
   * Fetching the BSP config for every single message from the database is incredibly slow.
   * We use `appCache` (an LRU memory cache) to store the configuration for 5 minutes (300s).
   * This drastically reduces database read IOPS under heavy load.
   */
  const cacheKey = `bsp_config_${tenantId}_${providerName}`;
  let config = appCache.get<any>(cacheKey);
  
  if (!config) {
    // Cache miss! We have to hit the database.
    const { data } = await supabaseAdmin
      .from('tenant_bsp_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('bsp_provider', providerName)
      .single();
    
    config = data;
    if (config) {
      appCache.set(cacheKey, config, 300); // cache for 5 minutes
    }
  }

  /**
   * Note 13: The Strict WhatsApp 24-Hour Policy Window
   * Meta strictly forbids businesses from sending free-form promotional messages or AI replies 
   * if the user hasn't messaged the business in the last 24 hours.
   * We enforce this at the database level by checking the timestamp of the last inbound message.
   * Failing to check this could lead to the Meta App being banned for spam.
   */
  const { data: latestInbound } = await supabaseAdmin
    .from('messages')
    .select('created_at')
    .eq('conversation_id', conversationId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestInbound) {
    // Calculate the difference between now and the timestamp in hours
    const hoursSinceLastMessage = (Date.now() - new Date(latestInbound.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastMessage > 24) {
      console.warn(`[Pipeline] Aborting bot reply. Customer hasn't messaged in >24 hours (strict WhatsApp policy).`);
      return; // Do not attempt to send; Meta will reject it anyway.
    }
  }

  /**
   * Note 14: Security / Encryption at Rest
   * The access token used to authenticate with Meta is sensitive. We encrypt it before saving 
   * it to Postgres to prevent lateral movement if the database is ever compromised.
   * Before sending, we must decrypt it locally in memory.
   */
  const decryptedConfig = { ...config };
  if (decryptedConfig?.access_token_encrypted) {
    // We dynamically require the crypto module here to avoid circular dependencies in some setups.
    const { decryptToken } = require('../../bsp/crypto');
    decryptedConfig.access_token_encrypted = decryptToken(decryptedConfig.access_token_encrypted);
  }

  /**
   * Note 15: Factory Pattern for External Providers
   * By using `getBSPProvider`, the pipeline never cares if it's talking to Meta, Gupshup, or Twilio.
   * The provider instance handles the HTTP specifics and normalizes the return values.
   */
  const provider = getBSPProvider(providerName);
  const sendResult = await provider.sendSessionMessage({
    tenantId,
    to: toPhone,
    content: { type: 'text', text },
    providerConfig: decryptedConfig || {} 
  });
  
  // Track message usage asynchronously
  try { await supabaseAdmin.rpc('increment_usage', { p_tenant_id: tenantId, p_messages_sent: 1 }); } catch (e) { console.error(e); }

  /**
   * Note 16: Audit Logging
   * The final step is saving the bot's response to the `messages` table. 
   * We log exactly which LLM model was used and the array of `chunkIds` that fueled the response.
   * This is critical for debugging hallucinations. If the bot says something wrong, we can 
   * check `retrieved_chunk_ids` to see exactly which document misled it.
   */
  const { error } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      direction: 'outbound',
      message_type: 'text',
      content: text,
      sender: 'bot',
      wa_message_id: sendResult.bspMessageId,
      llm_model_used: source === 'rag' ? (process.env.LLM_MODEL || 'gpt-4o-mini') : null,
      retrieved_chunk_ids: chunkIds || null
    });
    
  if (error) console.error('Error saving bot reply:', error);
}
