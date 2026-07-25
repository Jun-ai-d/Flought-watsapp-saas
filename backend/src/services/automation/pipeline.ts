import { supabaseAdmin } from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { decryptToken } from '../../bsp/crypto';
import { checkHumanIntent, triggerHandover } from './handover';
import { matchFAQ } from './faqMatcher';
import { executeFlow } from './flowMatcher';
import { retrieveRelevantChunks } from '../kb/retrieval';
import { generateRAGResponse } from '../llm/generator';
import { getBSPProvider } from '../../bsp/providerFactory';
import { ProviderConfig } from '../../bsp/BSPProvider';
import { appCache } from '../../lib/cache';
import {
  isVoiceReplyEligible,
  synthesizeVoiceNote,
  uploadVoiceNote,
  type VoiceReplySettings,
} from '../llm/tts';
import { fetchTenantTrialContext, shouldBlockBotReplies } from '../../lib/trialStatus';

// In-memory lock to prevent race conditions when a user sends rapid-fire messages.
// This ensures that concurrent webhooks for the same conversation are processed sequentially.
const conversationLocks = new Map<string, Promise<void>>();

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
  providerName: string,
  isNewSession: boolean = false,
  wasAudioInbound: boolean = false
) {
  // Concurrency Lock: Chain execution for the same conversation to prevent double-replies
  const previousLock = conversationLocks.get(conversationId);
  let releaseLock: () => void = () => {};
  const currentLock = new Promise<void>((resolve) => { releaseLock = resolve; });
  conversationLocks.set(conversationId, currentLock);

  if (previousLock) {
    console.log(`[Pipeline] Rapid-fire detected for ${conversationId}. Waiting for previous pipeline to finish...`);
    try { await previousLock; } catch (e) {}
  }

  console.log(`[Pipeline] Starting for conv ${conversationId}`);

  try {
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
     * Note 2.5: Trial expiry (Gate 1.25)
     * Block automated bot replies when trial is expired or capped, unless tenant has a paid subscription.
     */
    const trialCtx = await fetchTenantTrialContext(tenantId);
    if (shouldBlockBotReplies(trialCtx.tenant, trialCtx.subscription)) {
      console.log(`[Pipeline] Trial exhausted for tenant ${tenantId}. Skipping bot reply.`);
      return;
    }

    /**
     * Note 3: Quota Enforcement (Gate 1.5)
     * We atomically reserve a message slot. If the pipeline fails or hands over without sending 
     * an automated message, we refund it.
     */
    const { data: hasQuota, error: quotaError } = await supabaseAdmin.rpc('reserve_tenant_quota', {
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
     * Note 6: Context & Semantic Cache Fetching
     * We first fetch the history to inform the Agent Router.
     */
    const { data: history } = await supabaseAdmin
      .from('messages')
      .select('direction, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(6);
      
    // The LLM needs the history in chronological order (oldest to newest)
    const formattedHistory = (history || []).reverse().map(h => ({
      direction: h.direction as 'inbound' | 'outbound',
      content: h.content
    }));

    // Adaptive Agent Router
    const { routeMessageIntent } = await import('./agentRouter');
    const intent = await routeMessageIntent(messageText, formattedHistory);
    console.log(`[Pipeline] Router classified as: ${intent.categories.join(', ')} (Rewritten: ${intent.rewrittenQuery})`);

    // Semantic Cache Check (original-language rewrite preferred over translation)
    const { checkSemanticCache } = await import('../kb/semanticCache');
    const cacheQuery = intent.rewrittenQuery || messageText;
    const cachedResponse = await checkSemanticCache(tenantId, cacheQuery);
    if (cachedResponse) {
      console.log(`[Pipeline] Semantic Cache Hit! Saving LLM tokens.`);
      await sendBotReply(tenantId, conversationId, customerPhone, providerName, cachedResponse, 'rag', undefined, {
        wasAudioInbound,
        allowVoice: true,
      });
      return;
    }

    if (intent.categories.includes('actionable')) {
      // In Phase 2 this will trigger DB/Tool calling. For now we handover.
      await triggerHandover(tenantId, conversationId, 'action_required', messageText, 'Customer requested an actionable task.');
      return;
    }

    // Concurrent Data Fetching
    const isKnowledge = intent.categories.includes('knowledge');
    const searchString = intent.rewrittenQuery || messageText;
    const keywordSuffix = intent.normalizedKeywords?.length
      ? ' ' + intent.normalizedKeywords.join(' ')
      : '';
    const retrievalQuery = (searchString + keywordSuffix).trim();
    
    const [chunks, { data: tenant }] = await Promise.all([
      !isKnowledge ? Promise.resolve([]) : retrieveRelevantChunks(tenantId, retrievalQuery),
      supabaseAdmin.from('tenants').select('business_name, ai_settings').eq('id', tenantId).single()
    ]);

    interface AISettings {
      welcome_message_type?: 'fixed' | 'llm';
      fixed_welcome_message?: string;
      system_prompt?: string;
      voice_replies?: boolean;
      voice_max_chars?: number;
      [key: string]: unknown;
    }
    const aiSettings = tenant?.ai_settings as AISettings | undefined;
    
    // If the conversation is brand new (history is empty or only has the current inbound message),
    // and the tenant has selected a fixed greeting, we bypass RAG entirely.
    // Note: history contains the CURRENT message because it was inserted in processSingleMessage, 
    // so a "new" conversation has exactly 1 message in history.
    if (history && (history.length === 1 || isNewSession) && aiSettings?.welcome_message_type === 'fixed') {
      const fixedGreeting = aiSettings.fixed_welcome_message || 'Hi, how can we help you today?';
      console.log(`[Pipeline] New conversation. Using fixed greeting: "${fixedGreeting}"`);
      await sendBotReply(tenantId, conversationId, customerPhone, providerName, fixedGreeting, 'faq');
      return;
    }

    /**
     * Note 7: Generative LLM Execution
     * The context is gathered, so we invoke the language model.
     */
    let previousSummary: string | undefined;
    if (isNewSession) {
      const { data: contact } = await supabaseAdmin
        .from('contacts')
        .select('interaction_history')
        .eq('tenant_id', tenantId)
        .eq('phone_number', customerPhone)
        .single();
      
      if (contact && contact.interaction_history && contact.interaction_history.length > 0) {
        // Format the history array into a bulleted list for the AI
        previousSummary = contact.interaction_history
          .map((item: any, i: number) => `[${new Date(item.timestamp).toLocaleDateString()}] ${item.summary}`)
          .join('\n');
          
        console.log(`[Pipeline] Injected full interaction history (${contact.interaction_history.length} sessions).`);
      }
    }

    /**
     * Note 8: Generative LLM Execution
     * The context is gathered, so we invoke the language model.
     * Notice how we use optional chaining (\`?.\`) with a fallback for the business name.
     */
    const businessName = tenant?.business_name || 'this business';
    
    // formattedHistory was computed earlier for the router
    const systemPromptOverride = aiSettings?.system_prompt;

    if (isKnowledge && chunks.length === 0) {
      const noKbMsg = "I'm sorry, I don't have that information. Let me transfer you to a human agent.";
      await sendBotReply(tenantId, conversationId, customerPhone, providerName, noKbMsg, 'rag');
      await triggerHandover(tenantId, conversationId, 'low_confidence_generation', messageText, 'Empty KB / no retrieval hits');
      try { await supabaseAdmin.rpc('refund_tenant_quota', { p_tenant_id: tenantId }); } catch (e) {}
      return;
    }

    const llmResponse = await generateRAGResponse(messageText, chunks, businessName, formattedHistory, systemPromptOverride, previousSummary);

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
      try { await supabaseAdmin.rpc('refund_tenant_quota', { p_tenant_id: tenantId }); } catch(e){}
      return;
    }

    // If everything went perfectly, we dispatch the highly-confident AI response.
    console.log(`[Pipeline] LLM generated high confidence response.`);
    await sendBotReply(tenantId, conversationId, customerPhone, providerName, llmResponse.content, 'rag', chunks.map(c => c.id), {
      wasAudioInbound,
      aiSettings,
      allowVoice: true,
    });
    
    // Cache the highly confident RAG response
    if (intent.categories.includes('knowledge')) {
      const { setSemanticCache } = await import('../kb/semanticCache');
      await setSemanticCache(tenantId, cacheQuery, llmResponse.content);
    }
  } catch (error) {
    console.error(`[Pipeline] CRITICAL ERROR for conv ${conversationId}:`, error);
    try { await supabaseAdmin.rpc('refund_tenant_quota', { p_tenant_id: tenantId }); } catch(e){}
    // Fallback to human handover so the message is not lost silently
    try {
      await triggerHandover(tenantId, conversationId, 'pipeline_error', messageText, `System Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } catch (handoverError) {
      console.error(`[Pipeline] Failed to trigger fallback handover for conv ${conversationId}:`, handoverError);
    }
  } finally {
    // Release the lock for the next message in the queue
    releaseLock();
    // Clean up memory if this is the last lock in the chain
    if (conversationLocks.get(conversationId) === currentLock) {
      conversationLocks.delete(conversationId);
    }
  }
}


/**
 * Note 11: The Dispatcher Function
 * This helper isolates the complex logic of actually routing a message out to WhatsApp.
 * It handles caching, security decryption, WhatsApp policy checks, and database logging.
 */
export interface SendBotReplyOptions {
  wasAudioInbound?: boolean;
  aiSettings?: VoiceReplySettings;
  /** High-confidence RAG path only — enables optional voice-out. */
  allowVoice?: boolean;
}

export async function sendBotReply(
  tenantId: string, 
  conversationId: string, 
  toPhone: string, 
  providerName: string, 
  text: string,
  source: 'faq' | 'rag' | 'flow',
  chunkIds?: string[],
  options?: SendBotReplyOptions
) {
  /**
   * Note 12: In-Memory Caching
   * Fetching the BSP config for every single message from the database is incredibly slow.
   * We use `appCache` (an LRU memory cache) to store the configuration for 5 minutes (300s).
   * This drastically reduces database read IOPS under heavy load.
   */
  const cacheKey = `bsp_config_${tenantId}_${providerName}`;
  let config = appCache.get<ProviderConfig>(cacheKey);
  
  if (!config) {
    // Cache miss! We have to hit the database.
    const { data } = await supabaseAdmin
      .from('tenant_bsp_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('bsp_provider', providerName)
      .maybeSingle();
    
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
      try { await supabaseAdmin.rpc('refund_tenant_quota', { p_tenant_id: tenantId }); } catch(e){}
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
    // decryptToken is imported at the top
    decryptedConfig.access_token_encrypted = decryptToken(decryptedConfig.access_token_encrypted);
  }

  /**
   * Note 15: Factory Pattern for External Providers
   * By using `getBSPProvider`, the pipeline never cares if it's talking to Meta, Gupshup, or Twilio.
   * The provider instance handles the HTTP specifics and normalizes the return values.
   */
  const provider = getBSPProvider(providerName);

  let aiSettings = options?.aiSettings;
  if (!aiSettings && options?.allowVoice && options?.wasAudioInbound) {
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('ai_settings')
      .eq('id', tenantId)
      .single();
    aiSettings = tenant?.ai_settings as VoiceReplySettings | undefined;
  }

  const voiceEligible = isVoiceReplyEligible(
    text,
    source,
    options?.wasAudioInbound ?? false,
    options?.allowVoice ?? false,
    aiSettings
  );

  if (voiceEligible) {
    const maxChars = typeof aiSettings?.voice_max_chars === 'number'
      ? aiSettings.voice_max_chars
      : 400;
    const oggBuffer = await synthesizeVoiceNote(text, maxChars);
    if (oggBuffer) {
      const mediaUrl = await uploadVoiceNote(tenantId, oggBuffer);
      if (mediaUrl) {
        try {
          const voiceResult = await provider.sendSessionMessage({
            tenantId,
            to: toPhone,
            content: { type: 'audio', mediaUrl, voice: true },
            providerConfig: decryptedConfig || {},
          });

          const { error: voiceLogError } = await supabaseAdmin
            .from('messages')
            .insert({
              conversation_id: conversationId,
              tenant_id: tenantId,
              direction: 'outbound',
              message_type: 'audio',
              content: text,
              sender: 'bot',
              wa_message_id: voiceResult.bspMessageId,
              llm_model_used: source === 'rag' ? (process.env.LLM_MODEL || 'gpt-4o-mini') : null,
              retrieved_chunk_ids: chunkIds || null,
            });

          if (voiceLogError) console.error('Error saving voice bot reply:', voiceLogError);
          console.log(`[TTS] Sent voice reply for conv ${conversationId}`);
          return;
        } catch (voiceSendError) {
          console.error('[TTS] Meta voice send failed, falling back to text:', voiceSendError);
        }
      }
    } else {
      console.log('[TTS] Voice synthesis unavailable — falling back to text');
    }
  }

  const sendResult = await provider.sendSessionMessage({
    tenantId,
    to: toPhone,
    content: { type: 'text', text },
    providerConfig: decryptedConfig || {} 
  });
  
  // Note: p_messages_sent is no longer incremented here because it was atomically reserved 
  // via reserve_tenant_quota earlier in the pipeline.

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
