import { supabaseAdmin } from '../../lib/supabase';
import { getEmbedding } from './embeddings';
import OpenAI from 'openai';
const openai = new OpenAI();

/**
 * Semantic Caching
 * 
 * Checks if a semantically similar question was asked and answered recently.
 * If cosine similarity > 0.95, it returns the cached response, saving LLM tokens.
 */
export async function checkSemanticCache(tenantId: string, queryText: string, threshold: number = 0.95): Promise<string | null> {
  try {
    const queryEmbedding = await getEmbedding(queryText);
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    const { data, error } = await supabaseAdmin.rpc('match_semantic_cache', {
      query_embedding: embeddingString,
      match_threshold: threshold,
      p_tenant_id: tenantId
    });

    if (error) {
      console.error('Error checking semantic cache:', error);
      return null;
    }

    if (data && data.length > 0) {
      console.log(`[Semantic Cache] Hit! Returning cached response for query: "${queryText}"`);
      return data[0].response;
    }

    return null;
  } catch (error) {
    console.error('Error in semantic cache lookup:', error);
    return null;
  }
}

/**
 * Saves a new response to the semantic cache after a successful LLM generation.
 */
export async function setSemanticCache(tenantId: string, queryText: string, response: string) {
  try {
    const queryEmbedding = await getEmbedding(queryText);
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    // Cache Poisoning Prevention (Edge Case Fix)
    const moderation = await openai.moderations.create({ input: response });
    if (moderation.results[0].flagged) {
      console.warn(`[Semantic Cache] Security Warning: AI response for "${queryText}" was flagged by moderation API. Refusing to cache to prevent poisoning.`);
      return;
    }

    const { error } = await supabaseAdmin.from('semantic_cache').insert({
      tenant_id: tenantId,
      query_embedding: embeddingString,
      response: response
    });

    if (error) {
      console.error('Error setting semantic cache:', error);
    }
  } catch (error) {
    console.error('Error in semantic cache insert:', error);
  }
}
