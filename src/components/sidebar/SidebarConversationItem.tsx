import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import type { ConversationMeta } from "@shared/conversations";
import { Check, Pencil, Pin, PinOff, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface SidebarConversationItemProps {
  conversation: ConversationMeta;
  isActive: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onTogglePin: () => void;
  onDelete: () => void;
}

const iconButtonClass =
  "rounded p-1 text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground";

/**
 * One conversation row: click to open, hover for pin / rename / delete.
 * Rename happens inline; delete asks for a second click within 2.5 s.
 */
export function SidebarConversationItem({
  conversation,
  isActive,
  onSelect,
  onRename,
  onTogglePin,
  onDelete,
}: SidebarConversationItemProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(conversation.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(confirmTimer.current), []);

  const commitRename = (): void => {
    setRenaming(false);
    const title = draft.trim();
    if (title && title !== conversation.title) onRename(title);
    else setDraft(conversation.title);
  };

  const handleRenameKeys = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") commitRename();
    if (event.key === "Escape") {
      setDraft(conversation.title);
      setRenaming(false);
    }
  };

  const handleDeleteClick = (): void => {
    if (confirmingDelete) {
      window.clearTimeout(confirmTimer.current);
      onDelete();
      return;
    }
    setConfirmingDelete(true);
    confirmTimer.current = window.setTimeout(() => setConfirmingDelete(false), 2500);
  };

  if (renaming) {
    return (
      <div className="px-1 py-0.5">
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitRename}
          onKeyDown={handleRenameKeys}
          className="w-full rounded-lg border border-ring/50 bg-transparent px-2 py-1.5 text-sm focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/item relative flex items-center rounded-lg transition-colors",
        isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "min-w-0 flex-1 truncate px-3 py-2 text-left text-sm",
          isActive ? "text-sidebar-accent-foreground" : "text-muted-foreground",
        )}
        title={conversation.title}
      >
        {conversation.title}
      </button>

      <div className="absolute right-1 hidden items-center gap-0.5 rounded-md bg-sidebar-accent/95 px-0.5 group-hover/item:flex">
        <button
          type="button"
          aria-label={conversation.isPinned ? "Unpin" : "Pin"}
          className={iconButtonClass}
          onClick={onTogglePin}
        >
          {conversation.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          aria-label="Rename"
          className={iconButtonClass}
          onClick={() => {
            setDraft(conversation.title);
            setRenaming(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label={confirmingDelete ? "Confirm delete" : "Delete"}
          className={cn(iconButtonClass, confirmingDelete && "text-red-400 hover:text-red-300")}
          onClick={handleDeleteClick}
        >
          {confirmingDelete ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
