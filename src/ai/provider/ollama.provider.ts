import { AiError } from "@/ai/errors/ai-error";
import type {
  GenerationHandle,
  GenerationRequest,
  ProviderHealth,
  StreamCallbacks,
} from "@/ai/types";
import type { LunaAiApi } from "@/types/electron";
import { createLogger } from "@shared/logger";

import type { AIProvider } from "./ai-provider";

/**
 * # Ollama provider (renderer)
 *
 * Renderer-side half of the Ollama integration. Contains **no Ollama
 * protocol knowledge** — it forwards requests over the preload AI
 * bridge to the main process, where `OllamaMainProvider` does the real
 * work. This keeps the renderer sandboxed and the provider swappable.
 *
 * The bridge is injected (not read from `window` internally) so tests
 * can pass a fake and a browser tab degrades gracefully.
 */

const log = createLogger("ai:provider:ollama");

const NO_BRIDGE_MESSAGE =
  "The desktop AI bridge is unavailable. Launch Luna through Electron (npm run dev).";

export class OllamaProvider implements AIProvider {
  readonly id = "ollama";

  constructor(private readonly bridge: LunaAiApi | undefined) {}

  generate(request: GenerationRequest): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let text = "";
      this.stream(request, {
        onToken: (token) => {
          text += token;
        },
        onDone: ({ cancelled }) => {
          if (cancelled) reject(new AiError("cancelled", "Generation was cancelled."));
          else resolve(text);
        },
        onError: reject,
      });
    });
  }

  stream(request: GenerationRequest, callbacks: StreamCallbacks): GenerationHandle {
    const bridge = this.bridge;
    if (!bridge) {
      queueMicrotask(() =>
        callbacks.onError(new AiError("provider-unavailable", NO_BRIDGE_MESSAGE)),
      );
      return { requestId: "", cancel: () => {} };
    }

    const requestId = crypto.randomUUID();
    log.debug("stream requested", { requestId, model: request.model });

    const unsubscribe = bridge.onEvent((event) => {
      if (event.requestId !== requestId) return;
      switch (event.type) {
        case "token":
          callbacks.onToken(event.token);
          break;
        case "done":
          unsubscribe();
          callbacks.onDone({ cancelled: event.cancelled });
          break;
        case "error":
          unsubscribe();
          callbacks.onError(new AiError(event.code, event.message));
          break;
      }
    });

    bridge.start({
      requestId,
      providerId: this.id,
      model: request.model,
      messages: request.messages,
      options: request.options,
    });

    return { requestId, cancel: () => bridge.cancel(requestId) };
  }

  cancel(requestId: string): void {
    if (requestId) this.bridge?.cancel(requestId);
  }

  async healthCheck(): Promise<ProviderHealth> {
    if (!this.bridge) {
      return { ok: false, code: "provider-unavailable", message: NO_BRIDGE_MESSAGE };
    }
    return this.bridge.health(this.id);
  }
}
