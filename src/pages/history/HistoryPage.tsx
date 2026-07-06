import type { ChatSummary } from "@/types";

import { motion } from "framer-motion";
import { MessageSquare, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { PageContainer } from "@/layouts/PageContainer";

/** Placeholder data until chat persistence lands. */
const chatGroups: { label: string; chats: ChatSummary[] }[] = [
  {
    label: "Today",
    chats: [
      {
        id: "1",
        title: "Welcome to Luna",
        snippet: "Your conversations will appear here once chat is connected.",
        updatedAt: "2:14 PM",
      },
    ],
  },
  {
    label: "Previous 7 days",
    chats: [
      {
        id: "2",
        title: "Getting started",
        snippet: "A quick tour of what Luna will be able to do.",
        updatedAt: "Wed",
      },
      {
        id: "3",
        title: "Ideas for the weekend",
        snippet: "Sample conversation entry for the shell UI.",
        updatedAt: "Mon",
      },
    ],
  },
];

export function HistoryPage() {
  return (
    <PageContainer title="Chats" description="Browse and search your past conversations.">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search chats…" className="h-10 rounded-xl pl-9" />
        </div>

        {chatGroups.map((group, groupIndex) => (
          <section key={group.label}>
            <h2 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {group.label}
            </h2>
            <div className="space-y-1">
              {group.chats.map((chat, index) => (
                <motion.button
                  key={chat.id}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (groupIndex * 2 + index) * 0.04, duration: 0.25 }}
                >
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {chat.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {chat.snippet}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground/70">
                    {chat.updatedAt}
                  </span>
                </motion.button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageContainer>
  );
}
