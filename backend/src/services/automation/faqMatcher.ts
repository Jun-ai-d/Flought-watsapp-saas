import { supabaseAdmin } from '../../lib/supabase';

export interface FAQMatchResult {
  matched: boolean;
  answer?: string;
  faqId?: string;
}

export async function matchFAQ(tenantId: string, query: string): Promise<FAQMatchResult> {
  // Fetch FAQs for the tenant
  const { data: faqs, error } = await supabaseAdmin
    .from('faqs')
    .select('id, answer, keywords')
    .eq('tenant_id', tenantId);

  if (error || !faqs || faqs.length === 0) return { matched: false };

  const lowerQuery = query.toLowerCase();
  
  for (const faq of faqs) {
    if (!faq.keywords || !Array.isArray(faq.keywords)) continue;
    
    for (const kw of faq.keywords) {
      const lowerKw = kw.trim().toLowerCase();
      if (lowerKw && lowerQuery.includes(lowerKw)) {
        // Fire-and-forget analytics
        supabaseAdmin.rpc('increment_faq_match', { faq_id: faq.id }).then(({error}) => { if(error) console.error(error); });
        return { matched: true, answer: faq.answer, faqId: faq.id };
      }
    }
  }

  return { matched: false };
}
