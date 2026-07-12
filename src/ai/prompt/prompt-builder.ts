import type { AiChatMessage } from "@/ai/types";

import { ContextFormatter } from "./context-formatter";
import type { ContextLimits, RetrievedContextChunk } from "./prompt-context";

/**
 * # Prompt builder
 *
 * The single place where the final prompt sent to a model is
 * assembled. Nothing else in the app (and certainly nothing in React)
 * constructs or concatenates prompt text.
 *
 * Assembly order (all inside the system message, then history):
 *   1. system prompt (from `AiConfig`)
 *   2. retrieved document context   ← RAG augmentation (this milestone)
 *   3. memory block                 (things remembered about the user)
 *   4. conversation history         (already trimmed by the context
 *                                    manager or downstream)
 *
 * The document context is placed before the conversation history — and so
 * before the latest user message — matching:
 *
 *   System Prompt
 *   Relevant Document Context: …
 *   Conversation History
 *   User Message
 *
 * ## Extension point
 * `context` (retrieved chunks) and `memory` are both additive: callers
 * that pass neither get exactly the previous behavior.
 */

export interface PromptInput {
  /** Conversation turns, oldest first, ending with the latest user turn. */
  history: AiChatMessage[];
  /** Memory facts to ground the reply in. */
  memory?: string[];
  /** Retrieved document chunks to inject as context (RAG). */
  context?: RetrievedContextChunk[];
}

export class PromptBuilder {
  private readonly formatter: ContextFormatter;

  constructor(
    private readonly systemPrompt: string,
    /** Configurable budget for injected document context. */
    contextLimits?: ContextLimits,
    /**
     * Supplies an extra system-prompt directive (assistant persona:
     * name, personality, response length, language). Read at build time
     * so personalization changes affect the next response without a
     * restart. Returns "" when there is nothing to add.
     */
    private readonly personaProvider?: () => string,
  ) {
    this.formatter = new ContextFormatter(contextLimits);
  }

  build({ history, memory = [], context = [] }: PromptInput): AiChatMessage[] {
    let system = this.systemPrompt;

    const persona = this.personaProvider?.().trim();
    if (persona) {
      system += `\n\n${persona}`;
    }

    const documentContext = this.formatter.buildDocumentContext(context);
    if (documentContext) {
      system += `\n\n${documentContext}`;
    }

    if (memory.length > 0) {
      const facts = memory.map((fact) => `- ${fact}`).join("\n");
      system += `\n\n## Things you remember about the user\n${facts}`;
    }

    return [{ role: "system", content: system }, ...history];
  }
}
