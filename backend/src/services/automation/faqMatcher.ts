import { supabaseAdmin } from '../../lib/supabase';

export interface FAQMatchResult {
  matched: boolean;
  answer?: string;
  faqId?: string;
}

export async function matchFAQ(tenantId: string, query: string): Promise<FAQMatchResult> {
  // Use Postgres RPC for faster, indexed search across arrays
  const { data, error } = await supabaseAdmin.rpc('match_faq', { 
    p_tenant_id: tenantId, 
    p_query: query 
  });

  if (error || !data || data.length === 0) return { matched: false };

  // Found a match
  const match = data[0];
  
  // Fire-and-forget analytics
  supabaseAdmin.rpc('increment_faq_match', { faq_id: match.faq_id }).then(({error}) => { 
    if(error) console.error('FAQ analytics error:', error); 
  });
  
  return { matched: true, answer: match.answer, faqId: match.faq_id };
}
