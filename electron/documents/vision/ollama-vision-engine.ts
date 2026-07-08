import { exec } from "node:child_process";
import { promises as fs } from "node:fs";

import { DocumentError } from "../../../shared/documents";
import { createLogger } from "../../../shared/logger";
import { type VisionConfig, defaultVisionConfig } from "./vision.config";
import type { VisionAnalysisData, VisionEngine, VisionProgressReporter } from "./vision.types";

/**
 * # Ollama vision engine (main process)
 *
 * Sends an image to a local vision-capable model via Ollama's
 * `/api/generate` (base64 `images`) and asks for a structured JSON
 * analysis. Streams the response so progress can be reported. It only
 * describes the image — no chat, no OCR.
 */

const log = createLogger("main:vision:ollama");

/** Rough token budget used to turn streamed output into a 0…1 progress. */
const PROGRESS_TOKEN_BUDGET = 220;

const PROMPT = [
  "You are an image understanding assistant. Look at the image and respond with ONLY a JSON object,",
  "no prose, matching exactly this shape:",
  '{"caption": string, "description": string, "objects": string[], "scene": string}',
  "- caption: a short caption (max 12 words).",
  "- description: 2–4 sentences describing what is visible.",
  "- objects: the salient objects/subjects you see, as short labels.",
  "- scene: one sentence summarizing the overall scene/setting.",
].join(" ");

interface OllamaGenerateChunk {
  response?: string;
  done?: boolean;
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : typeof item === "object" && item && "label" in item ? String((item as { label: unknown }).label) : String(item)))
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);
}

export class OllamaVisionEngine implements VisionEngine {
  private readonly config: VisionConfig;

  constructor(config: Partial<VisionConfig> = {}) {
    this.config = { ...defaultVisionConfig, ...config };
  }

  async analyze(
    absPath: string,
    model: string,
    onProgress?: VisionProgressReporter,
  ): Promise<VisionAnalysisData> {
    let base64: string;
    try {
      base64 = (await fs.readFile(absPath)).toString("base64");
    } catch {
      throw new DocumentError("file-missing", "The image could not be read from the workspace.");
    }

    onProgress?.("analyzing", 0);
    const timeout = AbortSignal.timeout(this.config.requestTimeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.config.host}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt: PROMPT, images: [base64], format: "json", stream: true }),
        signal: timeout,
      });
    } catch (error) {
      if (timeout.aborted) throw new DocumentError("unknown", "The vision request timed out.");
      if (isConnectionError(error)) throw await this.classifyConnectionFailure();
      throw new DocumentError("unknown", error instanceof Error ? error.message : String(error));
    }

    if (!response.ok || !response.body) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      const detail = body.error ?? `Ollama returned HTTP ${response.status}.`;
      if (response.status === 404 || /not found|try pulling/i.test(detail)) {
        throw new DocumentError(
          "unknown",
          `The vision model "${model}" is not available. Run: ollama pull ${model}`,
        );
      }
      throw new DocumentError("unknown", detail);
    }

    // Stream NDJSON, accumulating the response text and reporting progress.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let tokens = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let chunk: OllamaGenerateChunk;
        try {
          chunk = JSON.parse(line);
        } catch {
          continue;
        }
        if (chunk.error) throw new DocumentError("unknown", chunk.error);
        if (chunk.response) {
          text += chunk.response;
          tokens += 1;
          onProgress?.("analyzing", Math.min(0.95, tokens / PROGRESS_TOKEN_BUDGET));
        }
      }
    }

    const data = this.parse(text);
    onProgress?.("done", 1);
    log.info("vision analysis complete", { model, objects: data.objects.length });
    return data;
  }

  /** Parses the model's JSON, tolerating extra prose around it. */
  private parse(raw: string): VisionAnalysisData {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    let parsed: Record<string, unknown> = {};
    if (start !== -1 && end > start) {
      try {
        parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        // fall through to text fallback
      }
    }
    const description =
      typeof parsed.description === "string" && parsed.description.trim()
        ? parsed.description.trim()
        : raw.trim().slice(0, 800);
    if (!description) {
      throw new DocumentError("unknown", "The vision model returned an empty analysis.");
    }
    const caption =
      typeof parsed.caption === "string" && parsed.caption.trim()
        ? parsed.caption.trim()
        : description.split(/[.!?]/)[0].trim().slice(0, 120);
    const sceneSummary =
      typeof parsed.scene === "string" && parsed.scene.trim() ? parsed.scene.trim() : caption;
    return { caption, description, objects: asStringArray(parsed.objects), sceneSummary };
  }

  private async classifyConnectionFailure(): Promise<DocumentError> {
    const installed = await ollamaOnPath();
    return installed
      ? new DocumentError("unknown", `Ollama is installed but not reachable at ${this.config.host}.`)
      : new DocumentError("unknown", "The Ollama CLI was not found on this system.");
  }
}
