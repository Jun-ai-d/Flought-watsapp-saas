import { supabaseAdmin } from '../../lib/supabase';
import { checkHumanIntent, triggerHandover } from './handover';
import { matchFAQ } from './faqMatcher';
import { retrieveRelevantChunks } from '../kb/retrieval';
import { generateRAGResponse } from '../llm/generator';
import { getBSPProvider } from '../../bsp/providerFactory';

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
    await triggerHandover(tenantId, conversationId, 'explicit_request');
    return;
  }

  // 2. FAQ Match
  const faqResult = await matchFAQ(tenantId, messageText);
  if (faqResult.matched && faqResult.answer) {
    console.log(`[Pipeline] FAQ Matched: ${faqResult.faqId}`);
    await sendBotReply(tenantId, conversationId, customerPhone, providerName, faqResult.answer, 'faq');
    return;
  }

  // 3. RAG Retrieval
  const chunks = await retrieveRelevantChunks(tenantId, messageText);
  if (chunks.length === 0) {
    console.log(`[Pipeline] No RAG chunks found.`);
    // Trigger handover per TRD §3.2 (low retrieval confidence / no FAQ + no RAG)
    await triggerHandover(tenantId, conversationId, 'low_confidence_retrieval');
    return;
  }

  // 4. LLM Generation
  const { data: tenant } = await supabaseAdmin.from('tenants').select('business_name').eq('id', tenantId).single();
  const businessName = tenant?.business_name || 'this business';

  const llmResponse = await generateRAGResponse(messageText, chunks, businessName);

  if (llmResponse.confidence !== 'high') {
    console.log(`[Pipeline] LLM returned low confidence.`);
    // Still send the apology message if it generated one, but also trigger handover
    await sendBotReply(tenantId, conversationId, customerPhone, providerName, llmResponse.content, 'rag', chunks.map(c => c.id));
    await triggerHandover(tenantId, conversationId, 'low_confidence_generation');
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
  source: 'faq' | 'rag',
  chunkIds?: string[]
) {
  // 1. Load provider config for this tenant
  const { data: config } = await supabaseAdmin
    .from('tenant_bsp_config')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('bsp_provider', providerName)
    .single();

  // 2. Dispatch to BSP
  const provider = getBSPProvider(providerName);
  const sendResult = await provider.sendSessionMessage({
    tenantId,
    to: toPhone,
    content: { type: 'text', text },
    providerConfig: config || {} 
  });

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
