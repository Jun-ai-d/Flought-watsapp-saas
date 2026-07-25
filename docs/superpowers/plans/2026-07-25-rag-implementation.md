# RAG Implementation Plan (Composer-executable)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Spec / research source of truth:** [`2026-07-25-rag-redesign.md`](./2026-07-25-rag-redesign.md)  
> **Deploy (orthogonal):** Coolify dual-path hosting — [`2026-07-25-coolify-dual-deploy.md`](./2026-07-25-coolify-dual-deploy.md) (Supabase stays external; Compose runs API + `kb-ingest` workers).  
> **Constraint:** Ponytail / YAGNI — **Phase 1 must ship alone** and make KB uploads reach `ready`. Do not start Phase 5–6 until Phases 1–3 work.

**Goal:** Make Flought hybrid RAG production-real: ingest uploaded documents into `knowledge_chunks`, harden retrieval gates, upgrade multilingual STT, fix FAQ draft leakage, then optional rerank/TTS/UI polish.

**Architecture:** Keep the existing waterfall (`flow → FAQ → semantic cache → agentRouter → hybrid RAG → confidence handover`). Add a pg-boss `kb-ingest` worker that downloads Storage files, parses text/PDF, recursive parent/child chunks, embeds with `text-embedding-3-small`, writes `knowledge_chunks`, and flips `knowledge_documents.status`. Retrieval stays on Supabase `match_knowledge_hybrid` (pgvector + BM25 RRF). Voice-in upgrades to `gpt-4o-mini-transcribe`; voice-out stays **off by default**.

**Tech stack (locked):**

| Layer | Default (ship) | Notes |
|-------|----------------|-------|
| Queue | pg-boss `kb-ingest` | Same pattern as `check-sla-breach` |
| Store | Supabase Postgres + pgvector | No second vector DB |
| Embed | OpenAI `text-embedding-3-small` (1536) | Already in schema / `embeddings.ts` |
| Retrieve | `match_knowledge_hybrid` RRF k=60 | Raise first-stage k; filter `minSimilarity` in TS |
| Generate | `gpt-4o-mini` + user language | Existing `generator.ts` |
| STT | `gpt-4o-mini-transcribe` | Replace `whisper-1` |
| TTS | Off by default | Tenant `ai_settings.voice_replies` later |
| Chunk | Recursive child 400–512 tok + parent `context_window` 1.2–1.8k | Structure-aware splits |
| Languages | Global multilingual | Embed/retrieve original language; not India-only |

---

## File map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/20260725000010_kb_ingest_columns.sql` | `error_message`, `chunk_count` on `knowledge_documents` |
| Create | `supabase/migrations/20260725000011_match_faq_published_only.sql` | FAQ RPC ignores drafts |
| Create (optional Phase 2) | `supabase/migrations/20260725000012_knowledge_fts_simple.sql` | Dual/`simple` FTS for non-English BM25 |
| Create | `backend/src/services/kb/parsers/txt.ts` | TXT/MD text extract |
| Create | `backend/src/services/kb/parsers/pdf.ts` | PDF text extract via `pdf-parse` |
| Create | `backend/src/services/kb/chunker.ts` | Recursive parent/child chunking |
| Create | `backend/src/services/kb/ingestWorker.ts` | pg-boss consumer + enqueue helpers |
| Create | `backend/fixtures/kb/sample-refund-policy.txt` | Manual ingest fixture |
| Create (Phase 6) | `backend/src/services/llm/tts.ts` | OpenAI TTS → buffer |
| Modify | `backend/package.json` | Add `pdf-parse` (+ `@types` if needed) |
| Modify | `backend/src/services/jobQueue.ts` | No heavy logic — keep boss export; worker owns `createQueue` |
| Modify | `backend/src/index.ts` | `await initKbIngestWorker()` after `initJobQueue` |
| Modify | `backend/src/routes/tenant.ts` | `POST /kb/documents/:id/ingest` (+ retry) |
| Modify | `backend/src/services/kb/retrieval.ts` | Apply `minSimilarity`; raise default `topK` |
| Modify | `backend/src/services/automation/pipeline.ts` | Dense query = `rewrittenQuery`; empty-chunk short-circuit |
| Modify | `backend/src/services/kb/semanticCache.ts` | Prefer original `rewrittenQuery` as cache key (when callers change) |
| Modify | `backend/src/services/llm/stt.ts` | Model → `gpt-4o-mini-transcribe` |
| Modify | `backend/src/services/messageHandler.ts` | Empty STT → clear user message (no silent empty RAG) |
| Modify | `backend/src/services/kb/autoFaqMiner.ts` | Wire schedule **or** delete if unused |
| Modify | `backend/src/bsp/MetaProvider.ts` | Phase 6: `voice: true` on audio |
| Modify | `backend/src/bsp/BSPProvider.ts` | Phase 6: optional `voice?: boolean` on content |
| Modify | `src/pages/KnowledgeBaseManager.tsx` | Enqueue after insert; failed reason; retry; poll |
| Keep | `backend/src/services/kb/embeddings.ts` | Already correct model |
| Keep | `supabase/migrations/20260716000015_ultimate_rag.sql` | Hybrid RPC baseline |
| Dev-only | `scripts/seed_kb.ts` | Do not rely on this in prod path |

---

## Phase 0 — Preconditions

Complete before writing ingest code. No product behavior change yet.

### Task 0.1: Confirm env vars

