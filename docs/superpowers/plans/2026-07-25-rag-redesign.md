# Flought RAG Redesign (2026-07-25)

> **Execution plan:** [`2026-07-25-rag-implementation.md`](./2026-07-25-rag-implementation.md) — Composer-executable, phase-wise tasks.
>
> **Status:** Research + recommendation only. Implement via the execution plan above (do not freestyle from this research doc alone).
> **Constraint:** Ponytail / YAGNI — fix the broken ingestion path first; add retrieval upgrades only when evals justify them.
> **Scope:** Global multilingual WhatsApp SaaS (EN + ES, PT, AR, FR, HI, ID, etc.) + optional voice I/O — **not** India-only.
> **Companion canvas:** [`flought-rag-redesign.canvas.tsx`](C:\Users\Junaid\.cursor\projects\d-Watsapp-saas\canvases\flought-rag-redesign.canvas.tsx)

---

## Executive recommendation (opinionated)

**Ship this default stack for Flought (multi-tenant WhatsApp B2B support, global languages, cost-first):**

| Layer | Default (ship) | Upgrade when quality fails |
|-------|----------------|----------------------------|
| **Chunk** | Recursive + structure-aware (heading/para) → child 400–512 tok + parent `context_window` 1.2–1.8k | Docling/Unstructured for table-heavy PDFs; **never** LLM-chunk-everything |
| **Embed** | OpenAI `text-embedding-3-small` (1536) — already in schema | **Cohere `embed-v4`** (managed multilingual) **or** **BGE-M3** on VPS TEI |
| **Retrieve** | Keep `match_knowledge_hybrid` dense + BM25 RRF (`rrf_k=60`) | FTS `simple` (not English-only); raise first-stage k → 30–50 |
| **Rerank** | Off until Phase 1 | Cohere Rerank 3.5/4 Fast **or** TEI `bge-reranker-v2-m3` → top 5–8 |
| **Generate** | `gpt-4o-mini` + respond in **user language** | `gpt-4.1-mini` / Gemini Flash if groundedness fails evals |
| **STT** | `gpt-4o-mini-transcribe` (replace `whisper-1`) | `gpt-4o-transcribe` (noisy) or Deepgram Nova-3 (volume/noise) |
| **TTS** | **Off by default** (text replies); opt-in per tenant | OpenAI TTS → OGG/OPUS mono; ElevenLabs if naturalness/langs fail |
| **Store** | Supabase Postgres + **pgvector** | Keep; no Qdrant/Weaviate |

**One-line architecture:** *FAQ for deterministic facts; hybrid RAG for PDFs; STT→same text pipeline→optional TTS; humans for low confidence — with a real `kb-ingest` worker so RAG is not a no-op.*

**Waterfall stays:** flow → FAQ → semantic cache → `agentRouter` → hybrid RAG → confidence handover.

---

## Chosen stack (detail)

### Default path (cost-effective)

1. **P0 — Ingestion worker** (missing today). UI uploads leave `knowledge_documents.status = 'processing'` forever; only `scripts/seed_kb.ts` writes chunks.
2. Keep Supabase + pgvector + hybrid RRF. Do **not** introduce a second vector DB.
3. Keep `text-embedding-3-small` until multilingual golden-set evals fail (full re-embed is expensive).
4. Embed and retrieve in the **original language** (cross-lingual models map meaning; translate-then-embed adds latency + MT errors). Router may still emit English for admin/debug — **dense search uses `rewrittenQuery` (original), not forced English**.
5. STT: migrate `whisper-1` → `gpt-4o-mini-transcribe` (~½ price, better WER/lang ID).
6. TTS: text-first; voice-out only when inbound was voice **and** short answer **and** tenant flag **and** STT confidence OK.

### Upgrade path (when measured quality fails)

