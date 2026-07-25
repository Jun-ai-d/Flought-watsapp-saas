/**
 * Knowledge Base Retrieval (RAG)
 * 
 * This module is responsible for the "Retrieval" portion of Retrieval-Augmented Generation (RAG).
 * When a customer asks a question, this service converts their text into a high-dimensional vector,
 * and searches Postgres for the most semantically similar knowledge chunks.
 */

import { supabaseAdmin } from '../../lib/supabase';
import { getEmbedding } from './embeddings';
import { rerankChunks } from './rerank';

export interface RetrievedChunk {
  id: string;
  content: string;
  similarity: number;
}

/**
 * Executes a K-Nearest Neighbor (KNN) search natively in Postgres.
 * @param tenantId The ID of the business
 * @param query The customer's raw question
 * @param topK First-stage hybrid match count (default: 40)
 * @param minSimilarity RRF score floor — hybrid returns small fused scores, not cosine (default: 0.01)
 */
export async function retrieveRelevantChunks(tenantId: string, query: string, topK: number = 40, minSimilarity: number = 0.01): Promise<RetrievedChunk[]> {
  try {
    // 1. Generate an embedding vector (e.g., 1536 dimensions) for the user's query using OpenAI or a local model.
    const queryEmbedding = await getEmbedding(query);
    
    // Convert the Javascript array to a Postgres vector string format
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    // 2. Offload the hybrid search math to Postgres using `pgvector` + `BM25`.
    const { data: chunks, error } = await supabaseAdmin
      .rpc('match_knowledge_hybrid', {
        query_text: query,
        query_embedding: embeddingString,
        match_count: topK,
        p_tenant_id: tenantId // Strictly scopes the search to the correct tenant (Security)
      });
      
    if (error) {
      console.error('Error fetching knowledge chunks via RPC:', error);
      return [];
    }
    
    if (!chunks || chunks.length === 0) return [];
    
    const mapped = chunks.map((chunk: { id: string; content: string; context_window?: string; similarity: number }) => ({
      id: chunk.id,
      content: chunk.context_window || chunk.content, // Small-to-Big Retrieval
      similarity: chunk.similarity
    }));

    const filtered = mapped.filter((c: RetrievedChunk) => c.similarity >= minSimilarity);
    return rerankChunks(query, filtered, 6);

  } catch (error) {
    console.error('Error in retrieval:', error);
    return [];
  }
}