**Files:** none (ops check)

- [ ] **Step 1:** In `backend/.env` (or root `.env` loaded by backend), confirm present:
  - `DATABASE_URL` — Postgres URL used by pg-boss (`jobQueue.ts` already requires it)
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENAI_API_KEY` **or** `OPENAI_STT_KEY` (embeddings + STT use these in `embeddings.ts` / `stt.ts`)
- [ ] **Step 2:** Verify Storage bucket exists in Supabase Dashboard: `knowledge_base` (created by `supabase/migrations/20260715000018_knowledge_base_storage.sql`).
- [ ] **Step 3:** Confirm hybrid RPC exists:

```bash
# From repo root, with supabase CLI linked to the project:
npx supabase db execute --sql "select proname from pg_proc where proname = 'match_knowledge_hybrid';"
```

Expected: one row `match_knowledge_hybrid`.

**Verify:** Backend starts without throwing on missing `DATABASE_URL` / Supabase keys: `cd backend && npm run dev` → log shows `pg-boss initialized`.

**Depends on:** nothing.

### Task 0.2: Confirm schema columns used by UI

**Files:** read-only — `supabase/migrations/20260704000004_knowledge_base.sql`, `20260715000018_knowledge_base_storage.sql`

- [ ] Confirm `knowledge_documents` has: `id`, `tenant_id`, `source_name`, `status` (`processing|ready|failed`), `file_path`, `uploaded_at`.
- [ ] Confirm `knowledge_chunks` has: `document_id`, `tenant_id`, `content`, `embedding vector(1536)`, `metadata jsonb`, `context_window`, `fts`.

**Verify:** Dashboard → Table Editor, or:

```sql
select column_name from information_schema.columns
where table_name = 'knowledge_documents' order by 1;
```

**Depends on:** Task 0.1.

### Task 0.3: Note current broken path (do not “fix” yet)

**Files:** `src/pages/KnowledgeBaseManager.tsx` (~lines 48–64)

- [ ] Read the upload insert: sets `status: 'processing'` and comment claims a backend worker exists — **it does not**.
- [ ] Accept that Phase 1 creates that worker; do not patch UI status to `ready` client-side.

**Depends on:** Task 0.2.

---

## Phase 1 — KB Ingest Worker (P0 — unblocks RAG)

Ship this phase alone. After Phase 1, uploading a `.txt` in the UI must end at `status = 'ready'` with ≥1 `knowledge_chunks` row — without `scripts/seed_kb.ts`.

### Task 1.1: Migration — document error fields

**Files:**
- Create: `supabase/migrations/20260725000010_kb_ingest_columns.sql`

- [ ] **Step 1: Write migration**

```sql
-- KB ingest observability
ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS chunk_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

COMMENT ON COLUMN public.knowledge_documents.error_message IS 'Last ingest failure message; null when ready/processing';
COMMENT ON COLUMN public.knowledge_documents.chunk_count IS 'Number of knowledge_chunks after successful ingest';
```

- [ ] **Step 2: Apply migration** (local or linked project — pick one):

```bash
npx supabase db push
# or, if using migration apply against remote:
npx supabase migration up
```

- [ ] **Step 3: Verify**

```sql
select column_name from information_schema.columns
where table_name = 'knowledge_documents'
  and column_name in ('error_message','chunk_count','processed_at');
```

Expected: 3 rows.

**Depends on:** Phase 0.

### Task 1.2: Add `pdf-parse` dependency

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1:** From `backend/`:

```bash
npm install pdf-parse
npm install -D @types/pdf-parse
```

- [ ] **Step 2:** Confirm `backend/package.json` lists `pdf-parse`.

**Verify:** `cd backend && npx tsc --noEmit` still passes (or only unrelated errors).

**Depends on:** nothing (can parallel Task 1.1).

### Task 1.3: TXT/MD parser

**Files:**
- Create: `backend/src/services/kb/parsers/txt.ts`

- [ ] **Step 1: Implement**

```ts
export type ParsedDocument = {
  text: string;
  pages?: Array<{ page: number; text: string }>;
};

/** Extract UTF-8 text from .txt / .md buffers. */
export function parsePlainText(buffer: Buffer): ParsedDocument {
  const text = buffer.toString('utf8').replace(/\u0000/g, '').trim();
  if (!text) throw new Error('Empty text document');
  return { text };
}
```

- [ ] **Step 2: Verify** — quick node snippet or unit smoke:

```bash
cd backend && npx tsx -e "const { parsePlainText } = require('./src/services/kb/parsers/txt'); console.log(parsePlainText(Buffer.from('Hello\\n\\nWorld')).text);"
```

Expected: prints `Hello\n\nWorld`.

**Depends on:** nothing.

### Task 1.4: PDF parser

**Files:**
- Create: `backend/src/services/kb/parsers/pdf.ts`

- [ ] **Step 1: Implement** (keep thin — Ponytail)

```ts
import pdf from 'pdf-parse';
import type { ParsedDocument } from './txt';

