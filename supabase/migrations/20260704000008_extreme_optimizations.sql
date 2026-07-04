-- 1. Upgrade vector search index to HNSW for drastically better recall and performance
DROP INDEX IF EXISTS idx_chunks_embedding;
CREATE INDEX idx_chunks_embedding ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

-- 2. Add missing foreign key index to prevent full table scans on assigned agent queries or deletes
CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(assigned_agent_id);

-- 3. Add JSONB GIN index to allow lightning fast pre-filtering by source before vector math
CREATE INDEX IF NOT EXISTS idx_chunks_metadata ON knowledge_chunks USING gin (metadata);
