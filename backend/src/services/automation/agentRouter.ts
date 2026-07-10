import OpenAI from 'openai';
const openai = new OpenAI();

export type IntentCategory = 'conversational' | 'knowledge' | 'actionable';

export interface RouteDecision {
  categories: IntentCategory[];
  rewrittenQuery?: string;
  englishTranslation?: string;
  normalizedKeywords?: string[];
  reasoning: string;
}

/**
 * Adaptive Agent Router
 * 
 * Analyzes the incoming message and the recent history to determine the optimal processing path.
 * It also rewrites the query if context is missing (e.g., resolving pronouns).
 */
export async function routeMessageIntent(
  messageText: string, 
  history: { direction: 'inbound' | 'outbound', content: string }[]
): Promise<RouteDecision> {
  const systemPrompt = `You are an intelligent router for a WhatsApp business chatbot.
Your goal is to classify the user's latest message into one or more of three categories:
1. "conversational": Greetings, small talk, thank yous, or farewells that don't require searching the knowledge base.
2. "knowledge": Questions about the business, products, policies, or general inquiries that require reading FAQs or PDFs.
3. "actionable": Requests that require checking a database or taking an action (e.g., "where is my order", "cancel my subscription", "book an appointment").

If the user's message contains multiple distinct intents (e.g. "cancel my order and what are your hours?"), return multiple categories.

Additionally:
- Rewrite the user's latest query into a standalone search string by resolving any pronouns based on the chat history.
- Provide an English translation of the rewritten query (if it's already English, just copy it).
- Extract normalized keywords for full-text search. Strip all hyphens, spaces, and punctuation from product identifiers (e.g., "SKU-123" -> "sku123").

Output strict JSON:
{
  "categories": ["conversational" | "knowledge" | "actionable"],
  "rewrittenQuery": "...",
  "englishTranslation": "...",
  "normalizedKeywords": ["keyword1", "keyword2"],
  "reasoning": "brief explanation"
}`;

  const historyText = history.slice(-3).map(h => `${h.direction === 'inbound' ? 'User' : 'Bot'}: ${h.content}`).join('\n');
  const userPrompt = `Recent History:\n${historyText}\n\nLatest User Message: ${messageText}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    });

    const result = JSON.parse(response.choices[0].message.content || '{}') as RouteDecision;
    return {
      categories: result.categories || ['knowledge'],
      rewrittenQuery: result.rewrittenQuery || messageText,
      englishTranslation: result.englishTranslation || messageText,
      normalizedKeywords: result.normalizedKeywords || [],
      reasoning: result.reasoning || ''
    };
  } catch (error) {
    console.error('Error in agent router:', error);
    // Safe fallback to knowledge retrieval
    return { categories: ['knowledge'], rewrittenQuery: messageText, englishTranslation: messageText, normalizedKeywords: [], reasoning: 'fallback' };
  }
}