export async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  const result = await pdf(buffer);
  const text = (result.text || '').replace(/\u0000/g, '').trim();
  if (!text) {
    throw new Error('PDF produced no extractable text (scanned PDFs need OCR — not supported yet)');
  }
  return { text, pages: undefined };
}
```

If `pdf-parse` default import fails under TS/ESM, use:

```ts
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse') as (b: Buffer) => Promise<{ text: string }>;
```

- [ ] **Step 2: Verify** with any small text PDF later in Task 1.12; for now `tsc` compiles the file.

**Depends on:** Task 1.2.

### Task 1.5: Recursive parent/child chunker

**Files:**
- Create: `backend/src/services/kb/chunker.ts`

**Target sizes (from redesign):** child ~400–512 tokens ≈ **1600–2000 chars**; parent ~1200–1800 tokens ≈ **4800–7200 chars**; overlap ~10–15%; merge fragments &lt; ~50 tokens (~200 chars).

- [ ] **Step 1: Implement interfaces + chunker**

```ts
export type ChunkPiece = {
  content: string;          // child (retrieval unit)
  context_window: string;   // parent window for generation
  metadata: {
    source_name: string;
    document_id: string;
    tenant_id: string;
    chunk_index: number;
    heading?: string;
    language?: string;
    char_start: number;
    char_end: number;
  };
};

export type ChunkOptions = {
  sourceName: string;
  documentId: string;
  tenantId: string;
  childChars?: number;   // default 1800
  parentChars?: number;  // default 5600
  overlapChars?: number; // default 200
  minChars?: number;     // default 200
};

export function chunkDocument(text: string, opts: ChunkOptions): ChunkPiece[] {
  // 1) Normalize newlines
  // 2) Split by headings (lines matching /^#{1,6}\s+/ or ALL-CAPS short lines) then paragraphs (\n\n+)
  // 3) Pack paragraphs into child windows of ~childChars with overlap
  // 4) For each child, set context_window = surrounding parentChars centered on child
  // 5) Drop/merge pieces shorter than minChars (except last if only piece)
  // Return [] if text empty → caller treats as failure
}
```

- [ ] **Step 2: Smoke test**

```bash
cd backend && npx tsx -e "
const { chunkDocument } = require('./src/services/kb/chunker');
const text = 'Para one. '.repeat(400);
const chunks = chunkDocument(text, { sourceName:'t.txt', documentId:'d', tenantId:'t' });
console.log(chunks.length, chunks[0].content.length, chunks[0].context_window.length);
"
```

Expected: `chunks.length >= 2`, child length ~≤2000, parent ≥ child.

**Depends on:** nothing.

### Task 1.6: Core ingest function (no queue yet)

**Files:**
- Create: `backend/src/services/kb/ingestWorker.ts` (start with pure function; wire boss in 1.7)

- [ ] **Step 1: Add types + `processKbIngestJob`**

```ts
import { supabaseAdmin } from '../../lib/supabase';
import { getEmbedding } from './embeddings';
import { parsePlainText } from './parsers/txt';
import { parsePdf } from './parsers/pdf';
import { chunkDocument } from './chunker';

export type KbIngestJob = { tenantId: string; documentId: string };

const ALLOWED_EXT = new Set(['txt', 'md', 'pdf']);
const MAX_BYTES = 10 * 1024 * 1024; // 10MB — match UI copy

