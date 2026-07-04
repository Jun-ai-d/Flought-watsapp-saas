import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = 'postgresql://postgres:Junaidkhan7798@[2406:da1c:4c7:f801::b6f]:5432/postgres';

if (!connectionString) {
  console.error('Missing DATABASE_URL in .env');
  process.exit(1);
}

const sql = `
-- Drop existing function if it exists to allow re-creation
DROP FUNCTION IF EXISTS match_knowledge_chunks;

CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_tenant_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kc.id,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE kc.tenant_id = filter_tenant_id
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;
`;

async function main() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to DB');
    await client.query(sql);
    console.log('✅ Created match_knowledge_chunks RPC function');
  } catch (error) {
    console.error('❌ Error creating RPC:', error);
  } finally {
    await client.end();
  }
}

main();
