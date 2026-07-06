import type { AIProvider } from "@/ai/provider/ai-provider";
import type { ToolRegistry } from "@/ai/tools/registry/tool-registry";
import type {
  DetectedIntent,
  IntentDetectionResult,
  ToolParameters,
} from "@/ai/tools/types";
import type { Logger } from "@shared/logger";

/**
 * # Intent detector
 *
 * Reads a user message and, using the LLM plus the registry's tool
 * catalog, decides which tool(s) it implies — extracting parameters,
 * confidence, and reasoning as strict JSON. It interprets only: no
 * permissions, no execution.
 *
 * Parsing is defensive (code fences stripped, first/last brace scanned);
 * malformed output degrades to "ordinary chat, no tools".
 */

const MODEL_TEMPERATURE = 0.1;
const MAX_TOKENS = 400;
/** Below this, we treat the message as ordinary chat. */
const MIN_CONFIDENCE = 0.5;

interface RawIntent {
  tool?: unknown;
  parameters?: unknown;
  confidence?: unknown;
  reasoning?: unknown;
}

export class IntentDetector {
  constructor(
    private readonly provider: AIProvider,
    private readonly registry: ToolRegistry,
    private readonly model: string,
    private readonly logger: Logger,
  ) {}

  private catalog(): string {
    return this.registry
      .list()
      .map((tool) => {
        const params = tool.parameters
          .map((p) => `${p.name}${p.required ? "*" : ""} (${p.type})`)
          .join(", ");
        return `- ${tool.name}: ${tool.description} Parameters: ${params || "none"}`;
      })
      .join("\n");
  }

  private systemPrompt(): string {
    return `You are Luna's intent detector. Decide whether the user's message requires any of the available tools, and if so which ones and with what parameters.

Available tools:
${this.catalog()}

Rules:
- Only choose a tool when the user clearly wants that action. Ordinary questions, chit-chat, or requests for information need NO tools.
- If a request needs several tools, list them in the order they must run (an earlier tool may produce input for a later one).
- Extract parameters exactly as the user expressed them (keep natural language for times).

Respond with STRICT JSON only, exactly:
{"requiresTools": <bool>, "confidence": <0.0-1.0>, "reasoning": "<short>", "intents": [{"tool": "<tool name>", "parameters": {<key: value>}, "confidence": <0.0-1.0>, "reasoning": "<short>"}]}

If no tool is needed, respond with {"requiresTools": false, "confidence": <0.0-1.0>, "reasoning": "<short>", "intents": []}.

Examples:
User: "Open Spotify"
{"requiresTools": true, "confidence": 0.95, "reasoning": "Wants to launch an app", "intents": [{"tool": "launch_application", "parameters": {"application": "Spotify"}, "confidence": 0.95, "reasoning": "launch Spotify"}]}

User: "Find my resume and open it"
{"requiresTools": true, "confidence": 0.9, "reasoning": "Search then open the result", "intents": [{"tool": "search_files", "parameters": {"query": "resume"}, "confidence": 0.9, "reasoning": "find the resume"}, {"tool": "document", "parameters": {}, "confidence": 0.85, "reasoning": "open the found document"}]}

User: "What is the capital of France?"
{"requiresTools": false, "confidence": 0.95, "reasoning": "General knowledge question", "intents": []}`;
  }

  async detect(message: string): Promise<IntentDetectionResult> {
    const empty: IntentDetectionResult = {
      requiresTools: false,
      intents: [],
      confidence: 0,
      reasoning: "No tool intent detected.",
    };

    let raw: string;
    try {
      raw = await this.provider.generate({
        model: this.model,
        messages: [
          { role: "system", content: this.systemPrompt() },
          { role: "user", content: message },
        ],
        options: { temperature: MODEL_TEMPERATURE, maxTokens: MAX_TOKENS },
      });
    } catch (error) {
      this.logger.warn("intent detection call failed", { error: String(error) });
      return empty;
    }

    const json = extractJsonObject(raw);
    if (!json) return empty;

    let parsed: { requiresTools?: unknown; confidence?: unknown; reasoning?: unknown; intents?: unknown };
    try {
      parsed = JSON.parse(json);
    } catch {
      this.logger.warn("intent detection returned non-JSON", { raw: raw.slice(0, 160) });
      return empty;
    }

    const rawIntents = Array.isArray(parsed.intents) ? (parsed.intents as RawIntent[]) : [];
    const intents: DetectedIntent[] = [];
    for (const row of rawIntents) {
      const toolName = typeof row.tool === "string" ? row.tool.trim() : "";
      if (!this.registry.has(toolName)) continue; // ignore hallucinated tools
      intents.push({
        toolName,
        parameters: isRecord(row.parameters) ? (row.parameters as ToolParameters) : {},
        confidence: clamp(row.confidence),
        reasoning: typeof row.reasoning === "string" ? row.reasoning : "",
      });
    }

    const confidence = clamp(parsed.confidence);
    const requiresTools =
      parsed.requiresTools === true && intents.length > 0 && confidence >= MIN_CONFIDENCE;

    const result: IntentDetectionResult = {
      requiresTools,
      intents: requiresTools ? intents : [],
      confidence,
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    };
    this.logger.debug("intent detected", {
      requiresTools: result.requiresTools,
      confidence: result.confidence,
      tools: result.intents.map((i) => i.toolName),
    });
    return result;
  }
}

function extractJsonObject(text: string): string | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last <= first) return null;
  return cleaned.slice(first, last + 1);
}

function clamp(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0.6;
  return Math.min(1, Math.max(0, num));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
