import type { MemoryItem } from "@/types";

import { motion } from "framer-motion";
import { Brain } from "lucide-react";

import { PageContainer } from "@/layouts/PageContainer";
import { cn } from "@/lib/utils";

/** Placeholder data until the memory system lands. */
const memories: MemoryItem[] = [
  {
    id: "1",
    content: "Prefers concise answers with code examples.",
    category: "preference",
    createdAt: "Jul 6, 2026",
  },
  {
    id: "2",
    content: "Working on a desktop assistant called Luna.",
    category: "context",
    createdAt: "Jul 6, 2026",
  },
  {
    id: "3",
    content: "Primary development machine runs Windows 11.",
    category: "fact",
    createdAt: "Jul 6, 2026",
  },
];

const categoryStyles: Record<MemoryItem["category"], string> = {
  preference: "bg-violet-500/15 text-violet-300",
  context: "bg-sky-500/15 text-sky-300",
  fact: "bg-emerald-500/15 text-emerald-300",
};

export function MemoryPage() {
  return (
    <PageContainer
      title="Memory"
      description="Things Luna remembers about you to personalize every conversation."
    >
      <div className="mx-auto grid max-w-3xl gap-3">
        {memories.map((memory, index) => (
          <motion.article
            key={memory.id}
            className="flex items-start gap-4 rounded-xl border border-border/70 bg-card/50 p-4 transition-colors hover:border-border hover:bg-card"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.25 }}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <Brain className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">{memory.content}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Added {memory.createdAt}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize",
                categoryStyles[memory.category],
              )}
            >
              {memory.category}
            </span>
          </motion.article>
        ))}
      </div>
    </PageContainer>
  );
}
