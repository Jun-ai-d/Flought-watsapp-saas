import { boss, isJobQueueReady } from '../jobQueue';
import { supabaseAdmin } from '../../lib/supabase';
import { getEmbedding } from './embeddings';
import { parsePlainText } from './parsers/txt';
import { parsePdf } from './parsers/pdf';
import { chunkDocument } from './chunker';

export type KbIngestJob = { tenantId: string; documentId: string };

const QUEUE = 'kb-ingest';
const STUCK_MS = 10 * 60 * 1000;
const ALLOWED_EXT = new Set(['txt', 'md', 'pdf']);
const MAX_BYTES = 10 * 1024 * 1024;
const EMBED_BATCH_SIZE = 20;

async function markFailed(documentId: string, tenantId: string, message: string) {
  console.error(`[kb-ingest] ${documentId}: ${message}`);
  await supabaseAdmin
    .from('knowledge_documents')
    .update({
      status: 'failed',
      error_message: message.slice(0, 1000),
      processed_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .eq('tenant_id', tenantId);
}

export async function processKbIngestJob(job: KbIngestJob): Promise<void> {
  const { tenantId, documentId } = job;

  const { data: doc, error } = await supabaseAdmin
    .from('knowledge_documents')
    .select('id, tenant_id, source_name, status, file_path')
    .eq('id', documentId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !doc) throw new Error('Document not found for tenant');
  if (doc.status === 'ready') return;
  if (!doc.file_path) throw new Error('Missing file_path');

  if (!doc.file_path.startsWith(`${tenantId}/`)) {
    await markFailed(documentId, tenantId, 'file_path tenant mismatch');
    return;
  }

  const { data: blob, error: dlErr } = await supabaseAdmin.storage
    .from('knowledge_base')
    .download(doc.file_path);

  if (dlErr || !blob) {
    await markFailed(documentId, tenantId, `Download failed: ${dlErr?.message ?? 'unknown error'}`);
    return;
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  if (buffer.length > MAX_BYTES) {
    await markFailed(documentId, tenantId, `File exceeds ${MAX_BYTES} bytes`);
    return;
  }

  const ext = (doc.source_name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    await markFailed(documentId, tenantId, `Unsupported type: .${ext}`);
    return;
  }

  let parsed;
  try {
    parsed = ext === 'pdf' ? await parsePdf(buffer) : parsePlainText(buffer);
  } catch (parseErr: unknown) {
    const message = parseErr instanceof Error ? parseErr.message : 'Parse failed';
    await markFailed(documentId, tenantId, message);
    return;
  }

  const pieces = chunkDocument(parsed.text, {
    sourceName: doc.source_name,
    documentId,
    tenantId,
  });

  if (pieces.length === 0) {
    await markFailed(documentId, tenantId, 'No chunks produced');
    return;
  }

  const { error: deleteErr } = await supabaseAdmin
    .from('knowledge_chunks')
    .delete()
    .eq('document_id', documentId)
    .eq('tenant_id', tenantId);

  if (deleteErr) {
    await markFailed(documentId, tenantId, `Chunk delete failed: ${deleteErr.message}`);
    return;
  }

  for (let i = 0; i < pieces.length; i += EMBED_BATCH_SIZE) {
    const batch = pieces.slice(i, i + EMBED_BATCH_SIZE);
    const embeddings = await Promise.all(batch.map((piece) => getEmbedding(piece.content)));

    for (let j = 0; j < batch.length; j++) {
      const piece = batch[j];
      const embedding = embeddings[j];
      const { error: insErr } = await supabaseAdmin.from('knowledge_chunks').insert({
        document_id: documentId,
        tenant_id: tenantId,
        content: piece.content,
        context_window: piece.context_window,
        embedding: `[${embedding.join(',')}]`,
        metadata: piece.metadata,
      });

      if (insErr) {
        await markFailed(documentId, tenantId, `Chunk insert failed: ${insErr.message}`);
        return;
      }
    }
  }

  await supabaseAdmin
    .from('knowledge_documents')
    .update({
      status: 'ready',
      error_message: null,
      chunk_count: pieces.length,
      processed_at: new Date().toISOString(),
    })
    .eq('id', documentId)
    .eq('tenant_id', tenantId);
}

export async function enqueueKbIngest(tenantId: string, documentId: string) {
  await boss.send(QUEUE, { tenantId, documentId }, { retryLimit: 3 });
}

async function enqueueStuckProcessingDocuments() {
  const cutoff = new Date(Date.now() - STUCK_MS).toISOString();
  const { data } = await supabaseAdmin
    .from('knowledge_documents')
    .select('id, tenant_id')
    .eq('status', 'processing')
    .not('file_path', 'is', null)
    .lt('uploaded_at', cutoff)
    .limit(50);

  for (const row of data || []) {
    await enqueueKbIngest(row.tenant_id, row.id);
  }
}

export function getKbIngestHealth() {
  return { jobQueueReady: isJobQueueReady(), queue: QUEUE };
}

export async function initKbIngestWorker() {
  await boss.createQueue(QUEUE);

  await boss.work(QUEUE, async (job: unknown) => {
    const payload = job as { data?: KbIngestJob } | Array<{ data: KbIngestJob }>;
    const data = (Array.isArray(payload) ? payload[0].data : payload.data) as KbIngestJob;
    console.log(`[kb-ingest] Processing document ${data.documentId} tenant ${data.tenantId}`);

    try {
      await processKbIngestJob(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown ingest error';
      await markFailed(data.documentId, data.tenantId, message);
      throw err;
    }
  });

  await enqueueStuckProcessingDocuments();
  await boss.schedule('kb-retry-stuck', '*/15 * * * *');
  await boss.work('kb-retry-stuck', async () => {
    await enqueueStuckProcessingDocuments();
  });

  console.log('[kb-ingest] Worker ready');
}
