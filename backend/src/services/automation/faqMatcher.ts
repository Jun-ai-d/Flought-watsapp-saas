import { supabaseAdmin } from '../../lib/supabase';
import OpenAI from 'openai';

const openai = new OpenAI();

export interface FAQMatchResult {
  matched: boolean;
  answer?: string;
  faqId?: string;
}

export async function matchFAQ(tenantId: string, query: string): Promise<FAQMatchResult> {
  const { data: faqs, error } = await supabaseAdmin
    .from('faqs')
    .select('*')
    .eq('tenant_id', tenantId);

  if (error || !faqs || faqs.length === 0) {
    return { matched: false };
  }

  // Use LLM to pick the best FAQ quickly
  const prompt = `You are an intent matcher. Below is a list of FAQs with IDs and Questions.
User Query: "${query}"

FAQs:
${faqs.map(f => `[ID: ${f.id}] Q: ${f.question} | KWs: ${(f.keywords||[]).join(',')}`).join('\n')}

If the user query clearly matches one of these FAQs, output the ID. If none match, output exactly "NO_MATCH".
Output ONLY the ID or "NO_MATCH".`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.LLM_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      temperature: 0.1
    });

    const resultId = completion.choices[0]?.message?.content?.trim();
    if (resultId && resultId !== 'NO_MATCH') {
      const match = faqs.find(f => f.id === resultId);
      if (match) {
        // Increment match count asynchronously
        supabaseAdmin.rpc('increment_faq_match', { faq_id: match.id }).then(({ error }) => {
          if (error) console.error('RPC Error:', error);
        });
        return { matched: true, answer: match.answer, faqId: match.id };
      }
    }
  } catch (error) {
    console.error('Error matching FAQ:', error);
  }

  return { matched: false };
}