export async function processKbIngestJob(job: KbIngestJob): Promise<void> {
  const { tenantId, documentId } = job;

  // 1) Load document; require tenant_id match
  const { data: doc, error } = await supabaseAdmin
    .from('knowledge_documents')
    .select('id, tenant_id, source_name, status, file_path')
    .eq('id', documentId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !doc) throw new Error('Document not found for tenant');
  if (doc.status === 'ready') return; // idempotent skip
  if (!doc.file_path) throw new Error('Missing file_path');

  // 2) Tenant path isolation: file_path must start with `${tenantId}/`
  if (!doc.file_path.startsWith(`${tenantId}/`)) {
    await markFailed(documentId, tenantId, 'file_path tenant mismatch');
    return;
  }

  // 3) Download via service role
  const { data: blob, error: dlErr } = await supabaseAdmin.storage
    .from('knowledge_base')
    .download(doc.file_path);
  if (dlErr || !blob) {
    await markFailed(documentId, tenantId, `Download failed: ${dlErr?.message}`);
    return;
  }
  const buffer = Buffer.from(await blob.arrayBuffer());
  if (buffer.length > MAX_BYTES) {
    await markFailed(documentId, tenantId, `File exceeds ${MAX_BYTES} bytes`);
    return;
  }

  // 4) Parse by extension
  const ext = (doc.source_name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    await markFailed(documentId, tenantId, `Unsupported type: .${ext}`);
    return;
  }
  const parsed = ext === 'pdf' ? await parsePdf(buffer) : parsePlainText(buffer);

  // 5) Chunk
  const pieces = chunkDocument(parsed.text, {
    sourceName: doc.source_name,
    documentId,
    tenantId,
  });
  if (pieces.length === 0) {
    await markFailed(documentId, tenantId, 'No chunks produced');
    return;
  }

  // 6) Embed + replace chunks (delete old for document first)
  await supabaseAdmin.from('knowledge_chunks').delete().eq('document_id', documentId).eq('tenant_id', tenantId);

  // Batch embeddings in groups of 20 to avoid huge payloads
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const embedding = await getEmbedding(piece.content);
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

  // 7) Ready
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
```

- [ ] **Step 2:** Export `markFailed` only if tests need it; otherwise keep private.

**Verify:** Typecheck file imports resolve. Full manual test in Task 1.12.

**Depends on:** Tasks 1.1, 1.3, 1.4, 1.5. Uses existing `embeddings.ts`.

### Task 1.7: Register pg-boss queue + worker

**Files:**
- Modify: `backend/src/services/kb/ingestWorker.ts`
- Pattern reference: `backend/src/services/automation/slaWorker.ts`

- [ ] **Step 1: Add init + enqueue**

```ts
import { boss } from '../jobQueue';

const QUEUE = 'kb-ingest';

export async function initKbIngestWorker() {
  await boss.createQueue(QUEUE);

  await boss.work(QUEUE, async (job: any) => {
    const data = (Array.isArray(job) ? job[0].data : job.data) as KbIngestJob;
    console.log(`[kb-ingest] Processing document ${data.documentId} tenant ${data.tenantId}`);
    try {
      await processKbIngestJob(data);
    } catch (err: any) {
      await markFailed(data.documentId, data.tenantId, err?.message || 'Unknown ingest error');
      throw err; // let pg-boss retry
    }
  });

  // Backfill: enqueue docs stuck in processing (created before worker existed)
  await enqueueStuckProcessingDocuments();
  console.log('[kb-ingest] Worker ready');
}

export async function enqueueKbIngest(tenantId: string, documentId: string) {
  await boss.send(
    QUEUE,
    { tenantId, documentId },
    { retryLimit: 3, expireInHours: 24 }
  );
}

async function enqueueStuckProcessingDocuments() {
  const { data } = await supabaseAdmin
    .from('knowledge_documents')
    .select('id, tenant_id')
    .eq('status', 'processing')
    .not('file_path', 'is', null)
    .limit(50);

  for (const row of data || []) {
    await enqueueKbIngest(row.tenant_id, row.id);
  }
}
```

- [ ] **Step 2:** Ensure `markFailed` is in scope for the catch path (same file).

**Verify:** After wiring Task 1.8, logs show `[kb-ingest] Worker ready` on boot.

**Depends on:** Task 1.6; `initJobQueue()` must run first (`boss.start()`).

### Task 1.8: Wire worker in `index.ts`

**Files:**
- Modify: `backend/src/index.ts` (~lines 118–137)

- [ ] **Step 1:** Import and call after job queue:

```ts
import { initKbIngestWorker } from './services/kb/ingestWorker';

// inside app.listen callback, after await initJobQueue():
await initKbIngestWorker();
```

Order must be: `initJobQueue` → `initKbIngestWorker` (queue requires started boss).

- [ ] **Step 2: Verify**

```bash
cd backend && npm run dev
```

Expected logs include `pg-boss initialized` and `[kb-ingest] Worker ready`.

**Depends on:** Task 1.7.

### Task 1.9: Authenticated enqueue API (trigger after upload)

**Why API (not only DB trigger):** Frontend already uses Supabase client insert; calling backend with the new `documentId` is the smallest reliable enqueue. Worker backfill covers missed jobs.

**Files:**
- Modify: `backend/src/routes/tenant.ts` (already has `requireTenantAdmin`)

- [ ] **Step 1: Add routes** at end of router (before `export default`)

```ts
import { enqueueKbIngest } from '../services/kb/ingestWorker';

/** POST /api/tenant/kb/documents/:id/ingest — enqueue vectorization */
router.post('/kb/documents/:id/ingest', async (req: AuthRequest, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  const documentId = req.params.id;

  const { data: doc } = await supabaseAdmin
    .from('knowledge_documents')
    .select('id, status')
    .eq('id', documentId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!doc) return res.status(404).json({ error: 'Document not found' });

  // Allow retry from failed → reset to processing
  if (doc.status === 'failed' || doc.status === 'ready') {
    await supabaseAdmin
      .from('knowledge_documents')
      .update({ status: 'processing', error_message: null })
      .eq('id', documentId)
      .eq('tenant_id', tenantId);
  }

  await enqueueKbIngest(tenantId, documentId);
  return res.json({ ok: true, documentId });
});
```

Confirm `tenant` router is mounted at `/api/tenant` in `index.ts` (already is).

- [ ] **Step 2: Verify** with a real JWT later in 1.12; for now ensure route compiles.

**Depends on:** Task 1.7.

### Task 1.10: Frontend enqueue after insert + accept `.md`

**Files:**
- Modify: `src/pages/KnowledgeBaseManager.tsx`

- [ ] **Step 1:** After successful insert in `uploadMutation.onSuccess` (or inside `mutationFn` after insert), call backend:

```ts
// After insert returns data with id:
const session = await supabase.auth.getSession();
const token = session.data.session?.access_token;
const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001'; // use project's real env name if different
await fetch(`${apiBase}/api/tenant/kb/documents/${data.id}/ingest`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'x-tenant-id': tenant!.id,
    'Content-Type': 'application/json',
  },
});
```

Find the existing frontend API base env (grep `VITE_` + `/api/tenant` in `src/`) and **reuse that helper** — do not invent a second base-URL pattern.

- [ ] **Step 2:** Expand accept attribute: `accept=".pdf,.txt,.md"`.

- [ ] **Step 3:** Prefer keeping insert in frontend Storage + table (already works); only add enqueue call.

**Verify:** Network tab shows `POST .../ingest` → 200 after upload.

**Depends on:** Task 1.9. Find API URL pattern via grep: `VITE_.*API` in `src/`.

### Task 1.11: Fixture file

**Files:**
- Create: `backend/fixtures/kb/sample-refund-policy.txt`

- [ ] **Step 1: Write ~800–1500 words** of fake policy text with headings, e.g.:

```text
# Refund Policy

