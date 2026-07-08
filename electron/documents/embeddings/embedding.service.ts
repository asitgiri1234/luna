import { exec } from "node:child_process";
import { randomUUID } from "node:crypto";

import { PersistenceError } from "../../../shared/conversations";
import { createLogger } from "../../../shared/logger";
import { type EmbeddingConfig, defaultEmbeddingConfig } from "./embedding.config";
import { EmbeddingRepository } from "./embedding.repository";
import {
  type EmbedOptions,
  type EmbedProgress,
  type EmbedResult,
  type EmbeddingRecord,
  EmbeddingError,
} from "./types";

/**
 * # EmbeddingService (main process)
 *
 * Reads chunk text from `document_chunks` and produces vector embeddings
 * with a local embedding model served by Ollama. It:
 *
 * - reads the configured model from `embedding.config.ts` (overridable),
 * - **skips** chunks that already have an embedding for that model,
 * - **batches** requests (yielding between batches so it never blocks),
 * - reports cumulative **progress** to the caller after each batch,
 * - stores results in `chunk_embeddings`.
 *
 * It only PRODUCES embeddings — no vector search, retrieval, or RAG.
 */

const log = createLogger("main:embeddings");

interface OllamaEmbedResponse {
  embeddings?: number[][];
  error?: string;
}

function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = error.cause as { code?: string; errors?: { code?: string }[] } | undefined;
  const codes = [cause?.code, ...(cause?.errors?.map((e) => e.code) ?? [])];
  return codes.some((code) => code === "ECONNREFUSED" || code === "ENOTFOUND");
}

function ollamaOnPath(): Promise<boolean> {
  const probe = process.platform === "win32" ? "where ollama" : "which ollama";
  return new Promise((resolve) => exec(probe, (error) => resolve(!error)));
}

export class EmbeddingService {
  private readonly config: EmbeddingConfig;
  private readonly repository: EmbeddingRepository;

  constructor(config: Partial<EmbeddingConfig> = {}, repository = new EmbeddingRepository()) {
    this.config = { ...defaultEmbeddingConfig, ...config };
    this.repository = repository;
  }

  /**
   * Embeds every chunk that doesn't yet have an embedding for the target
   * model (optionally scoped to one document), in batches, reporting
   * progress as it goes.
   */
  async embed(options: EmbedOptions = {}): Promise<EmbedResult> {
    const model = options.model ?? this.config.model;
    const batchSize = Math.max(1, options.batchSize ?? this.config.batchSize);

    let pending;
    let totalChunks: number;
    try {
      pending = this.repository.pendingChunks(model, options.documentId);
      totalChunks = this.repository.countChunks(options.documentId);
    } catch (error) {
      if (error instanceof PersistenceError) {
        throw new EmbeddingError("db-unavailable", error.message);
      }
      throw error;
    }

    const skipped = Math.max(0, totalChunks - pending.length);
    let processed = 0;
    let embedded = 0;
    let failed = 0;
    let dimensions: number | null = null;

    const emit = (): void =>
      options.onProgress?.({
        model,
        total: pending.length,
        processed,
        embedded,
        skipped,
        failed,
      } satisfies EmbedProgress);

    emit(); // initial snapshot (e.g. total known, nothing processed yet)
    log.info("embedding run started", {
      model,
      pending: pending.length,
      skipped,
      documentId: options.documentId,
    });

    for (let i = 0; i < pending.length; i += batchSize) {
      if (options.signal?.aborted) {
        throw new EmbeddingError("cancelled", "Embedding was cancelled.");
      }
      const batch = pending.slice(i, i + batchSize);

      let vectors: number[][];
      try {
        vectors = await this.embedBatch(
          model,
          batch.map((chunk) => chunk.text),
          options.signal,
        );
      } catch (error) {
        // Provider/model/cancel failures are fatal for the whole run —
        // nothing else would succeed. Anything else fails just this batch.
        if (
          error instanceof EmbeddingError &&
          error.code !== "unknown" &&
          error.code !== "db-unavailable"
        ) {
          throw error;
        }
        failed += batch.length;
        processed += batch.length;
        log.warn("batch failed", { model, size: batch.length, message: String(error) });
        emit();
        await yieldToLoop();
        continue;
      }

      const now = Date.now();
      const records: EmbeddingRecord[] = batch.map((chunk, index) => ({
        id: randomUUID(),
        chunkId: chunk.id,
        model,
        dimensions: vectors[index]?.length ?? 0,
        embedding: vectors[index] ?? [],
        createdAt: now,
      }));
      this.repository.insertMany(records);

      embedded += records.length;
      processed += records.length;
      dimensions = records[0]?.dimensions ?? dimensions;
      emit();
      await yieldToLoop(); // keep the main process responsive between batches
    }

    log.info("embedding run finished", { model, embedded, skipped, failed });
    return { model, dimensions, total: pending.length, embedded, skipped, failed };
  }

  /** One `/api/embed` request for a batch of inputs → one vector each. */
  private async embedBatch(
    model: string,
    inputs: string[],
    signal?: AbortSignal,
  ): Promise<number[][]> {
    const timeout = AbortSignal.timeout(this.config.requestTimeoutMs);
    const abort = signal ? AbortSignal.any([signal, timeout]) : timeout;

    let response: Response;
    try {
      response = await fetch(`${this.config.host}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: inputs }),
        signal: abort,
      });
    } catch (error) {
      if (signal?.aborted) throw new EmbeddingError("cancelled", "Embedding was cancelled.");
      if (timeout.aborted) {
        throw new EmbeddingError("provider-unavailable", "The embedding request timed out.");
      }
      if (isConnectionError(error)) throw await this.classifyConnectionFailure();
      throw new EmbeddingError("unknown", error instanceof Error ? error.message : String(error));
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      const detail = body.error ?? `Ollama returned HTTP ${response.status}.`;
      if (response.status === 404 || /not found|try pulling/i.test(detail)) {
        throw new EmbeddingError(
          "model-missing",
          `The embedding model "${model}" is not available. Run: ollama pull ${model}`,
        );
      }
      throw new EmbeddingError("unknown", detail);
    }

    const data = (await response.json()) as OllamaEmbedResponse;
    if (data.error) throw new EmbeddingError("unknown", data.error);
    if (!Array.isArray(data.embeddings) || data.embeddings.length !== inputs.length) {
      throw new EmbeddingError("unknown", "Ollama returned an unexpected embedding response.");
    }
    return data.embeddings;
  }

  private async classifyConnectionFailure(): Promise<EmbeddingError> {
    const installed = await ollamaOnPath();
    return installed
      ? new EmbeddingError(
          "provider-unavailable",
          `Ollama is installed but not reachable at ${this.config.host}.`,
        )
      : new EmbeddingError("provider-not-installed", "The Ollama CLI was not found on this system.");
  }
}

/** Lets pending I/O and the UI run between batches (never blocks the loop). */
function yieldToLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
