import { supabaseAdmin } from '../../lib/supabase';
import { checkHumanIntent, triggerHandover } from './handover';
import { matchFAQ } from './faqMatcher';
import { executeFlow } from './flowMatcher';
import { retrieveRelevantChunks } from '../kb/retrieval';
import { generateRAGResponse } from '../llm/generator';
import { getBSPProvider } from '../../bsp/providerFactory';
import { appCache } from '../../lib/cache';

export async function processAutomationPipeline(
  tenantId: string, 
  conversationId: string, 
  messageText: string,
  customerPhone: string,
  providerName: string
) {
  console.log(`[Pipeline] Starting for conv ${conversationId}`);

  // 1. Handover Check First
  if (checkHumanIntent(messageText)) {
    await triggerHandover(tenantId, conversationId, 'explicit_request', messageText);
    return;
  }

  // 1.5. Quota Check
  const { data: hasQuota, error: quotaError } = await supabaseAdmin.rpc('check_tenant_quota', {
    p_tenant_id: tenantId
  });
  
  if (!quotaError && hasQuota === false) {
    console.log(`[Pipeline] Quota exceeded for tenant ${tenantId}. Aborting LLM and forcing handover.`);
    await triggerHandover(tenantId, conversationId, 'billing_quota_exceeded', messageText, '', true);
    return;
  }

  // 1.75. Visual Bot Flow Check
  const flowResult = await executeFlow(tenantId, messageText);
  if (flowResult.matched) {
    if (flowResult.replyText) {
      console.log(`[Pipeline] Bot Flow Matched! Triggering visual flow response.`);
      await sendBotReply(tenantId, conversationId, customerPhone, providerName, flowResult.replyText, 'flow');
    } else {
      console.log(`[Pipeline] Bot Flow Matched but no response node connected.`);
    }
    return;
  }

  // 2. FAQ Match
  const faqResult = await matchFAQ(tenantId, messageText);
  if (faqResult.matched && faqResult.answer) {
    console.log(`[Pipeline] FAQ Matched: ${faqResult.faqId}`);
    await sendBotReply(tenantId, conversationId, customerPhone, providerName, faqResult.answer, 'faq');
    return;
  }

  // 3. RAG Retrieval & Tenant Lookup & History Lookup (Concurrent)
  const [chunks, { data: tenant }, { data: history }] = await Promise.all([
    retrieveRelevantChunks(tenantId, messageText),
    supabaseAdmin.from('tenants').select('business_name').eq('id', tenantId).single(),
    supabaseAdmin
      .from('messages')
      .select('direction, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(6)
  ]);

  if (chunks.length === 0) {
    console.log(`[Pipeline] No RAG chunks found.`);
    
    const formattedHistoryText = (history || []).reverse().map(h => 
      h.direction === 'inbound' ? `Customer: ${h.content}` : `Bot: ${h.content}`
    ).join('\n');

    // Trigger handover per TRD §3.2 (low retrieval confidence / no FAQ + no RAG)
    await triggerHandover(tenantId, conversationId, 'low_confidence_retrieval', messageText, formattedHistoryText);
    return;
  }

  // 4. LLM Generation
  const businessName = tenant?.business_name || 'this business';
  
  // Format history from oldest to newest for the prompt
  const formattedHistory = (history || []).reverse().map(h => ({
    direction: h.direction as 'inbound' | 'outbound',
    content: h.content
  }));

  const llmResponse = await generateRAGResponse(messageText, chunks, businessName, formattedHistory);

  // Track LLM Usage
  try { await supabaseAdmin.rpc('increment_usage', { p_tenant_id: tenantId, p_llm_calls: 1 }); } catch (e) { console.error(e); }

  if (llmResponse.confidence !== 'high') {
    console.log(`[Pipeline] LLM returned low confidence.`);
    // Still send the apology message if it generated one, but also trigger handover
    await sendBotReply(tenantId, conversationId, customerPhone, providerName, llmResponse.content, 'rag', chunks.map(c => c.id));
    
    const formattedHistoryText = formattedHistory.map(h => 
      h.direction === 'inbound' ? `Customer: ${h.content}` : `Bot: ${h.content}`
    ).join('\n');
    
    await triggerHandover(tenantId, conversationId, 'low_confidence_generation', messageText, formattedHistoryText);
    return;
  }

  console.log(`[Pipeline] LLM generated high confidence response.`);
  await sendBotReply(tenantId, conversationId, customerPhone, providerName, llmResponse.content, 'rag', chunks.map(c => c.id));
}


async function sendBotReply(
  tenantId: string, 
  conversationId: string, 
  toPhone: string, 
  providerName: string, 
  text: string,
  source: 'faq' | 'rag' | 'flow',
  chunkIds?: string[]
) {
  // 1. Load provider config for this tenant (from Cache)
  const cacheKey = `bsp_config_${tenantId}_${providerName}`;
  let config = appCache.get<any>(cacheKey);
  
  if (!config) {
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

  // 1.5 Enforce 24hr WhatsApp policy for bot replies
  const { data: latestInbound } = await supabaseAdmin
    .from('messages')
    .select('created_at')
    .eq('conversation_id', conversationId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (latestInbound) {
    const hoursSinceLastMessage = (Date.now() - new Date(latestInbound.created_at).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastMessage > 24) {
      console.warn(`[Pipeline] Aborting bot reply. Customer hasn't messaged in >24 hours (strict WhatsApp policy).`);
      return;
    }
  }

  // 2. Dispatch to BSP
  const provider = getBSPProvider(providerName);
  const sendResult = await provider.sendSessionMessage({
    tenantId,
    to: toPhone,
    content: { type: 'text', text },
    providerConfig: config || {} 
  });
  
  // Track message usage
  try { await supabaseAdmin.rpc('increment_usage', { p_tenant_id: tenantId, p_messages_sent: 1 }); } catch (e) { console.error(e); }

  // 3. Save outbound message to database
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
