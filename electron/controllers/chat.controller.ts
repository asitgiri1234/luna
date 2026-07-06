import type { WebContents } from "electron";

import {
  CHAT_CHANNELS,
  type ChatStartPayload,
  type ChatStreamEvent,
} from "../../shared/ai";
import { OllamaError, streamChat } from "../backend/ollama-client";

/** One AbortController per in-flight generation, keyed by requestId. */
const activeGenerations = new Map<string, AbortController>();

class CancelledByUser extends Error {
  constructor() {
    super("Generation cancelled by user.");
    this.name = "CancelledByUser";
  }
}

export async function startGeneration(
  sender: WebContents,
  payload: ChatStartPayload,
): Promise<void> {
  const { requestId, messages } = payload;
  const controller = new AbortController();
  activeGenerations.set(requestId, controller);

  const emit = (event: ChatStreamEvent): void => {
    if (!sender.isDestroyed()) sender.send(CHAT_CHANNELS.event, event);
  };

  try {
    for await (const token of streamChat(messages, controller.signal)) {
      emit({ requestId, type: "token", token });
    }
    emit({ requestId, type: "done", cancelled: false });
  } catch (error) {
    if (error instanceof CancelledByUser || controller.signal.aborted) {
      emit({ requestId, type: "done", cancelled: true });
    } else if (error instanceof OllamaError) {
      emit({ requestId, type: "error", code: error.code, message: error.message });
    } else {
      const message = error instanceof Error ? error.message : String(error);
      emit({ requestId, type: "error", code: "unknown", message });
    }
  } finally {
    activeGenerations.delete(requestId);
  }
}

export function cancelGeneration(requestId: string): void {
  activeGenerations.get(requestId)?.abort(new CancelledByUser());
}
