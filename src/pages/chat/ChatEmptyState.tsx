import { motion } from "framer-motion";
import { ArrowRight, Lightbulb, NotebookPen, Search, Sparkles } from "lucide-react";

import { AVATAR_ICONS } from "@/personalization/personalization.types";
import { useChatStore } from "@/store/chat/chat.store";
import { usePersonalizationStore } from "@/store/personalization/personalization.store";

const suggestions = [
  {
    icon: Sparkles,
    title: "Plan my day",
    hint: "Turn a to-do list into a schedule",
    prompt: "Help me plan my day. Ask me what's on my to-do list, then build a realistic schedule.",
  },
  {
    icon: Search,
    title: "Research a topic",
    hint: "Summarize and compare sources",
    prompt: "I want to research a topic. Ask me which topic, then give me a structured summary.",
  },
  {
    icon: NotebookPen,
    title: "Draft a message",
    hint: "Emails, posts and replies",
    prompt: "Help me draft a message. Ask me who it's for and what I want to say.",
  },
  {
    icon: Lightbulb,
    title: "Brainstorm ideas",
    hint: "Explore angles on any problem",
    prompt: "Let's brainstorm. Ask me what problem I'm working on, then suggest creative angles.",
  },
] as const;

export function ChatEmptyState() {
  const sendMessage = useChatStore((state) => state.sendMessage);
  const welcomeMessage = usePersonalizationStore((state) => state.welcomeMessage);
  const avatar = usePersonalizationStore((state) => state.avatar);
  const conversationStarter = usePersonalizationStore((state) => state.conversationStarter);
  const AvatarIcon = AVATAR_ICONS[avatar];

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-8">
      <motion.div
        className="flex flex-col items-center gap-3 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 via-indigo-400 to-indigo-600 text-white shadow-lg shadow-indigo-500/25">
          <AvatarIcon className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {welcomeMessage || "How can I help you today?"}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Ask anything, or start from one of these.
        </p>
      </motion.div>

      {conversationStarter.trim() && (
        <motion.button
          type="button"
          onClick={() => sendMessage(conversationStarter.trim())}
          className="group flex w-full max-w-2xl items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 text-sm font-medium">{conversationStarter.trim()}</span>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </motion.button>
      )}

      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {suggestions.map((suggestion, index) => (
          <motion.button
            key={suggestion.title}
            type="button"
            onClick={() => sendMessage(suggestion.prompt)}
            className="group flex items-start gap-3 rounded-xl border border-border/70 bg-card/50 p-4 text-left transition-colors hover:border-border hover:bg-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08 + index * 0.05, ease: "easeOut" }}
          >
            <suggestion.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            <span>
              <span className="block text-sm font-medium">{suggestion.title}</span>
              <span className="block text-xs text-muted-foreground">{suggestion.hint}</span>
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
