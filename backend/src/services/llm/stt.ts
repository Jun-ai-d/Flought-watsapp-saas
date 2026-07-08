import OpenAI, { toFile } from 'openai';

// STT requires the real OpenAI Whisper API, not OpenRouter.
// We create a dedicated client that explicitly uses api.openai.com.
const sttClient = new OpenAI({
  baseURL: 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_STT_KEY || process.env.OPENAI_API_KEY
});

export async function transcribeAudio(mediaUrl: string, providerName?: string, accessToken?: string): Promise<string> {
  try {
    const headers: Record<string, string> = {};
    if (providerName === 'meta' && accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    } else {
      headers['apikey'] = process.env.GUPSHUP_API_KEY || '';
    }
    const response = await fetch(mediaUrl, { headers });
    if (!response.ok) throw new Error(`Failed to fetch media: ${response.statusText}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const file = await toFile(buffer, 'audio.ogg');
    
    const transcription = await sttClient.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });
    
    return transcription.text;
  } catch (error) {
    console.error('STT Error:', error);
    return '';
  }
}