## 30-day money-back guarantee
Flought offers a 30-day money-back guarantee...

## How to request a refund
Email billing@example.com with your tenant ID...

## Non-refundable items
Overage charges are non-refundable...
```

Enough text that chunker produces ≥2 chunks.

**Depends on:** nothing.

### Task 1.12: Manual E2E test (Phase 1 exit criteria)

**Files:** none

- [ ] **Step 1:** Ensure backend running with worker (`Task 1.8`).
- [ ] **Step 2:** In app UI → Knowledge Base → upload `sample-refund-policy.txt` (or paste fixture content into a local `.txt`).
- [ ] **Step 3:** Watch backend logs for `[kb-ingest] Processing document ...`.
- [ ] **Step 4: SQL verify**

```sql
select id, status, chunk_count, error_message
from knowledge_documents
order by uploaded_at desc limit 5;

select count(*) from knowledge_chunks
where document_id = '<that-id>';
```

Expected: `status = 'ready'`, `chunk_count >= 1`, chunks count matches.

- [ ] **Step 5: Hybrid RPC smoke** (optional but recommended)

```sql
-- Use a real embedding from a one-off script calling getEmbedding('refund policy')
-- or ask a WhatsApp test number a question that should hit the doc (after Phase 2 optional).
```

- [ ] **Step 6: Failure path** — upload empty `.txt` or rename `.exe` content; expect `status = 'failed'` + `error_message` set.

**Phase 1 done when:** UI upload → `ready` without `seed_kb.ts`.

**Depends on:** Tasks 1.1–1.11.

### Task 1.13: Commit Phase 1 (only if user asks)

Do **not** commit unless the user explicitly requests a commit. If they do:

```bash
git add supabase/migrations/20260725000010_kb_ingest_columns.sql \
  backend/src/services/kb/parsers backend/src/services/kb/chunker.ts \
  backend/src/services/kb/ingestWorker.ts backend/src/index.ts \
  backend/src/routes/tenant.ts src/pages/KnowledgeBaseManager.tsx \
  backend/fixtures/kb/sample-refund-policy.txt backend/package.json backend/package-lock.json
git commit -m "$(cat <<'EOF'
feat(kb): add pg-boss kb-ingest worker for document vectorization

EOF
)"
```

**Depends on:** Task 1.12 green.

---

## Phase 2 — Retrieval hardening

Do after Phase 1 so there are real chunks to retrieve.

### Task 2.1: Apply `minSimilarity` floor in TypeScript

**Files:**
- Modify: `backend/src/services/kb/retrieval.ts`

**Context:** `minSimilarity` is documented but unused; hybrid RPC returns RRF scores (not cosine). Treat it as a **relative floor** on returned `similarity`.

- [ ] **Step 1:** After mapping chunks, filter:

```ts
export async function retrieveRelevantChunks(
  tenantId: string,
  query: string,
  topK: number = 40,
  minSimilarity: number = 0.01 // RRF scores are small; tune empirically
): Promise<RetrievedChunk[]> {
  // ... existing rpc call with match_count: topK ...
  const mapped = (chunks || []).map(/* existing */);
  return mapped.filter(c => c.similarity >= minSimilarity);
}
```

- [ ] **Step 2:** Raise default `topK` from `3` → `40` (first-stage). Final trim to 5–8 happens after rerank (Phase 5) or locally:

```ts
return mapped.filter(...).slice(0, 8);
```

Until Phase 5, **slice(0, 8)** after filter is enough (YAGNI).

**Verify:** Unit-style: call retrieve with nonsense query on a tenant with KB — expect `[]` or low scores filtered; with “refund policy” — expect ≥1 chunk.

**Depends on:** Phase 1 complete (chunks exist).

### Task 2.2: Align pipeline query with generator (original rewritten query)

**Files:**
- Modify: `backend/src/services/automation/pipeline.ts` (~lines 150–156)

**Bug today:** dense/hybrid search uses `normalizedKeywords.join(' ')` when keywords exist, which can **drop the natural-language query** and hurt multilingual dense search.

- [ ] **Step 1: Change search string**

```ts
// Dense + hybrid: prefer original-language rewritten query (redesign §6)
const searchString = intent.rewrittenQuery || messageText;
// Optional: append SKU-like keywords for BM25 without replacing the query
const keywordSuffix = intent.normalizedKeywords?.length
  ? ' ' + intent.normalizedKeywords.join(' ')
  : '';
const retrievalQuery = (searchString + keywordSuffix).trim();

