-- 1. Semantic Caching Table
CREATE TABLE IF NOT EXISTS semantic_cache (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade not null,
  query_embedding vector(1536) not null,
  response text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE INDEX IF NOT EXISTS idx_semantic_cache_tenant ON semantic_cache(tenant_id);
-- HNSW index for ultra-fast vector search on cache
CREATE INDEX IF NOT EXISTS idx_semantic_cache_embedding ON semantic_cache USING hnsw (query_embedding vector_cosine_ops);

-- Enable RLS
ALTER TABLE semantic_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants can access own semantic cache" ON semantic_cache FOR ALL USING (tenant_id = auth.uid());

-- 2. Small-to-Big Retrieval Schema (Sentence Windowing)
-- We add a context_window column to hold the larger paragraph.
-- The existing `content` column will now represent the small "Sentence Chunk".
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS context_window text;

-- Add FTS column for BM25 hybrid search
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS fts tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_fts ON knowledge_chunks USING GIN (fts);

-- 3. Semantic Cache Match Function
CREATE OR REPLACE FUNCTION match_semantic_cache(
  query_embedding vector(1536),
  match_threshold float,
  p_tenant_id uuid
)
RETURNS TABLE (
  id uuid,
  response text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.id,
    sc.response,
    1 - (sc.query_embedding <=> query_embedding) AS similarity
  FROM semantic_cache sc
  WHERE sc.tenant_id = p_tenant_id
    AND 1 - (sc.query_embedding <=> query_embedding) > match_threshold
  ORDER BY sc.query_embedding <=> query_embedding
  LIMIT 1;
END;
$$;

-- 4. Hybrid Search Function (Vector + BM25 with Reciprocal Rank Fusion)
CREATE OR REPLACE FUNCTION match_knowledge_hybrid(
  query_text text,
  query_embedding vector(1536),
  match_count int,
  p_tenant_id uuid,
  full_text_weight float DEFAULT 1.0,
  semantic_weight float DEFAULT 1.0,
  rrf_k int DEFAULT 60
)
RETURNS TABLE (
  id uuid,
  content text,
  context_window text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH full_text AS (
    SELECT
      kc.id,
      ROW_NUMBER() OVER(ORDER BY ts_rank_cd(kc.fts, websearch_to_tsquery('english', query_text)) DESC) AS rank_ix
    FROM knowledge_chunks kc
    WHERE kc.tenant_id = p_tenant_id
      AND kc.fts @@ websearch_to_tsquery('english', query_text)
    ORDER BY rank_ix
    LIMIT LEAST(match_count * 2, 50)
  ),
  semantic AS (
    SELECT
      kc.id,
      ROW_NUMBER() OVER(ORDER BY kc.embedding <=> query_embedding) AS rank_ix
    FROM knowledge_chunks kc
    WHERE kc.tenant_id = p_tenant_id
    ORDER BY rank_ix
    LIMIT LEAST(match_count * 2, 50)
  )
  SELECT
    kc.id,
    kc.content,
    kc.context_window,
    -- Reciprocal Rank Fusion (RRF) score
    COALESCE(1.0 / (rrf_k + f.rank_ix), 0.0) * full_text_weight +
    COALESCE(1.0 / (rrf_k + s.rank_ix), 0.0) * semantic_weight AS similarity
  FROM knowledge_chunks kc
  LEFT JOIN full_text f ON f.id = kc.id
  LEFT JOIN semantic s ON s.id = kc.id
  WHERE kc.tenant_id = p_tenant_id AND (f.id IS NOT NULL OR s.id IS NOT NULL)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
