import type { AIProvider } from "@/ai/provider/ai-provider";
import { MEMORY_CATEGORIES, type MemoryCandidate, isMemoryCategory } from "@shared/memory";
import type { Logger } from "@shared/logger";

/**
 * # Memory extractor
 *
 * Analyzes a single user message with the LLM and returns structured
 * `MemoryCandidate`s — durable personal facts worth remembering. It
 * NEVER saves anything: extraction only proposes.
 *
 * The model is asked for strict JSON; parsing is defensive (code fences
 * stripped, first/last brace scanned) and any malformed output yields
 * an empty list rather than an error.
 */

const MODEL_TEMPERATURE = 0.1;
const MAX_TOKENS = 320;
const MIN_CONFIDENCE = 0.5;
/** Skip extraction on trivially short messages — nothing to learn. */
const MIN_MESSAGE_LENGTH = 12;

const SYSTEM_PROMPT = `You are Luna's memory extraction module.
From the user's message, identify durable PERSONAL facts worth remembering across future conversations: their identity, stable preferences, ongoing projects, important people, goals, writing style, and favorites.

Ignore transient content: questions, one-off requests, general knowledge, or anything not about the user personally.

Respond with STRICT JSON and nothing else, in exactly this shape:
{"memories":[{"category":"<one of: ${MEMORY_CATEGORIES.join(", ")}>","key":"<short label>","value":"<the fact, written in third person about the user>","confidence":<0.0-1.0>,"reason":"<why this is worth remembering>"}]}

If nothing is worth remembering, respond with {"memories":[]}.
Never invent facts. Only extract what the user actually stated.`;

interface RawCandidate {
  category?: unknown;
  key?: unknown;
  value?: unknown;
  confidence?: unknown;
  reason?: unknown;
}

function extractJsonObject(text: string): string | null {
  const withoutFences = text.replace(/```(?:json)?/gi, "").trim();
  const first = withoutFences.indexOf("{");
  const last = withoutFences.lastIndexOf("}");
  if (first === -1 || last <= first) return null;
  return withoutFences.slice(first, last + 1);
}

function clampConfidence(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0.6;
  return Math.min(1, Math.max(0, num));
}

export class MemoryExtractor {
  constructor(
    private readonly provider: AIProvider,
    private readonly model: string,
    private readonly logger: Logger,
  ) {}

  async extract(message: string): Promise<Omit<MemoryCandidate, "sourceConversationId">[]> {
    if (message.trim().length < MIN_MESSAGE_LENGTH) return [];

    let raw: string;
    try {
      raw = await this.provider.generate({
        model: this.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
        options: { temperature: MODEL_TEMPERATURE, maxTokens: MAX_TOKENS },
      });
    } catch (error) {
      this.logger.warn("memory extraction call failed", { error: String(error) });
      return [];
    }

    const json = extractJsonObject(raw);
    if (!json) return [];

    let parsed: { memories?: RawCandidate[] };
    try {
      parsed = JSON.parse(json) as { memories?: RawCandidate[] };
    } catch {
      this.logger.warn("memory extraction returned non-JSON", { raw: raw.slice(0, 200) });
      return [];
    }

    const rows = Array.isArray(parsed.memories) ? parsed.memories : [];
    const candidates: Omit<MemoryCandidate, "sourceConversationId">[] = [];
    for (const row of rows) {
      const category =
        typeof row.category === "string" && isMemoryCategory(row.category)
          ? row.category
          : "custom";
      const key = typeof row.key === "string" ? row.key.trim() : "";
      const value = typeof row.value === "string" ? row.value.trim() : "";
      const confidence = clampConfidence(row.confidence);
      const reason = typeof row.reason === "string" ? row.reason.trim() : "";
      if (!value || confidence < MIN_CONFIDENCE) continue;
      candidates.push({ category, key: key || value.slice(0, 40), value, confidence, reason });
    }
    return candidates;
  }
}
