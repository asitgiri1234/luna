import { memo } from "react";

import { motion } from "framer-motion";

import { type ChatMessage, useChatStore } from "@/store/chat/chat.store";

import { ChatMarkdown } from "./ChatMarkdown";
import { ChatMessageActions } from "./ChatMessageActions";
import { MessageCitations } from "./MessageCitations";
import { TypingDots } from "./TypingDots";

const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

interface ChatMessageBubbleProps {
  message: ChatMessage;
  /** True while this message is the assistant reply currently being generated. */
  isActive: boolean;
  /** True when this is the last assistant message of an idle conversation. */
  canRegenerate: boolean;
}

export const ChatMessageBubble = memo(function ChatMessageBubble({
  message,
  isActive,
  canRegenerate,
}: ChatMessageBubbleProps) {
  const regenerate = useChatStore((state) => state.regenerate);
  const timestamp = timeFormat.format(message.createdAt);

  if (message.role === "user") {
    return (
      <motion.div
        className="flex flex-col items-end"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-primary-foreground shadow-sm">
          {message.content}
        </div>
        <span className="mt-1 pr-1 text-[10px] text-muted-foreground/70">{timestamp}</span>
      </motion.div>
    );
  }

  const waitingForFirstToken = isActive && message.content === "";

  return (
    <motion.div
      className="group/message flex gap-3"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-violet-400 via-indigo-400 to-indigo-600 shadow-md shadow-indigo-500/20" />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md border border-border/50 bg-card/60 px-4 py-3 shadow-sm">
          {waitingForFirstToken ? (
            <TypingDots />
          ) : (
            <>
              <ChatMarkdown content={message.content} />
              {isActive && (
                <span
                  aria-hidden
                  className="mt-1 ml-0.5 inline-block h-4 w-[7px] animate-pulse rounded-[2px] bg-foreground/80 align-text-bottom"
                />
              )}
            </>
          )}
        </div>
        {message.documentChat && <MessageCitations documentChat={message.documentChat} />}
        <div className="flex items-center gap-2 pl-1">
          <span className="mt-1 text-[10px] text-muted-foreground/70">
            {timestamp}
            {message.interrupted && " · stopped"}
          </span>
          {!isActive && message.content !== "" && (
            <ChatMessageActions
              content={message.content}
              canRegenerate={canRegenerate}
              onRegenerate={regenerate}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
});
