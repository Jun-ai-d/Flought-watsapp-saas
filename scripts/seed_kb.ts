import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { getEmbedding } from '../backend/src/services/kb/embeddings';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: configs } = await supabase.from('tenant_bsp_config').select('tenant_id').limit(1);
  if (!configs || configs.length === 0) {
    console.error('No tenant found.');
    return;
  }
  const tenantId = configs[0].tenant_id;

  // 1. Seed FAQ
  console.log('Seeding FAQ...');
  await supabase.from('faqs').insert({
    tenant_id: tenantId,
    question: 'What are your working hours?',
    answer: 'We are open from 9 AM to 5 PM, Monday to Friday.',
    keywords: ['hours', 'working', 'open', 'timing']
  });

  // 2. Seed Knowledge Base Document & Chunks
  console.log('Seeding KB Document...');
  const { data: doc } = await supabase.from('knowledge_documents').insert({
    tenant_id: tenantId,
    source_name: 'Refund Policy v1.pdf',
    status: 'ready'
  }).select('id').single();

  const docId = doc?.id;

  console.log('Generating embeddings for KB chunks...');
  const chunks = [
    'Flought offers a 30-day money-back guarantee for all new customers. If you are not satisfied, you can cancel within 30 days for a full refund.',
    'To request a refund, please send an email to billing@flought.com with your tenant ID and the reason for cancellation. Refunds take 5-7 business days to process.',
    'Overage charges are strictly non-refundable since they represent actual LLM and WhatsApp API costs incurred during your usage.'
  ];

  for (const content of chunks) {
    const embedding = await getEmbedding(content);
    
    // Supabase pgvector accepts arrays formatted as string `[x,y,z]`
    await supabase.from('knowledge_chunks').insert({
      tenant_id: tenantId,
      document_id: docId,
      content: content,
      embedding: `[${embedding.join(',')}]`
    });
  }

  console.log('✅ KB Seeded successfully!');
}

main().catch(console.error);
