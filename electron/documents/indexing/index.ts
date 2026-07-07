import { randomUUID } from "node:crypto";

import type { DocumentChunk } from "../../../shared/documents";
import type { ChunkDraft } from "../types";

/**
 * # Index preparation (main process)
 *
 * The bridge between chunking and the store. It assigns each chunk draft
 * a stable id, its owning document id, and its 0-based order, producing
 * the final `DocumentChunk` objects.
 *
 * These objects are the exact shape a FUTURE embedding step will consume
 * (`{ id, documentId, text, position, metadata }`). No vectors are
 * generated here — this milestone stops at "ready to embed".
 */
export function prepareChunks(documentId: string, drafts: ChunkDraft[]): DocumentChunk[] {
  return drafts.map((draft, position) => ({
    id: randomUUID(),
    documentId,
    position,
    text: draft.text,
    metadata: draft.metadata,
  }));
}
