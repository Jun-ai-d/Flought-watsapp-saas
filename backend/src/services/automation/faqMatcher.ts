import { supabaseAdmin } from '../../lib/supabase';

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

  const normalizedQuery = query.toLowerCase();

  for (const faq of faqs) {
    const keywords: string[] = faq.keywords || [];
    const isMatch = keywords.some(kw => kw.trim() !== '' && normalizedQuery.includes(kw.toLowerCase()));
    
      if (isMatch) {
      // Increment match count asynchronously
      supabaseAdmin.rpc('increment_faq_match', { faq_id: faq.id }).then(({ error }) => {
        if (error) console.error('RPC Error:', error);
      });
      return { matched: true, answer: faq.answer, faqId: faq.id };
    }
  }

  return { matched: false };
}
