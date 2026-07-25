import type { RetrievedChunk } from './retrieval';

/**
 * Optional cross-encoder rerank (Cohere). Off by default — set ENABLE_RERANK=true + COHERE_API_KEY.
 */
export async function rerankChunks(
  query: string,
  chunks: RetrievedChunk[],
  topN = 6
): Promise<RetrievedChunk[]> {
  if (process.env.ENABLE_RERANK !== 'true' || !process.env.COHERE_API_KEY) {
    return chunks.slice(0, topN);
  }

  if (chunks.length === 0) return [];

  try {
    const model = process.env.COHERE_RERANK_MODEL || 'rerank-v3.5';
    const response = await fetch('https://api.cohere.com/v1/rerank', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        query,
        documents: chunks.map((c) => c.content),
        top_n: Math.min(topN, chunks.length),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[rerank] Cohere API error:', response.status, body);
      return chunks.slice(0, topN);
    }

    const data = (await response.json()) as {
      results?: Array<{ index: number; relevance_score: number }>;
    };

    const ranked = (data.results ?? [])
      .filter((r) => r.index >= 0 && r.index < chunks.length)
      .map((r) => ({
        ...chunks[r.index],
        similarity: r.relevance_score,
      }));

    return ranked.length > 0 ? ranked.slice(0, topN) : chunks.slice(0, topN);
  } catch (err) {
    console.error('[rerank] Failed, falling back to slice:', err);
    return chunks.slice(0, topN);
  }
}
