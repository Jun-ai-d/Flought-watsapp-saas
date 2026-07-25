import { boss } from '../jobQueue';
import { supabaseAdmin } from '../../lib/supabase';
import OpenAI from 'openai';
import { retrieveRelevantChunks } from './retrieval';
import { generateRAGResponse } from '../llm/generator';

const openai = new OpenAI();
const QUEUE = 'auto-faq-miner';
const STUCK_MS = 10 * 60 * 1000;

/**
 * Nightly FAQ miner — creates draft suggestions only (never auto-publishes).
 */
export async function runAutoFaqMiner() {
  console.log('[Auto-FAQ] Starting nightly RAG mining...');

  const { data: tenants } = await supabaseAdmin.from('tenants').select('id, business_name');
  if (!tenants) return;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  for (const tenant of tenants) {
    const { data: recentMessages } = await supabaseAdmin
      .from('messages')
      .select('content')
      .eq('tenant_id', tenant.id)
      .eq('direction', 'inbound')
      .gte('created_at', sevenDaysAgo.toISOString());

    if (!recentMessages || recentMessages.length < 20) continue;

    const messagesText = recentMessages.map((m) => m.content).join('\n');
    const systemPrompt = `You are a data analyst for ${tenant.business_name}.
Identify frequently asked questions from chat logs.
Only extract a question if it appears at least 3-5 times in different ways.

Output JSON:
{ "common_questions": [ { "question": "...", "frequency_score": 5 } ] }`;

    const extractionResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Chat Logs:\n${messagesText}` },
      ],
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(extractionResponse.choices[0].message.content || '{}');
    const questions = result.common_questions || [];

    for (const item of questions) {
      if (item.frequency_score < 3) continue;

      const { data: existingFaqs } = await supabaseAdmin
        .from('faqs')
        .select('question')
        .eq('tenant_id', tenant.id);

      const isDuplicate = existingFaqs?.some((f) =>
        f.question.toLowerCase().includes(item.question.toLowerCase())
      );
      if (isDuplicate) continue;

      const chunks = await retrieveRelevantChunks(tenant.id, item.question);
      if (!chunks || chunks.length === 0) continue;

      const ragResponse = await generateRAGResponse(
        item.question,
        chunks,
        tenant.business_name,
        [],
        undefined,
        undefined
      );

      if (ragResponse.confidence !== 'high') continue;

      await supabaseAdmin.from('faqs').insert({
        tenant_id: tenant.id,
        question: item.question,
        answer: ragResponse.content,
        status: 'draft',
        source: 'auto_miner',
        needs_review: true,
        keywords: [],
      });

      console.log(`[Auto-FAQ] Draft suggestion: "${item.question}"`);
    }
  }
}

export async function initAutoFaqMinerWorker() {
  await boss.createQueue(QUEUE);
  await boss.schedule(QUEUE, '0 3 * * *');

  await boss.work(QUEUE, async () => {
    await runAutoFaqMiner();
  });

  console.log('[Auto-FAQ] Worker scheduled (nightly 03:00 UTC)');
}
