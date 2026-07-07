import type { ChunkMetadata, ChunkOptions } from "../../../shared/documents";
import type { Block, ChunkDraft } from "../types";

/**
 * # Chunking engine (main process, reusable & pure)
 *
 * Splits a normalized document's blocks into ordered chunks ready for a
 * future embedding step. Three strategies, all honoring a configurable
 * target size and overlap, and all attaching chunk metadata (word/char
 * counts, source page, nearest heading trail, strategy):
 *
 * - **paragraph** — one chunk per block; oversized blocks are windowed.
 *   Keeps lists / tables / code intact.
 * - **sentence**  — sentence-aware packing across blocks up to the size
 *   limit, with sentence-level overlap. The default for retrieval.
 * - **fixed**     — character windows over the whole text, with overlap.
 */

/** A sentence with the structural context it came from. */
interface Sentence {
  text: string;
  page: number;
  headingPath: string[];
}

/** Splits a block of prose into sentences (newlines are boundaries too). */
function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?\n]+(?:[.!?]+|\n+|$)/g);
  const sentences = (matches ?? [text]).map((s) => s.trim()).filter(Boolean);
  return sentences.length > 0 ? sentences : [];
}

/** Flattens blocks into sentences, tracking page + heading trail per sentence. */
function toSentences(blocks: Block[]): Sentence[] {
  const headingStack: string[] = [];
  const sentences: Sentence[] = [];

  for (const block of blocks) {
    if (block.type === "heading") {
      const level = block.level ?? 1;
      headingStack.length = Math.min(headingStack.length, level - 1);
      headingStack[level - 1] = block.text;
      continue;
    }
    const headingPath = headingStack.filter(Boolean);
    // Code / tables / list groups stay atomic; prose is sentence-split.
    const parts =
      block.type === "paragraph" ? splitSentences(block.text) : [block.text.trim()];
    for (const text of parts) {
      if (text) sentences.push({ text, page: block.page, headingPath });
    }
  }
  return sentences;
}

function makeMetadata(
  text: string,
  strategy: ChunkOptions["strategy"],
  page: number,
  headingPath: string[],
): ChunkMetadata {
  const words = text.match(/\S+/g);
  const meta: ChunkMetadata = {
    wordCount: words ? words.length : 0,
    charCount: text.length,
    strategy,
  };
  if (page) meta.page = page;
  if (headingPath.length > 0) meta.headingPath = headingPath;
  return meta;
}

/** Character-window a single string with overlap (used by fixed + oversized). */
function windowText(text: string, maxChars: number, overlap: number): string[] {
  if (text.length <= maxChars) return [text];
  const step = Math.max(1, maxChars - overlap);
  const windows: string[] = [];
  for (let start = 0; start < text.length; start += step) {
    windows.push(text.slice(start, start + maxChars));
    if (start + maxChars >= text.length) break;
  }
  return windows;
}

function chunkBySentence(sentences: Sentence[], options: ChunkOptions): ChunkDraft[] {
  const { maxChars, overlap } = options;
  const drafts: ChunkDraft[] = [];
  let current: Sentence[] = [];
  let length = 0;

  const emit = (): void => {
    if (current.length === 0) return;
    const text = current.map((s) => s.text).join(" ");
    const head = current[0];
    drafts.push({ text, metadata: makeMetadata(text, "sentence", head.page, head.headingPath) });

    // Carry trailing sentences (up to `overlap` chars) into the next chunk.
    const carry: Sentence[] = [];
    let carryLen = 0;
    for (let i = current.length - 1; i > 0; i -= 1) {
      const len = current[i].text.length + 1;
      if (carryLen + len > overlap) break;
      carry.unshift(current[i]);
      carryLen += len;
    }
    current = carry;
    length = carryLen;
  };

  for (const sentence of sentences) {
    const addLen = sentence.text.length + 1;
    if (length > 0 && length + addLen > maxChars) emit();
    current.push(sentence);
    length += addLen;
  }
  emit();
  // Drop a possible trailing overlap-only chunk (duplicate of prior tail).
  return drafts;
}

function chunkByParagraph(blocks: Block[], options: ChunkOptions): ChunkDraft[] {
  const { maxChars, overlap } = options;
  const headingStack: string[] = [];
  const drafts: ChunkDraft[] = [];

  for (const block of blocks) {
    if (block.type === "heading") {
      const level = block.level ?? 1;
      headingStack.length = Math.min(headingStack.length, level - 1);
      headingStack[level - 1] = block.text;
      continue;
    }
    const headingPath = headingStack.filter(Boolean);
    const text = block.text.trim();
    if (!text) continue;
    for (const window of windowText(text, maxChars, overlap)) {
      drafts.push({
        text: window,
        metadata: makeMetadata(window, "paragraph", block.page, headingPath),
      });
    }
  }
  return drafts;
}

function chunkFixed(blocks: Block[], options: ChunkOptions): ChunkDraft[] {
  const { maxChars, overlap } = options;
  // Track page by character offset so windows can report a source page.
  const pieces = blocks.filter((b) => b.type !== "heading").map((b) => ({ text: b.text.trim(), page: b.page }));
  const full = pieces.map((p) => p.text).join("\n\n");
  const pageAt = (offset: number): number => {
    let cursor = 0;
    for (const piece of pieces) {
      cursor += piece.text.length + 2;
      if (offset < cursor) return piece.page;
    }
    return pieces.length > 0 ? pieces[pieces.length - 1].page : 1;
  };

  const drafts: ChunkDraft[] = [];
  const step = Math.max(1, maxChars - overlap);
  for (let start = 0; start < full.length; start += step) {
    const text = full.slice(start, start + maxChars);
    if (text.trim()) drafts.push({ text, metadata: makeMetadata(text, "fixed", pageAt(start), []) });
    if (start + maxChars >= full.length) break;
  }
  return drafts;
}

/** Splits blocks into ordered chunk drafts per the chosen strategy. */
export function chunkDocument(blocks: Block[], options: ChunkOptions): ChunkDraft[] {
  switch (options.strategy) {
    case "paragraph":
      return chunkByParagraph(blocks, options);
    case "fixed":
      return chunkFixed(blocks, options);
    case "sentence":
    default:
      return chunkBySentence(toSentences(blocks), options);
  }
}
