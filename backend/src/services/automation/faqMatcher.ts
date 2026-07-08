import { supabaseAdmin } from '../../lib/supabase';

export interface FAQMatchResult {
  matched: boolean;
  answer?: string;
  faqId?: string;
}

export async function matchFAQ(tenantId: string, query: string): Promise<FAQMatchResult> {
  const { data, error } = await supabaseAdmin.rpc('match_faq', {
    p_tenant_id: tenantId, p_query: query
  });
  if (error || !data || data.length === 0) return { matched: false };
  // Fire-and-forget analytics
  supabaseAdmin.rpc('increment_faq_match', { faq_id: data[0].id }).then(({error}) => { if(error) console.error(error); });
  return { matched: true, answer: data[0].answer, faqId: data[0].id };
}
