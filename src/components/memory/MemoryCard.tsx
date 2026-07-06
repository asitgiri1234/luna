import { type KeyboardEvent, useState } from "react";

import { motion } from "framer-motion";
import { Archive, ArchiveRestore, Check, Pencil, Trash2, X } from "lucide-react";

import { CATEGORY_META } from "@/lib/memory-categories";
import { cn } from "@/lib/utils";
import { useMemoryStore } from "@/store/memory/memory.store";
import type { MemoryRecord } from "@shared/memory";

const iconButtonClass =
  "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";

/** One saved memory: inline-editable value, with archive/restore + delete. */
export function MemoryCard({ memory }: { memory: MemoryRecord }) {
  const edit = useMemoryStore((state) => state.edit);
  const remove = useMemoryStore((state) => state.remove);
  const setArchived = useMemoryStore((state) => state.setArchived);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory.value);

  const meta = CATEGORY_META[memory.category];
  const Icon = meta.icon;

  const commit = (): void => {
    setEditing(false);
    const value = draft.trim();
    if (value && value !== memory.value) void edit(memory.id, { value });
    else setDraft(memory.value);
  };

  const handleKeys = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commit();
    }
    if (event.key === "Escape") {
      setDraft(memory.value);
      setEditing(false);
    }
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group/mem flex items-start gap-4 rounded-xl border border-border/70 bg-card/50 p-4 transition-colors hover:border-border",
        memory.isArchived && "opacity-60",
      )}
    >
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", meta.badgeClass)}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        {editing ? (
          <textarea
            autoFocus
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={handleKeys}
            className="w-full resize-none rounded-lg border border-ring/50 bg-transparent px-2 py-1.5 text-sm focus:outline-none"
          />
        ) : (
          <p className="text-sm">{memory.value}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {memory.lastUsed ? "Used recently · " : ""}
          Added {new Date(memory.createdAt).toLocaleDateString()}
        </p>
      </div>

      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
          meta.badgeClass,
        )}
      >
        {meta.label}
      </span>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/mem:opacity-100">
        {editing ? (
          <>
            <button type="button" aria-label="Save" className={iconButtonClass} onClick={commit}>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            </button>
            <button
              type="button"
              aria-label="Cancel"
              className={iconButtonClass}
              onClick={() => {
                setDraft(memory.value);
                setEditing(false);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-label="Edit"
              className={iconButtonClass}
              onClick={() => {
                setDraft(memory.value);
                setEditing(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label={memory.isArchived ? "Restore" : "Archive"}
              className={iconButtonClass}
              onClick={() => void setArchived(memory.id, !memory.isArchived)}
            >
              {memory.isArchived ? (
                <ArchiveRestore className="h-3.5 w-3.5" />
              ) : (
                <Archive className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              aria-label="Delete"
              className={cn(iconButtonClass, "hover:text-red-400")}
              onClick={() => void remove(memory.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </motion.article>
  );
}
