export type ChunkPiece = {
  content: string;
  context_window: string;
  metadata: {
    source_name: string;
    document_id: string;
    tenant_id: string;
    chunk_index: number;
    heading?: string;
    language?: string;
    char_start: number;
    char_end: number;
  };
};

export type ChunkOptions = {
  sourceName: string;
  documentId: string;
  tenantId: string;
  childChars?: number;
  parentChars?: number;
  overlapChars?: number;
  minChars?: number;
};

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function isHeadingLine(line: string): boolean {
  if (/^#{1,6}\s+/.test(line)) return true;
  const trimmed = line.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length < 80 &&
    trimmed === trimmed.toUpperCase() &&
    /[A-Z]/.test(trimmed)
  );
}

function splitBlocks(text: string): Array<{ heading?: string; text: string }> {
  const lines = text.split('\n');
  const blocks: Array<{ heading?: string; text: string }> = [];
  let heading: string | undefined;
  let buffer: string[] = [];

  const flush = () => {
    const joined = buffer.join('\n').trim();
    if (joined) blocks.push({ heading, text: joined });
    buffer = [];
  };

  for (const line of lines) {
    if (isHeadingLine(line)) {
      flush();
      heading = line.replace(/^#{1,6}\s+/, '').trim();
      continue;
    }
    buffer.push(line);
  }
  flush();

  return blocks.length > 0 ? blocks : [{ text }];
}

function splitParagraphs(blockText: string): string[] {
  return blockText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
}

function hardSplit(text: string, maxChars: number, overlapChars: number): string[] {
  const parts: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const slice = text.slice(start, end);
      const breakAt = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('\n'));
      if (breakAt > maxChars * 0.4) end = start + breakAt + 1;
    }
    const piece = text.slice(start, end).trim();
    if (piece) parts.push(piece);
    if (end >= text.length) break;
    start = Math.max(start + 1, end - overlapChars);
  }
  return parts;
}

function packChildChunks(
  paragraphs: string[],
  childChars: number,
  overlapChars: number
): string[] {
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (para.length > childChars) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      chunks.push(...hardSplit(para, childChars, overlapChars));
      continue;
    }

    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length <= childChars) {
      current = candidate;
    } else {
      chunks.push(current);
      current = para;
    }
  }

  if (current) chunks.push(current);

  if (overlapChars <= 0 || chunks.length <= 1) return chunks;

  const overlapped = [chunks[0]];
  for (let i = 1; i < chunks.length; i++) {
    const tail = chunks[i - 1].slice(-overlapChars);
    overlapped.push(`${tail}\n\n${chunks[i]}`.trim());
  }
  return overlapped;
}

function mergeSmallChunks(chunks: string[], minChars: number): string[] {
  if (chunks.length <= 1) return chunks;

  const merged: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length < minChars && merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}\n\n${chunk}`;
    } else {
      merged.push(chunk);
    }
  }

  if (merged.length > 1) {
    return merged.filter((c, i) => c.length >= minChars || i === merged.length - 1);
  }
  return merged;
}

function parentWindow(fullText: string, start: number, end: number, parentChars: number): string {
  const center = Math.floor((start + end) / 2);
  const half = Math.floor(parentChars / 2);
  const winStart = Math.max(0, center - half);
  const winEnd = Math.min(fullText.length, center + half);
  const window = fullText.slice(winStart, winEnd).trim();
  return window.length >= end - start ? window : fullText.slice(start, end);
}

export function chunkDocument(text: string, opts: ChunkOptions): ChunkPiece[] {
  const childChars = opts.childChars ?? 1800;
  const parentChars = opts.parentChars ?? 5600;
  const overlapChars = opts.overlapChars ?? 200;
  const minChars = opts.minChars ?? 200;

  const normalized = normalizeText(text);
  if (!normalized) return [];

  const blocks = splitBlocks(normalized);
  const paragraphs: Array<{ text: string; heading?: string }> = [];
  for (const block of blocks) {
    for (const para of splitParagraphs(block.text)) {
      paragraphs.push({ text: para, heading: block.heading });
    }
  }

  const sourceParagraphs = paragraphs.length > 0 ? paragraphs.map((p) => p.text) : [normalized];
  const childTexts = mergeSmallChunks(
    packChildChunks(sourceParagraphs, childChars, overlapChars),
    minChars
  );

  if (childTexts.length === 0) return [];

  const pieces: ChunkPiece[] = [];
  let searchFrom = 0;

  for (let i = 0; i < childTexts.length; i++) {
    const content = childTexts[i];
    let charStart = normalized.indexOf(content, searchFrom);
    if (charStart < 0) charStart = searchFrom;
    const charEnd = charStart + content.length;
    searchFrom = charStart + 1;

    const heading =
      paragraphs.find((p) => p.text === content || content.includes(p.text.slice(0, 80)))?.heading;

    pieces.push({
      content,
      context_window: parentWindow(normalized, charStart, charEnd, parentChars),
      metadata: {
        source_name: opts.sourceName,
        document_id: opts.documentId,
        tenant_id: opts.tenantId,
        chunk_index: i,
        heading,
        char_start: charStart,
        char_end: charEnd,
      },
    });
  }

  return pieces;
}
