import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { filterConversations, groupConversations } from "@/lib/conversation-groups";
import { useConversationStore } from "@/store/conversations/conversation.store";

import { SidebarConversationItem } from "./SidebarConversationItem";

/**
 * Saved-conversation section of the sidebar: search box + grouped list
 * (Pinned / Today / Yesterday / Last Week / Older). Pure rendering —
 * all data and actions come from the conversation store.
 */
export function SidebarConversations() {
  const navigate = useNavigate();
  const conversations = useConversationStore((state) => state.conversations);
  const activeId = useConversationStore((state) => state.activeId);
  const query = useConversationStore((state) => state.query);
  const status = useConversationStore((state) => state.status);
  const setQuery = useConversationStore((state) => state.setQuery);
  const select = useConversationStore((state) => state.select);
  const rename = useConversationStore((state) => state.rename);
  const togglePin = useConversationStore((state) => state.togglePin);
  const remove = useConversationStore((state) => state.remove);

  if (status === "unavailable") {
    return (
      <div className="px-4 py-3 text-xs text-muted-foreground/70">
        Chat history is unavailable — conversations won&apos;t be saved this session.
      </div>
    );
  }

  const groups = groupConversations(filterConversations(conversations, query));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative px-3 pb-2">
        <Search className="absolute top-1/2 left-6 h-3.5 w-3.5 -translate-y-[80%] text-muted-foreground/70" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search chats…"
          className="w-full rounded-lg border border-border/50 bg-transparent py-1.5 pr-2 pl-8 text-xs placeholder:text-muted-foreground/70 focus:border-ring/50 focus:outline-none"
        />
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-2">
        {groups.length === 0 && status === "ready" && (
          <p className="px-1 pt-1 text-xs text-muted-foreground/70">
            {query ? "No chats match your search." : "No conversations yet."}
          </p>
        )}
        {groups.map((group) => (
          <section key={group.label}>
            <h3 className="px-1 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
              {group.label}
            </h3>
            <div className="space-y-0.5">
              {group.conversations.map((conversation) => (
                <SidebarConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isActive={conversation.id === activeId}
                  onSelect={() => {
                    void select(conversation.id);
                    navigate("/chat");
                  }}
                  onRename={(title) => void rename(conversation.id, title)}
                  onTogglePin={() => void togglePin(conversation.id)}
                  onDelete={() => void remove(conversation.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
