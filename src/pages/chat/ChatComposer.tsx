import { type KeyboardEvent, useCallback, useRef, useState } from "react";

import { ArrowUp, Loader2, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useChatStore } from "@/store/chat/chat.store";

const MAX_HEIGHT_PX = 200;

/**
 * Message input bar. Enter sends, Shift+Enter inserts a newline; while a
 * response is generating the send button becomes Stop.
 */
export function ChatComposer() {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const status = useChatStore((state) => state.status);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const stopGeneration = useChatStore((state) => state.stopGeneration);

  const generating = status === "waiting" || status === "streaming";
  const stopping = status === "stopping";
  const canSend = status === "idle" && value.trim().length > 0;

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, []);

  const submit = useCallback(() => {
    const text = value.trim();
    if (!text || status !== "idle") return;
    sendMessage(text);
    setValue("");
    requestAnimationFrame(resize);
  }, [value, status, sendMessage, resize]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="shrink-0 px-8 pb-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-border/70 bg-card p-2 shadow-lg shadow-black/20 transition-colors focus-within:border-ring/50">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            disabled={stopping}
            onChange={(event) => {
              setValue(event.target.value);
              resize();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message Luna…"
            className="max-h-50 min-h-10 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
          />
          {generating ? (
            <Button
              size="icon"
              variant="secondary"
              aria-label="Stop generating"
              className="rounded-xl"
              onClick={stopGeneration}
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : stopping ? (
            <Button size="icon" disabled aria-label="Stopping" className="rounded-xl">
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          ) : (
            <Button
              size="icon"
              aria-label="Send message"
              disabled={!canSend}
              className="rounded-xl"
              onClick={submit}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
          Luna runs locally with Ollama and can make mistakes.
        </p>
      </div>
    </div>
  );
}