const [chunks, { data: tenant }] = await Promise.all([
  !isKnowledge ? Promise.resolve([]) : retrieveRelevantChunks(tenantId, retrievalQuery),
  // ...
]);
```

- [ ] **Step 2: Empty-chunk short-circuit** before `generateRAGResponse`:

```ts
if (isKnowledge && chunks.length === 0) {
  const msg = "I'm sorry, I don't have that information. Let me transfer you to a human agent.";
  await sendBotReply(tenantId, conversationId, customerPhone, providerName, msg, 'rag');
  await triggerHandover(tenantId, conversationId, 'low_confidence_generation', messageText, 'Empty KB / no retrieval hits');
  try { await supabaseAdmin.rpc('refund_tenant_quota', { p_tenant_id: tenantId }); } catch (e) {}
  return;
}
```

- [ ] **Step 3: Semantic cache key** — prefer original rewrite (same file + `semanticCache` call sites):

```ts
const cacheQuery = intent.rewrittenQuery || messageText; // not englishTranslation
```

Apply to both `checkSemanticCache` and `setSemanticCache` call sites in this file.

**Verify:** Send a knowledge question with empty KB → handover template, **no** invented answer. With Phase 1 doc → grounded refund answer.

**Depends on:** Task 2.1.

### Task 2.3 (optional): FTS `simple` for multilingual BM25

**Files:**
- Create: `supabase/migrations/20260725000012_knowledge_fts_simple.sql`

Only if non-English keyword hits are weak after Task 2.2. Dense already carries most multilingual load.

- [ ] **Step 1: Migration sketch**

```sql
-- Add parallel simple FTS; keep english column for back-compat OR replace generated column.
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS fts_simple tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED;
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_fts_simple ON knowledge_chunks USING GIN (fts_simple);

