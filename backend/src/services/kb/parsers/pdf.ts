import type { ParsedDocument } from './txt';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse') as (b: Buffer) => Promise<{ text: string }>;

export async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  const result = await pdf(buffer);
  const text = (result.text || '').replace(/\u0000/g, '').trim();
  if (!text) {
    throw new Error('PDF produced no extractable text (scanned PDFs need OCR — not supported yet)');
  }
  return { text, pages: undefined };
}
