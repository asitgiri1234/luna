import type { AiChatMessage } from "@/ai/types";

/**
 * # Prompt builder
 *
 * The single place where the final prompt sent to a model is
 * assembled. Nothing else in the app (and certainly nothing in React)
 * constructs or concatenates prompt text.
 *
 * Assembly order:
 *   1. system prompt (from `AiConfig`)
 *   2. memory block            ← future: injected by the memory system
 *   3. conversation history    (already trimmed by the context manager
 *                               or trimmed downstream)
 *
 * ## Extension point
 * The memory milestone passes `memory` entries here; tool-calling will
 * add a tool-instructions section. Both are additive changes to
 * `build()` — callers stay untouched.
 */

export interface PromptInput {
  /** Conversation turns, oldest first, ending with the latest user turn. */
  history: AiChatMessage[];
  /**
   * Future memory facts to ground the reply in. Wired through today so
   * the memory milestone plugs in without signature changes.
   */
  memory?: string[];
}

export class PromptBuilder {
  constructor(private readonly systemPrompt: string) {}

  build({ history, memory = [] }: PromptInput): AiChatMessage[] {
    let system = this.systemPrompt;
    if (memory.length > 0) {
      const facts = memory.map((fact) => `- ${fact}`).join("\n");
      system += `\n\n## Things you remember about the user\n${facts}`;
    }
    return [{ role: "system", content: system }, ...history];
  }
}
