import OpenAI from 'openai';

// We initialize openai without a key here, it will automatically pick up OPENAI_API_KEY from process.env
// Embeddings require the real OpenAI API, not OpenRouter
const openai = new OpenAI({
  baseURL: 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_STT_KEY || process.env.OPENAI_API_KEY
});

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.replace(/\n/g, ' '),
  });
  return response.data[0].embedding;
}
