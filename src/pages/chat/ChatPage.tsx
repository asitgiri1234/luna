import { motion } from "framer-motion";
import { Lightbulb, NotebookPen, Search, Sparkles } from "lucide-react";

import { ChatComposer } from "./ChatComposer";

const suggestions = [
  { icon: Sparkles, title: "Plan my day", hint: "Turn a to-do list into a schedule" },
  { icon: Search, title: "Research a topic", hint: "Summarize and compare sources" },
  { icon: NotebookPen, title: "Draft a message", hint: "Emails, posts and replies" },
  { icon: Lightbulb, title: "Brainstorm ideas", hint: "Explore angles on any problem" },
] as const;

export function ChatPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-8">
        <motion.div
          className="flex flex-col items-center gap-3 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div className="h-14 w-14 rounded-full bg-gradient-to-br from-violet-400 via-indigo-400 to-indigo-600 shadow-lg shadow-indigo-500/25" />
          <h1 className="text-2xl font-semibold tracking-tight">
            How can I help you today?
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Ask anything, or start from one of these.
          </p>
        </motion.div>

        <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          {suggestions.map((suggestion, index) => (
            <motion.button
              key={suggestion.title}
              type="button"
              className="group flex items-start gap-3 rounded-xl border border-border/70 bg-card/50 p-4 text-left transition-colors hover:border-border hover:bg-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.08 + index * 0.05, ease: "easeOut" }}
            >
              <suggestion.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              <span>
                <span className="block text-sm font-medium">{suggestion.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {suggestion.hint}
                </span>
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      <ChatComposer />
    </div>
  );
}
