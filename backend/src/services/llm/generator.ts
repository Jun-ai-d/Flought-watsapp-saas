/**
 * LLM Generator (RAG)
 * 
 * This module takes the customer's query and the relevant knowledge chunks (from retrieval.ts),
 * and constructs a Prompt for an LLM (Claude Haiku / GPT-4o-mini).
 * 
 * It forces the LLM to output structured JSON with a 'confidence' score so we know
 * whether to send the message or hand it over to a human agent.
 */

import OpenAI from 'openai';
import { RetrievedChunk } from '../kb/retrieval';

// Initialize OpenAI client
// Note: We use the OpenAI SDK because it's industry-standard, but we can point it to Anthropic/OpenRouter 
// by setting OPENAI_BASE_URL="https://openrouter.ai/api/v1" in .env
const openai = new OpenAI();

export interface ChatMessage {
  direction: 'inbound' | 'outbound';
  content: string;
}

export interface LLMResponse {
  content: string;
  confidence: 'high' | 'low';
}

/**
 * Generates the final AI response using strict JSON mode.
 * @param query The customer's raw WhatsApp message
 * @param chunks The top-K similar chunks retrieved from Postgres
 * @param tenantBusinessName The name of the business to give the AI context
 * @param history The last N messages in the conversation for contextual memory
 */
export async function generateRAGResponse(query: string, chunks: RetrievedChunk[], tenantBusinessName: string, history: ChatMessage[] = []): Promise<LLMResponse> {
  // Join the retrieved chunks into a single text block to inject into the prompt
  const contextText = chunks.map(c => c.content).join('\n\n');
  
  // Format the conversation history for the LLM
  let historyText = "No previous conversation.";
  if (history.length > 0) {
    historyText = history.map(msg => 
      msg.direction === 'inbound' ? `Customer: ${msg.content}` : `Bot: ${msg.content}`
    ).join('\n');
  }
  
  // This System Prompt establishes the strict RAG boundaries.
  // Rule #2 prevents hallucination by explicitly ordering the AI to fail gracefully.
  const systemPrompt = `You are a helpful customer service assistant for ${tenantBusinessName} on WhatsApp.
Your goal is to answer the customer's query using ONLY the provided knowledge base context.

<knowledge_base>
${contextText}
</knowledge_base>

<conversation_history>
${historyText}
</conversation_history>

Rules:
1. Be concise, friendly, and conversational (WhatsApp style).
2. Do NOT hallucinate. If the answer is not contained in the <knowledge_base> context, you must respond with EXACTLY "I'm sorry, I don't have that information. Let me transfer you to a human agent."
3. Do NOT mention that you are an AI or reading from a context block.
4. Use the <conversation_history> to understand what the customer is referring to if they use pronouns like "it" or "that".

You must return a JSON object with two fields:
- "content": Your response text for the customer.
- "confidence": "high" if you found a clear answer in the context, "low" if the context was missing the answer or you had to apologize.
`;

  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const completion = await openai.chat.completions.create({
        model: process.env.LLM_MODEL || 'gpt-4o-mini', 
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      let responseContent = completion.choices[0]?.message?.content || '{}';
      responseContent = responseContent.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(responseContent);

      return {
        content: parsed.content || "I'm sorry, I couldn't process that.",
        confidence: parsed.confidence || 'low'
      };
    } catch (error: any) {
      attempt++;
      console.error(`Error generating LLM response (attempt ${attempt}/${maxRetries}):`, error);
      
      // If it's a 429 or 5xx, wait and retry. Otherwise break.
      if (error?.status === 429 || error?.status >= 500) {
        if (attempt >= maxRetries) break;
        // Exponential backoff: 1s, 2s, 4s...
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
      } else {
        break; // Don't retry 400 Bad Request, etc.
      }
    }
  }

  // If we exhausted retries or hit an unrecoverable error
  return {
    content: "I'm sorry, I'm having trouble connecting right now. Let me transfer you to a human agent.",
    confidence: 'low'
  };
}
