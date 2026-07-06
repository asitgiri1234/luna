import type { WebContents } from "electron";

import {
  AI_CHANNELS,
  AiError,
  type AiStreamEvent,
  type AiStreamRequest,
  type ProviderHealth,
  toAiError,
} from "../../shared/ai";
import { createLogger } from "../../shared/logger";
import type { ProviderRegistry } from "../backend/providers/registry";

/**
 * # AI controller (main process)
 *
 * Orchestrates generation requests coming over IPC:
 * - resolves the provider from the injected registry
 * - pumps provider tokens back to the requesting window as events
 * - tracks one `AbortController` per request for cancellation
 * - converts every failure into a classified stream event
 *
 * Provider-agnostic by design: it never imports a concrete provider.
 */

const log = createLogger("main:ai:controller");

class CancelledByUser extends AiError {
  constructor() {
    super("cancelled", "Generation cancelled by user.");
  }
}

export class AiController {
  private readonly active = new Map<string, AbortController>();

  constructor(private readonly providers: ProviderRegistry) {}

  async start(sender: WebContents, request: AiStreamRequest): Promise<void> {
    const { requestId, providerId, model } = request;
    const controller = new AbortController();
    this.active.set(requestId, controller);

    const emit = (event: AiStreamEvent): void => {
      if (!sender.isDestroyed()) sender.send(AI_CHANNELS.event, event);
    };

    log.info("generation started", { requestId, providerId, model });
    const startedAt = Date.now();
    let tokens = 0;

    try {
      const provider = this.providers.get(providerId);
      for await (const token of provider.stream(request, controller.signal)) {
        tokens += 1;
        emit({ requestId, type: "token", token });
      }
      emit({ requestId, type: "done", cancelled: false });
      log.info("generation finished", { requestId, tokens, ms: Date.now() - startedAt });
    } catch (error) {
      if (error instanceof CancelledByUser || controller.signal.aborted) {
        emit({ requestId, type: "done", cancelled: true });
        log.info("generation cancelled", { requestId, tokens });
      } else {
        const aiError = toAiError(error);
        emit({ requestId, type: "error", code: aiError.code, message: aiError.message });
        log.error("generation failed", { requestId, code: aiError.code, message: aiError.message });
      }
    } finally {
      this.active.delete(requestId);
    }
  }

  cancel(requestId: string): void {
    this.active.get(requestId)?.abort(new CancelledByUser());
  }

  async health(providerId: string): Promise<ProviderHealth> {
    try {
      return await this.providers.get(providerId).healthCheck();
    } catch (error) {
      const aiError = toAiError(error);
      return { ok: false, code: aiError.code, message: aiError.message };
    }
  }
}
