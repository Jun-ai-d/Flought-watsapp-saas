import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { supabaseAdmin } from '../../lib/supabase';

const ttsClient = new OpenAI({
  baseURL: 'https://api.openai.com/v1',
  apiKey: process.env.OPENAI_API_KEY,
});

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const TTS_BUCKET = 'knowledge_base';

let ffmpegAvailable: boolean | null = null;

function runCommand(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { stdio: 'ignore' });
    proc.on('error', () => resolve(-1));
    proc.on('close', (code) => resolve(code ?? -1));
  });
}

/** Check once per process whether ffmpeg is on PATH (or FFMPEG_PATH). */
export async function isFfmpegAvailable(): Promise<boolean> {
  if (ffmpegAvailable !== null) return ffmpegAvailable;
  const code = await runCommand(FFMPEG, ['-version']);
  ffmpegAvailable = code === 0;
  if (!ffmpegAvailable) {
    console.warn('[TTS] ffmpeg not found — voice replies will fall back to text');
  }
  return ffmpegAvailable;
}

async function convertToMonoOggOpus(inputBuffer: Buffer): Promise<Buffer | null> {
  const id = randomUUID();
  const inputPath = path.join(os.tmpdir(), `tts-${id}.mp3`);
  const outputPath = path.join(os.tmpdir(), `tts-${id}.ogg`);

  try {
    await fs.writeFile(inputPath, inputBuffer);

    const code = await new Promise<number>((resolve) => {
      const proc = spawn(
        FFMPEG,
        ['-y', '-i', inputPath, '-ac', '1', '-c:a', 'libopus', '-b:a', '16k', outputPath],
        { stdio: 'ignore' }
      );
      proc.on('error', () => resolve(-1));
      proc.on('close', (exitCode) => resolve(exitCode ?? -1));
    });

    if (code !== 0) return null;
    return await fs.readFile(outputPath);
  } catch (error) {
    console.error('[TTS] ffmpeg conversion error:', error);
    return null;
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}

/** OpenAI TTS → mono OGG/OPUS buffer. Returns null on any failure. */
export async function synthesizeVoiceNote(text: string, maxChars: number): Promise<Buffer | null> {
  const capped = text.slice(0, maxChars).trim();
  if (!capped) return null;

  if (!(await isFfmpegAvailable())) return null;

  try {
    const response = await ttsClient.audio.speech.create({
      model: process.env.TTS_MODEL || 'tts-1',
      voice: (process.env.TTS_VOICE as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer') || 'alloy',
      input: capped,
      response_format: 'mp3',
    });

    const mp3Buffer = Buffer.from(await response.arrayBuffer());
    return await convertToMonoOggOpus(mp3Buffer);
  } catch (error) {
    console.error('[TTS] Synthesis error:', error);
    return null;
  }
}

/** Upload voice note to Storage and return a signed URL for Meta. */
export async function uploadVoiceNote(tenantId: string, audioBuffer: Buffer): Promise<string | null> {
  const filePath = `${tenantId}/tts/${randomUUID()}.ogg`;

  const { error } = await supabaseAdmin.storage.from(TTS_BUCKET).upload(filePath, audioBuffer, {
    contentType: 'audio/ogg',
    upsert: false,
  });

  if (error) {
    console.error('[TTS] Storage upload error:', error);
    return null;
  }

  const { data, error: signErr } = await supabaseAdmin.storage
    .from(TTS_BUCKET)
    .createSignedUrl(filePath, 3600);

  if (signErr || !data?.signedUrl) {
    console.error('[TTS] Signed URL error:', signErr);
    return null;
  }

  return data.signedUrl;
}

export type VoiceReplySettings = {
  voice_replies?: boolean;
  voice_max_chars?: number;
};

export function isVoiceReplyEligible(
  text: string,
  source: 'faq' | 'rag' | 'flow',
  wasAudioInbound: boolean,
  allowVoice: boolean,
  aiSettings?: VoiceReplySettings
): boolean {
  if (!allowVoice || source !== 'rag' || !wasAudioInbound) return false;
  if (aiSettings?.voice_replies !== true) return false;
  const maxChars = typeof aiSettings.voice_max_chars === 'number' ? aiSettings.voice_max_chars : 400;
  return text.length > 0 && text.length <= maxChars;
}
