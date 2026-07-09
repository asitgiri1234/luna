import { type KeyboardEvent, useState } from "react";

import { motion } from "framer-motion";
import { Archive, ArchiveRestore, Check, Pencil, Trash2, X } from "lucide-react";

import { CATEGORY_META } from "@/lib/memory-categories";
import { cn } from "@/lib/utils";
import { useMemoryStore } from "@/store/memory/memory.store";
import type { MemoryRecord } from "@shared/memory";

const iconButtonClass =
  "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * One saved memory: its category, key, and (inline-editable) value, with
 * created / last-used dates and archive/restore + delete (confirmed).
 */
export function MemoryCard({ memory }: { memory: MemoryRecord }) {
  const editMemory = useMemoryStore((state) => state.editMemory);
  const deleteMemory = useMemoryStore((state) => state.deleteMemory);
  const archiveMemory = useMemoryStore((state) => state.archiveMemory);
  const unarchiveMemory = useMemoryStore((state) => state.unarchiveMemory);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory.value);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const meta = CATEGORY_META[memory.category];
  const Icon = meta.icon;

  const commit = (): void => {
    setEditing(false);
    const value = draft.trim();
    if (value && value !== memory.value) void editMemory(memory.id, { value });
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
        "group/mem flex flex-col gap-3 rounded-xl border border-border/70 bg-card/50 p-4 transition-colors hover:border-border",
        memory.isArchived && "opacity-60",
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            meta.badgeClass,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase">
            {memory.key}
          </p>
          {editing ? (
            <textarea
              autoFocus
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={handleKeys}
              className="mt-0.5 w-full resize-none rounded-lg border border-ring/50 bg-transparent px-2 py-1.5 text-sm focus:outline-none"
            />
          ) : (
            <p className="mt-0.5 text-sm">{memory.value}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Added {formatDate(memory.createdAt)}
            {" · "}
            {memory.lastUsed ? `Last used ${formatDate(memory.lastUsed)}` : "Never used"}
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

        {!confirmingDelete && (
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
                  onClick={() =>
                    void (memory.isArchived
                      ? unarchiveMemory(memory.id)
                      : archiveMemory(memory.id))
                  }
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
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {confirmingDelete && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2">
          <span className="text-xs text-muted-foreground">Delete this memory permanently?</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md bg-red-500/90 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-500"
              onClick={() => void deleteMemory(memory.id)}
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </div>
        </div>
      )}
    </motion.article>
  );
}
