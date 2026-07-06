import { ArrowDown } from "lucide-react";

import { useStickToBottom } from "@/hooks/useStickToBottom";
import { useChatStore } from "@/store/chat/chat.store";

import { ChatErrorBanner } from "./ChatErrorBanner";
import { ChatMessageBubble } from "./ChatMessageBubble";

export function ChatMessageList() {
  const messages = useChatStore((state) => state.messages);
  const status = useChatStore((state) => state.status);
  const error = useChatStore((state) => state.error);

  const lastMessage = messages[messages.length - 1];
  const generating = status !== "idle";

  // Changes on every appended token → drives the stick-to-bottom effect.
  const scrollSignal = `${messages.length}:${lastMessage?.content.length ?? 0}:${error ? 1 : 0}`;
  const { containerRef, isAtBottom, handleScroll, scrollToBottom } =
    useStickToBottom(scrollSignal);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-6 py-6"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {messages.map((message, index) => (
            <ChatMessageBubble
              key={message.id}
              message={message}
              isActive={generating && index === messages.length - 1 && message.role === "assistant"}
              canRegenerate={
                !generating && index === messages.length - 1 && message.role === "assistant"
              }
            />
          ))}
          {error && <ChatErrorBanner error={error} />}
        </div>
      </div>

      {!isAtBottom && (
        <button
          type="button"
          aria-label="Scroll to bottom"
          onClick={() => scrollToBottom()}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-border bg-card p-2 text-muted-foreground shadow-lg transition-colors hover:text-foreground"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
