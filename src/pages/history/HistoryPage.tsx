import { motion } from "framer-motion";
import { MessageSquare, Pin, Search, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Input } from "@/components/ui/input";
import { PageContainer } from "@/layouts/PageContainer";
import {
  filterConversations,
  formatRecency,
  groupConversations,
} from "@/lib/conversation-groups";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/store/conversations/conversation.store";

/** Browsable, searchable catalog of saved conversations. */
export function HistoryPage() {
  const navigate = useNavigate();
  const conversations = useConversationStore((state) => state.conversations);
  const query = useConversationStore((state) => state.query);
  const status = useConversationStore((state) => state.status);
  const setQuery = useConversationStore((state) => state.setQuery);
  const select = useConversationStore((state) => state.select);
  const togglePin = useConversationStore((state) => state.togglePin);
  const remove = useConversationStore((state) => state.remove);

  const groups = groupConversations(filterConversations(conversations, query));

  return (
    <PageContainer title="Chats" description="Browse and search your past conversations.">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search chats…"
            className="h-10 rounded-xl pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        {status === "unavailable" && (
          <p className="text-sm text-muted-foreground">
            Chat history is unavailable — the local database could not be opened.
          </p>
        )}
        {status === "ready" && groups.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {query ? "No chats match your search." : "No conversations yet — start a new chat."}
          </p>
        )}

        {groups.map((group, groupIndex) => (
          <section key={group.label}>
            <h2 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {group.label}
            </h2>
            <div className="space-y-1">
              {group.conversations.map((conversation, index) => (
                <motion.div
                  key={conversation.id}
                  className="group/row relative"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (groupIndex * 2 + index) * 0.03, duration: 0.25 }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      void select(conversation.id);
                      navigate("/chat");
                    }}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent"
                  >
                    <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <span className="truncate">{conversation.title}</span>
                        {conversation.isPinned && (
                          <Pin className="h-3 w-3 shrink-0 text-primary" />
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {conversation.lastMessagePreview || "No messages yet"}
                      </span>
                    </span>
                    <span className="shrink-0 pr-14 text-xs text-muted-foreground/70">
                      {formatRecency(conversation.updatedAt)}
                    </span>
                  </button>

                  <div className="absolute top-1/2 right-2 hidden -translate-y-1/2 items-center gap-1 group-hover/row:flex">
                    <button
                      type="button"
                      aria-label={conversation.isPinned ? "Unpin" : "Pin"}
                      className={cn(
                        "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                        conversation.isPinned && "text-primary",
                      )}
                      onClick={() => void togglePin(conversation.id)}
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-red-400"
                      onClick={() => void remove(conversation.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageContainer>
  );
}
