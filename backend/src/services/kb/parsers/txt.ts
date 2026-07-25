export type ParsedDocument = {
  text: string;
  pages?: Array<{ page: number; text: string }>;
};

/** Extract UTF-8 text from .txt / .md buffers. */
export function parsePlainText(buffer: Buffer): ParsedDocument {
  const text = buffer.toString('utf8').replace(/\u0000/g, '').trim();
  if (!text) throw new Error('Empty text document');
  return { text };
}