| Failure mode | Upgrade |
|--------------|---------|
| Cross-lingual / AR/HI/ID miss-rate high | Cohere `embed-v4` (API) or BGE-M3 (VPS) + full re-embed; FTS → `simple` |
| Top-k relevant but wrong order | Cross-encoder rerank (Cohere or bge-reranker-v2-m3) |
| Chunks orphaned from section context | P2 Anthropic-style contextual prefixes at ingest |
| Noisy voice notes / code-switching STT fails | `gpt-4o-transcribe` or Deepgram Nova-3 |
| TTS unnatural / missing langs | ElevenLabs Flash/Turbo (cost ↑); else stay text |
| Generator invents despite good chunks | Stricter groundedness prompt + citation gate; escalate model once |

---

## Current state (audited against repo)

| Piece | Location | Status |
|-------|----------|--------|
| Upload UI | `src/pages/KnowledgeBaseManager.tsx` | Uploads to Storage + inserts `knowledge_documents` with `status: 'processing'`. Comment expects a backend worker that **does not exist**. |
| Seed-only vectorization | `scripts/seed_kb.ts` | Manually inserts chunks + embeddings. Not production. |
| Embeddings | `backend/src/services/kb/embeddings.ts` | OpenAI `text-embedding-3-small` |
| Retrieval | `backend/src/services/kb/retrieval.ts` | Calls `match_knowledge_hybrid`; returns `context_window \|\| content` (small-to-big intent); `topK=3`, `minSimilarity` unused by hybrid RPC |
| Hybrid RPC | `supabase/migrations/20260716000015_ultimate_rag.sql` | Vector + `tsvector` BM25 + RRF (`rrf_k=60`); FTS config is **`english`** today |
| Semantic cache | `backend/src/services/kb/semanticCache.ts` | Cosine ≥ 0.95; moderation before write; keyed via router English translation today |
| Pipeline waterfall | `backend/src/services/automation/pipeline.ts` | Flow → FAQ → router → cache → RAG → confidence handover |
| Query rewrite | `backend/src/services/automation/agentRouter.ts` | Intent + rewrite + English translation + keywords |
| Generator | `backend/src/services/llm/generator.ts` | `gpt-4o-mini` (env), JSON `{content, confidence}` |
| STT | `backend/src/services/llm/stt.ts` + `messageHandler.ts` | **`whisper-1`**; Meta media fetch with Bearer when provider=meta |
| Outbound media | `backend/src/bsp/MetaProvider.ts` | Can send `audio` via `{ link: mediaUrl }`; **no `voice: true` / OGG-OPUS enforcement yet** |
| Job queue | `backend/src/services/jobQueue.ts` | pg-boss — natural home for `kb-ingest` |
| Schema | `supabase/migrations/20260704000004_knowledge_base.sql` | `knowledge_documents`, `knowledge_chunks` (1536), metadata jsonb |

**Critical gap:** retrieval quality debates are secondary until documents become `ready` with real chunks.

---

## 1. RAG strategy landscape (2025–2026) and Flought fit

