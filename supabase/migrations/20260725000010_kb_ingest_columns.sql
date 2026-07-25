-- KB ingest observability
ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS chunk_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

COMMENT ON COLUMN public.knowledge_documents.error_message IS 'Last ingest failure message; null when ready/processing';
COMMENT ON COLUMN public.knowledge_documents.chunk_count IS 'Number of knowledge_chunks after successful ingest';
