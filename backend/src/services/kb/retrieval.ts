/**
 * Knowledge Base Retrieval (RAG)
 * 
 * This module is responsible for the "Retrieval" portion of Retrieval-Augmented Generation (RAG).
 * When a customer asks a question, this service converts their text into a high-dimensional vector,
 * and searches Postgres for the most semantically similar knowledge chunks.
 */

import { supabaseAdmin } from '../../lib/supabase';
import { getEmbedding } from './embeddings';

export interface RetrievedChunk {
  id: string;
  content: string;
  similarity: number;
}

/**
 * Executes a K-Nearest Neighbor (KNN) search natively in Postgres.
 * @param tenantId The ID of the business
 * @param query The customer's raw question
 * @param topK The maximum number of chunks to return (default: 3)
 * @param minSimilarity The threshold to filter out irrelevant chunks (default: 0.3)
 */
export async function retrieveRelevantChunks(tenantId: string, query: string, topK: number = 3, minSimilarity: number = 0.3): Promise<RetrievedChunk[]> {
  try {
    // 1. Generate an embedding vector (e.g., 1536 dimensions) for the user's query using OpenAI or a local model.
    const queryEmbedding = await getEmbedding(query);
    
    // Convert the Javascript array to a Postgres vector string format
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    // 2. Offload the cosine similarity math to Postgres using `pgvector`.
    // Why? Doing vector math in Node.js on thousands of rows causes massive memory bloat.
    // The `match_knowledge_chunks` RPC function uses the `<=>` operator directly at the data layer.
    const { data: chunks, error } = await supabaseAdmin
      .rpc('match_knowledge_chunks', {
        query_embedding: embeddingString,
        match_threshold: minSimilarity,
        match_count: topK,
        p_tenant_id: tenantId // Strictly scopes the search to the correct tenant (Security)
      });
      
    if (error) {
      console.error('Error fetching knowledge chunks via RPC:', error);
      return [];
    }
    
    if (!chunks || chunks.length === 0) return [];
    
    return chunks.map((chunk: any) => ({
      id: chunk.id,
      content: chunk.content,
      similarity: chunk.similarity
    }));

  } catch (error) {
    console.error('Error in retrieval:', error);
    return [];
  }
}