| Strategy | What it is | When it wins | Flought verdict |
|----------|------------|--------------|-----------------|
| **Naive / basic RAG** | Chunk → embed → top-k cosine → LLM | Tiny EN demos | Insufficient; exact SKUs need sparse |
| **Hybrid (dense + BM25/RRF)** | Parallel semantic + lexical; fuse ranks | Exact terms + paraphrases; production default | **Keep / sharpen** |
| **Parent-document / small-to-big** | Retrieve small child; generate with parent window | FAQ PDFs, policies | **Adopt properly at ingest** |
| **Hierarchical / RAPTOR** | Recursive summary tree | Long research corpora | **Skip** |
| **GraphRAG** | Entity-relation graph | Multi-hop synthesis | **Skip** — indexing cost unjustified for support lookups ([Microsoft DS](https://medium.com/data-science-at-microsoft/graphrag-beyond-the-demo-lessons-from-the-trenches-add83180f849), [2026 framework](https://cruxdigits.nl/blog/rag-vs-graphrag-2026/)) |
| **Agentic / HyDE / multi-query** | Expand queries | Ambiguous chat | **Keep rewrite**; defer HyDE (latency) |
| **CRAG** | Grade docs; web-search if bad | Open-domain | **Partial:** empty/low → handover; **no web search** |
| **Contextual retrieval** | LLM situates chunk before embed | Lost section context | **P2** ([Anthropic](https://www.anthropic.com/engineering/contextual-retrieval): −49% / −67% w/ rerank) |
| **Late chunking / ColBERT** | Long-context / multi-vector | Controlled embed stack | **Defer** |
| **LLM semantic chunking** | LLM or embed breakpoints | Narrative topic shifts | **Reject as default** — arXiv [2602.16974](https://arxiv.org/abs/2602.16974): structure/paragraph matches LLM chunkers at ≪ cost |

**Production consensus (2026):** hybrid first-stage → cross-encoder rerank → optional contextual embeddings. Sources: [Cadence 2026](https://cadence.withremote.ai/blog/production-rag-architecture), [Atlan](https://atlan.com/know/advanced-rag-techniques/), [Firecrawl chunking 2026](https://www.firecrawl.dev/blog/best-chunking-strategies-rag).

---

## 2. Target architecture

```
WhatsApp / Widget inbound
        │
        ├─ audio/voice note ──► STT (gpt-4o-mini-transcribe)
        │                         │ empty / low-conf → ask text retry
        ▼                         ▼
 pipeline.ts waterfall (text)
  flow → FAQ → semantic_cache → agentRouter
        │
        ├─ conversational → small LLM / greeting (no RAG)
        ├─ actionable → handover
        └─ knowledge → retrieveRelevantChunks
                            │
                            ├─ embed query (original language)
                            ├─ match_knowledge_hybrid (top ~40)
                            ├─ [P1] rerank → top 5–8
                            ├─ similarity / empty gate
                            └─ generateRAGResponse (user language)
                                    │
                                    ├─ high → reply [text | optional TTS→OGG/OPUS]
                                    └─ low → reply + handover

KB upload
        ▼
 knowledge_documents (processing)
        ▼
 pg-boss: kb-ingest
  parse → chunk (child+parent) → [P2 contextualize] → embed → upsert
        ▼
 status ready | failed
```

**Principles**

- Prefer **deterministic** answers (FAQ/flow) before generative RAG.
- **Tenant isolation** on every RPC (`p_tenant_id`) and every worker job.
- **Latency budget:** ~1–3s text bot replies; voice adds STT (+ optional TTS encode/upload).
- **Cost:** minimize per-message LLM/STT/TTS; semantic cache stays valuable; TTS opt-in only.
- **24h session window:** generative/session replies only inside Meta customer-care window; outside → approved templates (no free-form TTS).

---

## 3. Global multilingual (not India-only)

Target WhatsApp languages (priority for evals): **EN, ES, PT, AR, FR, HI, ID** (+ DE/IT/TR as secondary).

### Chunking

| Setting | Value | Why |
|---------|-------|-----|
| Splitter | Recursive + structure-aware (heading → paragraph → sentence) | Stable; no LLM at ingest ([arxiv 2602.16974](https://arxiv.org/abs/2602.16974), [Firecrawl 2026](https://www.firecrawl.dev/blog/best-chunking-strategies-rag)) |
| Child | **400–512 tokens** → `content` | Precise retrieval |
| Parent | **1,200–1,800 tokens** → `context_window` | Small-to-big already consumed by retrieval |
| Overlap | **10–15%** | Bridge mid-clause policies |
| Min chunk | Merge < ~50 tokens | Avoid orphan headings |
| Language tag | `metadata.language` (detect at ingest) | Analytics + future FTS routing |

**When LLM chunking is worth it:** almost never for SMB FAQ/PDFs. Consider only for one-time high-value legal corpora with measured boundary failures — not the SaaS default.

**Parse path:** PyMuPDF / `pdf-parse` first; Docling/Unstructured Phase 2 for tables; OCR only for scanned PDFs.

### Embedding (multilingual evidence)

| Model | Dims | Cost / 1M tok | Multilingual | Fit |
|-------|------|---------------|--------------|-----|
| **OpenAI text-embedding-3-small** | 1536 | ~$0.02 | Adequate EN-first; MIRACL weaker than specialists | **Default keep** (schema) |
| OpenAI text-embedding-3-large | 3072 | ~$0.13 | Better MIRACL (~54.9 at launch) | Eval only; migration pain |
| **Cohere embed-v4** | 256–1536 | ~$0.10–0.12 | Leader 100+ langs / multimodal | **Best managed upgrade** |
| Voyage 3/4 family | 512–2048 | ~$0.02–0.18 | Strong EN retrieval | Optional EN polish |
| Google gemini / text-embedding-005 | ~768 | cheapest tier | Good budget | Alternative cloud |
| **BGE-M3** | 1024 | infra | Excellent MIRACL / dense+sparse | **Best VPS upgrade** |
| Jina v3 / E5-mistral / Nomic | varies | infra/API | Strong open multilingual | Alternatives to BGE-M3 |

Sources: [embeddings comparison 2026](https://crazyrouter.com/en/blog/ai-embeddings-comparison-2026-guide), [datarekha shootout](https://datarekha.com/blog/embeddings-2026-shootout/), [TECHSY Voyage/OpenAI/Cohere](https://techsy.io/en/blog/voyage-vs-openai-vs-cohere-embeddings).

**Original language vs translate-then-embed:** embed **original**. Multilingual models are trained for cross-lingual matching; MT adds errors on product terms ([Cohere multilingual notes](https://ucstrategies.com/news/cohere-embed-v3-multilingual-embedding-model-specs-benchmarks-2026/), [cross-lingual gap](https://tianpan.co/blog/2026-05-05-multilingual-rag-cross-lingual-retrieval-gap)). Generation prompt: answer in the **user's language** even if chunks are EN (or mixed).

### Retrieval / FTS

- Keep dense + sparse RRF.
- Today FTS is `to_tsvector('english', …)` — weak for AR/HI/ES morphology. Phase 1: add **`simple`** (or language-aware) FTS column / config; rely more on dense for non-Latin until then.
- Multilingual BM25 without analyzers is limited — hybrid dense compensates; do not expect English BM25 to save Arabic queries.
- **Query rewrite:** keep for pronouns; do **not** force English for dense embedding. Keywords for BM25: language-agnostic tokens + SKUs.
- HyDE: **off** (latency). Optional later for EN-only tenants if rewrite fails.

### Rerankers

| Option | Notes | Cost posture |
|--------|-------|--------------|
| Cohere Rerank 3.5 / 4 Fast | Strong multilingual; drop-in | ~$2 / 1K searches (≤100 docs) |
| bge-reranker-v2-m3 | Open, multilingual, VPS TEI | Infra |
| Voyage rerank | Strong EN pairing | Mid |

**P1 default cloud:** Cohere Rerank on top-40 hybrid hits → 5–8. **VPS path:** bge-reranker-v2-m3.

### Generation

| Situation | Behavior |
|-----------|----------|
| Flow / FAQ / cache hit | No RAG generator |
| Knowledge + good chunks | `gpt-4o-mini`; **reply in user language** |
| Empty / below floor | Template + handover — do not invent |
| Code-switching user | Match dominant language of latest utterance; keep product names verbatim |
| Arabic RTL | Send normal Unicode text; WhatsApp client handles RTL; avoid broken markdown tables |

Upgrade generators only after retrieval gates + rerank are in place (otherwise you pay more to hallucinate more confidently).

---

## 4. Voice I/O architecture

### Inbound (audio → text)

```
Meta voice note (media id/url)
  → download with Bearer access token (already in stt.ts for meta)
  → gpt-4o-mini-transcribe (default)
  → transcript + lang hint
  → same pipeline as text
```

| STT | ~$/min | Multilingual | When |
|-----|--------|--------------|------|
| **gpt-4o-mini-transcribe** | ~$0.003 | Strong; better than whisper-1 | **Default** |
| gpt-4o-transcribe | ~$0.006 | Best OpenAI accuracy | Noisy / low-conf retry |
| whisper-1 (current) | ~$0.006 | Good legacy | **Replace** |
| Deepgram Nova-3 | ~$0.004–0.008 | 40+ langs; excellent noise | High volume / noisy |
| AssemblyAI Universal | ~$0.004–0.006 | Broad | Alternative |
| Google Chirp 3 | higher / batch cheap | Strong multilingual | If already on GCP |
| Self-host Whisper large-v3 | infra | Good | Very high volume + GPU |

Sources: [APIScout STT 2026](https://apiscout.dev/guides/speech-to-text-api-comparison-2026), [Deepgram vs Whisper](https://apiscout.dev/guides/deepgram-vs-openai-whisper-2026), [OpenAI gpt-4o-mini-transcribe](https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe).

**STT edge gates:** empty transcript → “Please send as text”; very short (&lt;2–3 words) → still allow but lower cache aggressiveness; low confidence / garbage → text-only ask; never run RAG on empty string.

### Outbound (text → optional audio)

Meta Cloud API audio ([docs](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/audio-messages/)):

- Formats: AAC, AMR, MP3, M4A, **OGG with OPUS only**, mono, max **16 MB**.
- Voice-note UX: `.ogg` OPUS + `voice: true` (MetaProvider today only sets `link` — plan must add OPUS encode + voice flag).
- **No Meta “native TTS”** for Business API replies — you synthesize, upload/link, send.

| TTS | Cost | Langs | When |
|-----|------|-------|------|
| **None (text)** | $0 | all | **Default** |
| OpenAI TTS / gpt-4o-mini-tts | ~$15/1M chars (tts-1) | limited voices / expanding | **Opt-in default** if voice-out needed |
| Deepgram Aura | ~$15/1M chars | fewer langs | Latency-focused EN |
| Cartesia Sonic | mid | 15+ | Ultra-low latency agents |
| ElevenLabs | ~20× OpenAI | 30+ / best quality | Upgrade for naturalness |
| Self-host (e.g. Kokoro) | infra | often EN-first | Rarely worth it globally |

Sources: [APIScout TTS 2026](https://apiscout.dev/guides/elevenlabs-vs-openai-tts-vs-deepgram-aura-2026), [Awesome Agents TTS pricing](https://awesomeagents.ai/pricing/voice-tts-pricing/).

### When to stay text-only

- Tenant TTS disabled (default).
- STT confidence low / noisy / empty.
- Answer longer than ~400–500 chars (voice notes feel endless; send text or text+short voice summary).
- Low RAG confidence / handover (human prefers readable text).
- Outside 24h session window (templates only).
- Cost/plan caps exceeded.
- Tables, lists, codes, URLs (unusable in audio).
- Arabic/complex scripts where TTS quality fails eval — fall back to text.

### Pipeline summary

`voice note → STT → waterfall RAG (text) → [if voice-eligible] TTS → ffmpeg → mono OGG/OPUS → Meta audio (voice:true) + optional text caption`

---

## 5. Chunking strategy (ingest)

Same as Chosen stack: recursive + parent/child. Metadata:

```json
{
  "source_name": "Refund Policy v1.pdf",
  "document_id": "<uuid>",
  "tenant_id": "<uuid>",
  "page": 3,
  "heading": "Returns within 30 days",
  "chunk_index": 12,
  "language": "en|es|ar|hi|mixed",
  "char_start": 4021,
  "char_end": 4810
}
```

---

## 6. Retrieval redesign

### Keep from `match_knowledge_hybrid`

- Tenant filter, dense + sparse, RRF k=60, `content` + `context_window`, weight knobs.

### Change

| Knob | Today | Target |
|------|-------|--------|
| `topK` | 3 | First-stage **30–50**; final **5–8** after rerank |
| `minSimilarity` | Unused by hybrid | Post-RRF / post-rerank floor → empty → handover |
| Query for dense | Mixed | **`rewrittenQuery` original language** |
| Query for BM25 | Keywords / rewrite | Keywords + SKUs; `simple` FTS |
| Empty KB | Still calls generator | **Short-circuit** — no chunks → template/handover |
| Cache key | Often English translation | Prefer original rewritten query (language-stable) |

---

## 7. VPS vs cloud

| Option | Components | Verdict |
|--------|------------|---------|
| **A. Cloud baseline** | Supabase + OpenAI embed + mini + mini-transcribe | Status quo after STT upgrade |
| **B. Hybrid (recommended)** | Supabase DB + **VPS kb-ingest** (+ optional TEI) | **Do first** |
| **C. Self-host embeds/STT** | TEI BGE-M3; optional Whisper GPU | When multilingual quality or $/min dominates |
| **D. Full self-host** | vLLM + Qdrant + Redis | **Avoid** |
| **E. New vector DB** | Qdrant beside Postgres | **YAGNI** |

**When VPS wins globally:** sustained embed/STT volume where GPU amortized &lt; API; data residency; Cohere/OpenAI rate limits. Chat LLM usually stays cloud for Meta latency SLAs.

**Keep pgvector** — one source of truth with tenant RLS/RPC filters.

---

## 8. Ingestion pipeline (the missing piece)

### Queue (pg-boss)

```ts
boss.send('kb-ingest', { tenantId, documentId }, { retryLimit: 3, expireInHours: 24 })
```

| Step | Action | Failure |
|------|--------|---------|
| Lock | Claim if `processing` | Skip if `ready` |
| Fetch | Storage + tenant path check | `failed` |
| Parse | PDF/TXT/MD (+ page map) | `failed` |
| Chunk | Recursive child + parent | `failed` |
| Contextualize (P2) | Cheap LLM prefix | Continue without |
| Embed | Batch `getEmbedding` | Retry / `failed` |
| Replace | Delete old chunks for doc, insert | Transactional |
| Ready | `status = 'ready'` | — |

### Suggested files

| File | Role |
|------|------|
| `backend/src/services/kb/ingestWorker.ts` | pg-boss consumer |
| `backend/src/services/kb/chunker.ts` | recursive + parent windows |
| `backend/src/services/kb/parsers/pdf.ts` | extract text |
| `backend/src/services/llm/tts.ts` | (Phase voice) synthesize + OPUS encode |
| `backend/src/services/jobQueue.ts` | register `kb-ingest` |
| `MetaProvider.ts` | `voice: true` + OPUS-aware send |
| Migration | `error_message`, `chunk_count` on documents |

### Security checklist

- [ ] Job tenant matches `document.tenant_id`
- [ ] Service role only inside worker
- [ ] Cap file size / pages per plan
- [ ] Allowlist: pdf, txt, md, docx
- [ ] Never cross-tenant retrieve/cache/STT artifacts

---

## 9. Edge-case matrix

| Scenario | Mitigation |
|----------|------------|
| **Empty KB** / no chunks | Short-circuit before generator; template + optional handover |
| **Noisy / empty STT** | Retry once with `gpt-4o-transcribe` or ask user to type; never RAG on `""` |
| **Very short utterance** (“ok”, “؟”) | Conversational path; no KB; no TTS |
| **Code-switching** (Spanglish, Hinglish, Arabizi) | Multilingual embed on original; generator matches latest dominant lang; product names verbatim |
| **RTL Arabic** | Unicode text replies; avoid complex markdown; TTS opt-in only if Arabic voice passes eval |
| **Hallucination** | Retrieval floor + “ONLY use knowledge” + low-confidence handover; empty context never calls invent-mode |
| **Low confidence** | Existing handover path; do not TTS low-confidence answers |
| **24h session window** | Session free-form (text/audio) only inside window; else templates |
| **Multi-tenant isolation** | `p_tenant_id` on all RPCs; job payload check; cache scoped by tenant |
| **Cache language drift** | Key cache on original `rewrittenQuery`; do not mix EN translation of ES query with ES answer |
| **Long voice answers** | Cap TTS length; send text (or short audio summary + text) |
| **Outside plan quota** | Existing billing handover; skip STT/TTS when over cap |
| **Scanned PDF / no text** | Fail ingest with clear error; optional OCR flag later |
| **Exact SKU / order ID** | Hybrid BM25 + keyword normalization in router |

---

## 10. Cost model sketch (per knowledge message)

Assumptions: ~15s voice note; ~800-token prompt + 150-token completion; embed ~50 tokens query; optional TTS ~200 chars; prices mid-2025/2026 public list (verify before ship).

| Component | Text path | Voice-in → text-out | Voice-in → voice-out |
|-----------|-----------|---------------------|----------------------|
| STT | $0 | ~$0.045 (`mini-transcribe` @ $0.003/min × 15) | same |
| Query embed | ~$0.000001 | same | same |
| Rerank (P1) | ~$0.002 / search | same | same |
| Router + generator (`gpt-4o-mini`) | ~$0.0002–0.001 typical | same | same |
| TTS (OpenAI tts-1) | $0 | $0 | ~$0.003 for 200 chars |
| **Rough total** | **≪ $0.01** | **~$0.05** | **~$0.05–0.06** |

**Implications**

- Text RAG is cheap; **voice STT dominates** variable cost.
- Semantic cache + FAQ short-circuit save the generator (and avoid STT only if user sent text).
- TTS is small vs STT for short replies but multiplies with long answers — hence text-default.
- At 10k voice notes/month × 15s ≈ 2,500 min → ~$7.50 STT on mini-transcribe vs ~$15 on whisper-1.

Ingest is amortized: 1M embed tokens ≈ $0.02 on 3-small; contextual prefixes (P2) add LLM $ at index time once.

---

## 11. What to REJECT (and why)

| Idea | Why reject (now) |
|------|------------------|
| **GraphRAG** | Multi-hop entity graphs; SMB FAQ lookups don’t need community summaries; heavy index cost |
| **LLM-chunk-everything** | No consistent gain vs structure/recursive; 10–1000× slower ([arxiv 2602.16974](https://arxiv.org/abs/2602.16974)) |
| **Translate-all-to-English then embed** | MT errors on SKUs; extra latency; multilingual embeds exist |
| **HyDE / multi-query on every msg** | WhatsApp latency budget |
| **Qdrant/Weaviate beside Supabase** | Second source of truth; sync hell |
| **Full local LLM for chat** | Ops + p95 latency risk for Meta SLAs |
| **TTS on by default** | Cost + long-answer UX + OPUS pipeline complexity |
| **RAPTOR / ColBERT / Late chunking** | Until measured failure mode |
| **Web-search CRAG** | Tenant privacy + Meta SLA |
| **India-only / Hindi-only stack** | Product is global WhatsApp SaaS |

---

## 12. Phased migration (starts with `kb-ingest`)

### Phase 0 — Stop the bleeding (1–2 days)

- [ ] Implement `kb-ingest` worker end-to-end
- [ ] Wire enqueue from upload path
- [ ] Backfill all `processing` documents
- [ ] Verify `status → ready` and hybrid RPC returns rows

### Phase 1 — Retrieval + multilingual gates (3–5 days)

- [ ] Child/parent chunking at ingest
- [ ] Raise first-stage k; add reranker; final top 5–8
- [ ] Empty/low-score short-circuit
- [ ] Dense query = original `rewrittenQuery`; FTS → `simple` (or dual)
- [ ] Golden set **50–100** queries across EN/ES/PT/AR/FR/HI/ID
- [ ] STT: switch to `gpt-4o-mini-transcribe`; empty-transcript gate

### Phase 2 — Contextual ingest + voice-out opt-in (optional)

- [ ] 50–100 token situating prefixes before embed + FTS
- [ ] Tenant flag: voice reply when inbound voice + short + high confidence
- [ ] OpenAI TTS → mono OGG/OPUS → Meta `voice: true`
- [ ] Re-ingest tenant corpus after contextual change

### Phase 3 — Only if measured need

- [ ] Multilingual embedder migration (Cohere embed-v4 or BGE-M3) + full re-embed
- [ ] Deepgram/ElevenLabs if STT/TTS evals fail
- [ ] One of late chunking / RAPTOR / GraphRAG — pick **one** failure mode

### Explicit non-goals (near term)

- Replacing Supabase with Qdrant
- Training Self-RAG
- Web-search CRAG
- Multi-vector ColBERT indexes
- Always-on TTS

---

## 13. File map (implementation reference)

| Area | Files |
|------|-------|
| Ingest (new) | `backend/src/services/kb/ingestWorker.ts`, `chunker.ts`, `parsers/*` |
| Embed / retrieve | `kb/embeddings.ts`, `retrieval.ts`, `semanticCache.ts` |
| Pipeline | `automation/pipeline.ts`, `agentRouter.ts`, `faqMatcher.ts`, `handover.ts` |
| STT / TTS | `llm/stt.ts`, (new) `llm/tts.ts`, `messageHandler.ts` |
| Meta audio | `bsp/MetaProvider.ts` |
| Generate | `llm/generator.ts` |
| Queue | `jobQueue.ts` |
| UI | `KnowledgeBaseManager.tsx` |
| SQL | `20260704000004_knowledge_base.sql`, `20260716000015_ultimate_rag.sql`, future ingest/FTS columns |
| Seed (dev only) | `scripts/seed_kb.ts` |

---

## Sources (latest / primary)

1. Anthropic — Contextual Retrieval: https://www.anthropic.com/engineering/contextual-retrieval  
2. Cadence — Production RAG 2026: https://cadence.withremote.ai/blog/production-rag-architecture  
3. Atlan — Advanced RAG Techniques 2026: https://atlan.com/know/advanced-rag-techniques/  
4. Firecrawl — Best chunking strategies 2026: https://www.firecrawl.dev/blog/best-chunking-strategies-rag  
5. arXiv 2602.16974 — Chunking taxonomy (LLM chunkers vs structure): https://arxiv.org/abs/2602.16974  
6. GraphRAG trenches — Microsoft DS: https://medium.com/data-science-at-microsoft/graphrag-beyond-the-demo-lessons-from-the-trenches-add83180f849  
7. RAG vs GraphRAG 2026: https://cruxdigits.nl/blog/rag-vs-graphrag-2026/  
8. Embeddings 2026 comparisons: https://crazyrouter.com/en/blog/ai-embeddings-comparison-2026-guide · https://datarekha.com/blog/embeddings-2026-shootout/ · https://techsy.io/en/blog/voyage-vs-openai-vs-cohere-embeddings  
9. Multilingual embed original language: https://ucstrategies.com/news/cohere-embed-v3-multilingual-embedding-model-specs-benchmarks-2026/ · https://tianpan.co/blog/2026-05-05-multilingual-rag-cross-lingual-retrieval-gap  
10. STT 2026: https://apiscout.dev/guides/speech-to-text-api-comparison-2026 · https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe  
11. TTS 2026: https://apiscout.dev/guides/elevenlabs-vs-openai-tts-vs-deepgram-aura-2026 · https://awesomeagents.ai/pricing/voice-tts-pricing/  
12. Meta WhatsApp audio messages: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/audio-messages/  
13. Cohere Rerank pricing: https://cohere.com/pricing · https://www.metacto.com/blogs/cohere-pricing-explained-a-deep-dive-into-integration-development-costs  
14. HF TEI: https://huggingface.co/docs/text-embeddings-inference/quick_tour  

---

## Success criteria

1. Upload in KB UI → document reaches `ready` with ≥1 chunk without `seed_kb.ts`.
2. Golden-set grounded answers across **EN + ≥3 other WhatsApp languages** meet Recall@5 / answerable targets.
3. FAQ/flow still short-circuit before RAG (no latency/cost regression).
4. Empty KB / low score / empty STT → handover or clarify — **not** hallucination.
5. Voice-in works via mini-transcribe; voice-out only behind tenant flag with OPUS + Meta constraints.
6. No second vector database without written cost/ops justification.

---

## Next steps

Execute task-by-task from **[`2026-07-25-rag-implementation.md`](./2026-07-25-rag-implementation.md)** (Phase 1 `kb-ingest` first; do not start optional rerank/TTS until ingest + retrieval gates work).
