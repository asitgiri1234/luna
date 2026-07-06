import { AiError } from "../../../shared/ai";
import { OllamaMainProvider } from "./ollama.provider";
import type { MainAiProvider } from "./provider";

/**
 * # Provider registry (main process)
 *
 * Routes `providerId` → concrete `MainAiProvider`. The registry is
 * built once at startup and handed to the AI controller (dependency
 * injection — nothing reaches for a global).
 *
 * ## Extension point
 * Adding a provider is two lines: implement `MainAiProvider`, add it
 * to `createDefaultProviderRegistry`.
 */
export interface ProviderRegistry {
  get(id: string): MainAiProvider;
}

export function createProviderRegistry(providers: MainAiProvider[]): ProviderRegistry {
  const byId = new Map(providers.map((provider) => [provider.id, provider]));
  return {
    get(id) {
      const provider = byId.get(id);
      if (!provider) {
        throw new AiError("provider-unavailable", `Unknown AI provider "${id}".`);
      }
      return provider;
    },
  };
}

/** The providers shipped with Luna. */
export function createDefaultProviderRegistry(): ProviderRegistry {
  return createProviderRegistry([new OllamaMainProvider()]);
}
