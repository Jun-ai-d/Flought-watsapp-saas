import OpenAI, { toFile } from 'openai';

const openai = new OpenAI();

export async function transcribeAudio(mediaUrl: string): Promise<string> {
  try {
    const response = await fetch(mediaUrl);
    if (!response.ok) throw new Error(`Failed to fetch media: ${response.statusText}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const file = await toFile(buffer, 'audio.ogg');
    
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });
    
    return transcription.text;
  } catch (error) {
    console.error('STT Error:', error);
    return '';
  }
}
