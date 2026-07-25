import { boss } from '../jobQueue';
import { supabaseAdmin } from '../../lib/supabase';

const QUEUE = 'faq-revalidation';

/**
 * Marks published FAQs for human review when they underperform.
 */
export async function runFaqRevalidation() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  const { data: staleFaqs } = await supabaseAdmin
    .from('faqs')
    .select('id, tenant_id, question')
    .eq('status', 'published')
    .eq('needs_review', false)
    .lt('match_count', 2)
    .lt('created_at', cutoff.toISOString());

  for (const faq of staleFaqs || []) {
    await supabaseAdmin
      .from('faqs')
      .update({ needs_review: true })
      .eq('id', faq.id)
      .eq('tenant_id', faq.tenant_id);

    console.log(`[FAQ Revalidation] Flagged for review: ${faq.question.slice(0, 60)}`);
  }
}

export async function initFaqRevalidationWorker() {
  await boss.createQueue(QUEUE);
  await boss.schedule(QUEUE, '0 4 * * 0');

  await boss.work(QUEUE, async () => {
    await runFaqRevalidation();
  });

  console.log('[FAQ Revalidation] Worker scheduled (weekly Sunday 04:00 UTC)');
}
