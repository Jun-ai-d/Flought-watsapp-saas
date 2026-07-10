import { supabaseAdmin } from '../../lib/supabase';
import OpenAI from 'openai';
const openai = new OpenAI();

/**
 * Auto-FAQ Miner (Self-Learning RAG)
 * 
 * Runs nightly via pg-boss to analyze recent RAG queries.
 * Identifies repeated questions and automatically generates canonical FAQs,
 * bypassing expensive RAG pipelines for future identical questions.
 */
export async function runAutoFaqMiner() {
  console.log('[Auto-FAQ] Starting nightly RAG mining...');
  
  try {
    // 1. Fetch active tenants
    const { data: tenants } = await supabaseAdmin.from('tenants').select('id, business_name');
    if (!tenants) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    for (const tenant of tenants) {
      // 2. Fetch all inbound user queries for this tenant from the last 7 days
      // We only care about inbound messages that were sent to the bot.
      const { data: recentMessages } = await supabaseAdmin
        .from('messages')
        .select('content')
        .eq('tenant_id', tenant.id)
        .eq('direction', 'inbound')
        .gte('created_at', sevenDaysAgo.toISOString());

      if (!recentMessages || recentMessages.length < 20) {
        // Not enough volume to find meaningful patterns
        continue;
      }

      // 3. Use LLM to extract common questions
      const messagesText = recentMessages.map(m => m.content).join('\n');
      
      const systemPrompt = `You are a data analyst for ${tenant.business_name}.
Your job is to identify frequently asked questions from the provided chat logs.
Only extract a question if it appears to be asked at least 3-5 times in different ways.
For each common question found, write a clear, generic version of the Question, and leave the Answer blank.

Output JSON format:
{
  "common_questions": [
    { "question": "What is your refund policy?", "frequency_score": 5 }
  ]
}`;

      const extractionResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Chat Logs:\n${messagesText}` }
        ],
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(extractionResponse.choices[0].message.content || '{}');
      const questions = result.common_questions || [];

      for (const item of questions) {
        if (item.frequency_score >= 3) {
          console.log(`[Auto-FAQ] Discovered high-frequency question for ${tenant.id}: "${item.question}"`);
          
          // 4. Check if we already have a similar FAQ
          const { data: existingFaqs } = await supabaseAdmin
            .from('faqs')
            .select('question')
            .eq('tenant_id', tenant.id);
            
          const isDuplicate = existingFaqs?.some(f => 
            f.question.toLowerCase().includes(item.question.toLowerCase())
          );

          if (!isDuplicate) {
            // 5. Generate canonical answer using RAG
            // For a production app, we would query the existing RAG pipeline here 
            // to generate the perfect answer based on the knowledge chunks.
            const { retrieveRelevantChunks } = require('./retrieval');
            const { generateRAGResponse } = require('../llm/generator');
            
            const chunks = await retrieveRelevantChunks(tenant.id, item.question);
            if (chunks && chunks.length > 0) {
              const ragResponse = await generateRAGResponse(item.question, chunks, tenant.business_name, [], undefined, undefined);
              
              if (ragResponse.confidence === 'high') {
                // 6. Insert the newly learned FAQ
                await supabaseAdmin.from('faqs').insert({
                  tenant_id: tenant.id,
                  question: item.question,
                  answer: ragResponse.content,
                  is_active: true,
                  status: 'draft'
                });
                console.log(`[Auto-FAQ] Successfully added learned FAQ: "${item.question}"`);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[Auto-FAQ] Error running miner:', error);
  }
}
