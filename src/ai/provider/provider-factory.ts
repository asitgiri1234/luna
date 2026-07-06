import { AiError } from "@/ai/errors/ai-error";

import type { AIProvider } from "./ai-provider";
import { OllamaProvider } from "./ollama.provider";

/**
 * # Provider factory
 *
 * The only place in the renderer that knows which concrete providers
 * exist. The composition root calls this once; everything downstream
 * sees only the `AIProvider` interface.
 *
 * ## Extension point
 * A new provider (e.g. a cloud API) is one `case` here plus its
 * implementation — no other module changes.
 */
export function createProvider(providerId: string): AIProvider {
  switch (providerId) {
    case "ollama":
      return new OllamaProvider(window.luna?.ai);
    default:
      throw new AiError("provider-unavailable", `Unknown AI provider "${providerId}".`);
  }
}
