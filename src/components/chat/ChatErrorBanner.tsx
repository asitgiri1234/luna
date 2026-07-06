import type { ChatErrorCode } from "@shared/ai";

import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type ChatError, useChatStore } from "@/store/chat/chat.store";

interface ErrorPresentation {
  title: string;
  description: string;
  command?: string;
}

const presentations: Record<ChatErrorCode, ErrorPresentation> = {
  "ollama-not-installed": {
    title: "Ollama isn't installed",
    description:
      "Luna runs AI locally through Ollama. Download it from ollama.com/download, install it, then try again.",
  },
  "ollama-not-running": {
    title: "Ollama isn't running",
    description:
      "Ollama is installed but its server isn't reachable. Start the Ollama app (or run the command below), then try again.",
    command: "ollama serve",
  },
  "model-not-found": {
    title: "Model not downloaded",
    description:
      "The model Luna uses isn't available on this machine yet. Pull it with the command below, then try again.",
    command: "ollama pull qwen2.5:3b",
  },
  timeout: {
    title: "The model took too long",
    description:
      "Ollama stopped responding. The model may still be loading — give it a moment and try again.",
  },
  unknown: {
    title: "Something went wrong",
    description: "An unexpected error interrupted the response.",
  },
};

/** Friendly, actionable error card shown in place of a failed response. */
export function ChatErrorBanner({ error }: { error: ChatError }) {
  const regenerate = useChatStore((state) => state.regenerate);
  const dismissError = useChatStore((state) => state.dismissError);
  const presentation = presentations[error.code];

  return (
    <motion.div
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/10 p-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{presentation.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{presentation.description}</p>
          {presentation.command && (
            <code className="mt-2 inline-block rounded-md bg-secondary px-2.5 py-1 font-mono text-xs">
              {presentation.command}
            </code>
          )}
          {error.code === "unknown" && (
            <p className="mt-1 font-mono text-xs break-words text-muted-foreground/70">
              {error.message}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={dismissError}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <Button variant="outline" size="sm" className="mt-3 ml-7 gap-1.5" onClick={regenerate}>
        <RefreshCw className="h-3.5 w-3.5" />
        Try again
      </Button>
    </motion.div>
  );
}