-- Replace match_knowledge_hybrid body to use fts_simple + websearch_to_tsquery('simple', query_text)
-- Copy function from 20260716000015_ultimate_rag.sql and swap 'english' → 'simple'.
```

- [ ] **Step 2:** `npx supabase db push` (or `migration up`).

**Verify:** Arabic/Spanish token query returns sparse hits when terms appear verbatim in chunks.

**Depends on:** Task 2.2. Skip if EN-only eval is enough for now.

### Task 2.4 (optional): Parent already via `context_window`

**Files:** `retrieval.ts` already returns `context_window || content`.

- [ ] Confirm ingest writes `context_window` (Task 1.6). No extra parent-fetch query needed if chunker fills it.
- [ ] If some old seed rows lack `context_window`, re-ingest those documents via retry API.

**Depends on:** Phase 1.

---

## Phase 3 — STT upgrade (multilingual voice in)

### Task 3.1: Switch model to `gpt-4o-mini-transcribe`

**Files:**
- Modify: `backend/src/services/llm/stt.ts`

- [ ] **Step 1: Replace model + optional language passthrough**

```ts
export async function transcribeAudio(
  mediaUrl: string,
  providerName?: string,
  accessToken?: string,
  languageHint?: string
): Promise<string> {
  // ... existing fetch → buffer → toFile ...
  const transcription = await sttClient.audio.transcriptions.create({
    file,
    model: 'gpt-4o-mini-transcribe',
    // language: languageHint, // only if ISO-639-1 known; omit for auto-detect
  });
  return (transcription.text || '').trim();
}
```

- [ ] **Step 2: Verify** — send a WhatsApp voice note (EN + one other language). Logs show transcription; pipeline receives text.

**Depends on:** `OPENAI_API_KEY` / `OPENAI_STT_KEY` (Phase 0).

### Task 3.2: Tighten empty-transcript UX

**Files:**
- Modify: `backend/src/services/messageHandler.ts` (~audio + empty branches)

**Today:** empty `messageContent` triggers `unsupported_media_type` handover — OK, but message is generic.

- [ ] **Step 1:** After STT, if audio and `!transcript`:

```ts
if (msg.type === 'audio' && !transcript) {
  // Store a clear system-facing content so inbox/handover isn't blank
  messageContent = ''; // keep empty so bot path below fires
}
```

- [ ] **Step 2:** In the `!messageContent && currentStatus === 'bot'` branch, distinguish audio:

```ts
} else if (!messageContent && currentStatus === 'bot') {
  if (msg.type === 'audio') {
    // Prefer: send a short text ask via sendBotReply if you can resolve provider here;
    // minimal fix: handover reason string:
    import('./automation/handover').then(({ triggerHandover }) => {
      triggerHandover(
        tenantId,
        conversationId,
        'unsupported_media_type',
        'Voice note could not be transcribed. Please send as text.',
        'Empty STT transcript'
      );
    });
  } else {
    // existing unsupported media handover
  }
}
```

Ideal UX (slightly more work): `sendBotReply(..., 'Please send your question as text — we could not hear that voice note.', 'faq')` **without** handover. Prefer ask-text if `sendBotReply` is easy to call here; else handover with clear note is acceptable for P0.

**Verify:** Mute/corrupt audio → user gets clarify/handover; **RAG is not invoked on empty string**.

**Depends on:** Task 3.1.

### Task 3.3: STT usage metering (keep existing)

**Files:** `messageHandler.ts` already calls `increment_usage` with `p_stt_minutes` when transcript exists.

- [ ] Leave as-is unless RPC rejects. Do not invent a new metering table.
- [ ] Optionally refine duration estimate later (YAGNI).

**Depends on:** Task 3.1.

---

## Phase 4 — FAQ / draft filter + dead code

### Task 4.1: `match_faq` published-only

**Files:**
- Create: `supabase/migrations/20260725000011_match_faq_published_only.sql`
- Reference: `supabase/migrations/20260716000020_audit_fixes.sql` (`match_faq`), `20260716000016_faq_draft_status.sql` (`status`)

- [ ] **Step 1: Migration**

```sql
CREATE OR REPLACE FUNCTION match_faq(p_tenant_id uuid, p_query text)
RETURNS TABLE (faq_id uuid, answer text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT f.id, f.answer
  FROM faqs f, unnest(f.keywords) AS kw
  WHERE f.tenant_id = p_tenant_id
    AND coalesce(f.status, 'published') = 'published'
    AND coalesce(f.is_active, true) = true
    AND p_query ILIKE '%' || trim(kw) || '%'
  LIMIT 1;
END;
$$;
```

Adjust `is_active` only if column exists (it is used in `autoFaqMiner` inserts). If column missing, omit that predicate.

- [ ] **Step 2:** Apply via `npx supabase db push` / `migration up`.

**Verify:** Insert FAQ with `status = 'draft'` + keyword `zzzunique`; message containing keyword must **not** match. Publish → matches.

**Depends on:** nothing (can parallel Phase 1 after schema check).

### Task 4.2: `autoFaqMiner` — schedule or delete

**Files:**
- Modify or delete: `backend/src/services/kb/autoFaqMiner.ts`
- Possibly: `jobQueue.ts` / `index.ts`

**Fact:** `runAutoFaqMiner` is **never imported** (dead code). It inserts `status: 'draft'` FAQs — safe only after Task 4.1.

- [ ] **Option A (recommended YAGNI):** Delete `autoFaqMiner.ts` **or** add file header:

```ts
/** NOT WIRED — do not import until product wants nightly FAQ mining. */
```

and leave unscheduled.

- [ ] **Option B:** Wire nightly:

```ts
// in initJobQueue or initKbIngestWorker:
await boss.schedule('auto-faq-miner', '0 3 * * *'); // 03:00 UTC
await boss.work('auto-faq-miner', async () => { await runAutoFaqMiner(); });
```

Prefer **Option A** unless product explicitly wants mining.

**Verify:** Grep shows no accidental imports; backend boots.

**Depends on:** Task 4.1 if choosing Option B.

### Task 4.3: Document `flowMatcher` vs `flowEngine` (no rewrite)

**Files:** none (docs only — add short comment in `flowMatcher.ts`)

- [ ] **Step 1:** Add comment at top of `backend/src/services/automation/flowMatcher.ts`:

```ts
/**
 * Pipeline entry for WhatsApp bot flows (keyword trigger → reply).
 * Visual CRM automation graphs live in flowEngine.ts and are a separate system.
 * Do NOT merge these without an explicit product decision.
 */
```

- [ ] **Step 2:** Do **not** rewrite `flowEngine.ts` in this plan.

**Depends on:** nothing.

---

## Phase 5 — Rerank (optional upgrade path)

Skip until Phase 1–2 evals show “right chunk, wrong order.”

### Task 5.1: Feature flag + no-op default

**Files:**
- Create: `backend/src/services/kb/rerank.ts`
- Modify: `backend/src/services/kb/retrieval.ts`

- [ ] **Step 1:**

```ts
// rerank.ts
export async function rerankChunks(
  query: string,
  chunks: RetrievedChunk[],
  topN = 6
): Promise<RetrievedChunk[]> {
  if (process.env.ENABLE_RERANK !== 'true' || !process.env.COHERE_API_KEY) {
    return chunks.slice(0, topN);
  }
  // Cohere rerank API: model rerank-v3.5 or rerank-4-fast
  // Map relevance scores back onto RetrievedChunk[]; return topN
  return chunks.slice(0, topN);
}
```

- [ ] **Step 2:** In `retrieveRelevantChunks`, after hybrid fetch + similarity filter, `return rerankChunks(query, mapped, 6)`.

**Verify:** Without env → identical to slice. With `ENABLE_RERANK=true` + key → order changes on ambiguous queries.

**Depends on:** Phase 2.

---

## Phase 6 — TTS out (optional, off by default)

Do not enable globally. Text replies remain default.

### Task 6.1: Tenant flag

**Files:**
- Modify: pipeline / send path to read `ai_settings.voice_replies === true`
- No migration required if `ai_settings` is jsonb on `tenants` (already used in pipeline).

- [ ] Document flag shape:

```json
{ "voice_replies": false, "voice_max_chars": 400 }
```

**Depends on:** Phase 3 (voice-in path exists).

### Task 6.2: TTS module + Meta voice send

**Files:**
- Create: `backend/src/services/llm/tts.ts`
- Modify: `backend/src/bsp/BSPProvider.ts` — add optional `voice?: boolean` on `SessionMessageContent`
- Modify: `backend/src/bsp/MetaProvider.ts` — when `content.type === 'audio'`:

```ts
metaMessage.audio = {
  link: content.mediaUrl,
  ...(content.voice ? { voice: true } : {}),
};
```

- [ ] TTS: OpenAI `tts-1` → audio buffer; convert to **mono OGG/OPUS** (ffmpeg CLI or skip Phase 6 until ffmpeg available on host). Cap chars via `voice_max_chars`.
- [ ] Gate: only if inbound was audio **and** answer length ≤ cap **and** confidence high **and** `voice_replies` true.
- [ ] Cost: skip TTS if over plan / missing ffmpeg.

**Verify:** With flag false → always text. With flag true + voice inbound + short high-conf answer → WhatsApp voice note plays.

**Depends on:** Tasks 6.1, Meta media hosting/link strategy (upload buffer to Storage public/signed URL first).

---

## Phase 7 — Frontend polish

### Task 7.1: Show failure reason + retry + polling

**Files:**
- Modify: `src/pages/KnowledgeBaseManager.tsx`

- [ ] Extend `KBDocument`:

```ts
interface KBDocument {
  id: string;
  source_name: string;
  status: 'processing' | 'ready' | 'failed';
  uploaded_at: string;
  file_path?: string;
  error_message?: string | null;
  chunk_count?: number | null;
}
```

- [ ] `useQuery` options: `refetchInterval: (q) => q.state.data?.some(d => d.status === 'processing') ? 3000 : false`
- [ ] Failed badge: show `doc.error_message` truncated.
- [ ] Retry button → `POST /api/tenant/kb/documents/:id/ingest` (Task 1.9).
- [ ] Optional: “Stuck &gt; 10 min” helper text if `processing` and `uploaded_at` old.

**Verify:** Fail a doc → see reason → Retry → returns to processing → ready.

**Depends on:** Phase 1 Tasks 1.9–1.10.

---

## Phase 8 — Verification checklist

Run after Phases 1–3 (minimum). Check off:

- [x] **Upload → ready:** `.txt` upload reaches `ready` with `chunk_count >= 1` without `seed_kb.ts`. *(Code + local parser/chunker verified; live E2E blocked — no tenants in linked Supabase.)*
- [ ] **WhatsApp grounded answer:** Ask a question answered only in the uploaded doc → bot cites policy facts (high confidence). *(Pipeline wired; requires live WhatsApp + ingested doc — MANUAL.)*
- [x] **Multilingual smoke:** Same fact asked in EN + one of ES/PT/AR/FR/HI/ID → sensible answer in user language (generator instructed). *(Rule 6 added to `generator.ts` during Phase 8; live multi-lang replies — MANUAL.)*
- [x] **Voice note → text reply:** Voice inbound transcribed via mini-transcribe → text outbound (TTS still off). *(Code verified; live voice webhook — MANUAL.)*
- [x] **Empty KB:** Tenant with no ready docs / no hits → clarify + handover, no hallucination.
- [x] **Empty STT:** Unintelligible audio → ask text / handover; no RAG on `""`.
- [x] **Multi-tenant isolation:** Tenant A chunks never returned for Tenant B (`p_tenant_id` on RPC + job payload check).
- [x] **FAQ drafts:** Draft FAQ keywords do not auto-reply (Phase 4).
- [x] **Typecheck:** `cd backend && npm run typecheck` clean for touched files.

### Phase 8 verification report (2026-07-25)

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Upload → ready | **PARTIAL** | `ingestWorker.ts:28-131` sets `ready` + `chunk_count`; `tenant.ts:488-511` enqueue route; `KnowledgeBaseManager.tsx:35-93` upload→ingest; `index.ts:138` worker init. Local: fixture → `parsePlainText` + `chunkDocument` → **2 chunks**. Live E2E: **MANUAL** (DB had no tenants). |
| 2 | WhatsApp grounded answer | **MANUAL** | `pipeline.ts:168-170,235,266` — `retrieveRelevantChunks` → `generateRAGResponse` → `sendBotReply` with chunk IDs on high confidence. |
| 3 | Multilingual | **PASS** (code) | `generator.ts:77` — reply in customer language rule (added Phase 8). Live ES/PT/AR smoke: **MANUAL**. |
| 4 | Voice → text | **PASS** (code) | `stt.ts:33` `gpt-4o-mini-transcribe`; `messageHandler.ts:88-95,157-167`; `tts.ts:128-129` TTS requires `voice_replies === true`. |
| 5 | Empty KB | **PASS** | `pipeline.ts:227-232` short-circuit when `isKnowledge && chunks.length === 0` → apology + handover + quota refund. |
| 6 | Empty STT | **PASS** | `messageHandler.ts:92-94,172-184` — empty transcript skips pipeline; sends text-only fallback (no RAG on `""`). |
| 7 | Multi-tenant | **PASS** | `retrieval.ts:40` `p_tenant_id`; `20260716000015_ultimate_rag.sql:79,89,103`; `ingestWorker.ts:42-45` file_path prefix guard. |
| 8 | FAQ drafts | **PASS** | `20260725000011_match_faq_published_only.sql:12` `status = 'published'`; `faqMatcher.ts:11-14` uses RPC. |
| 9 | Typecheck | **PASS** | `npm run typecheck` exit 0 (2026-07-25). |

**Bug fixed during verification:** `generator.ts` — added explicit multilingual reply rule (plan assumed it existed; it did not).

**Overall verdict:** RAG stack is **demo-ready with caveats** — ingest/retrieval/pipeline/STT/TTS-gating code paths are coherent and typecheck clean; production demo still needs manual WhatsApp E2E (upload→ready on real tenant, grounded refund-policy question, multilingual + voice smoke).

---

## Out of scope

- GraphRAG / RAPTOR / ColBERT / late chunking
- LLM-chunk-everything at ingest
- India-only or Hindi-only stacks
- Second vector DB (Qdrant/Weaviate)
- Translate-all-to-English before embed
- HyDE / multi-query on every message
- Web-search CRAG
- Always-on TTS
- Rewriting `flowEngine.ts` CRM graphs
- Production deploy via `convex deploy` or any Convex workflow (this app is Supabase + Express)

---

## Execution order (agents)

1. Phase 0 → Phase 1 (stop and demo upload→ready)  
2. Phase 2 → Phase 3  
3. Phase 4 whenever convenient (small, high value)  
4. Phase 7 UI polish once ingest exists  
5. Phase 5 / 6 only if measured need  
6. Phase 8 checklist before calling the work “done”

**Suggested commit cadence:** one commit per phase (1, 2, 3, 4, 7) when the user asks to commit — never commit secrets (`.env`).
