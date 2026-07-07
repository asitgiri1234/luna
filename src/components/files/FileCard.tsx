import { type KeyboardEvent, useEffect, useState } from "react";

import { motion } from "framer-motion";
import { Check, ExternalLink, FolderOpen, Pencil, Trash2, X } from "lucide-react";

import { DocumentStrip } from "@/components/documents/DocumentStrip";
import { fileService } from "@/files/file.service";
import { KIND_META, formatDate, formatSize } from "@/lib/file-presentation";
import { cn } from "@/lib/utils";
import { useFilesStore } from "@/store/files/files.store";
import { type FileRecord, isImageKind } from "@shared/files";

const iconButton =
  "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";

/** A single uploaded file: image thumbnail or type icon, metadata, actions. */
export function FileCard({ file }: { file: FileRecord }) {
  const rename = useFilesStore((state) => state.rename);
  const remove = useFilesStore((state) => state.remove);
  const open = useFilesStore((state) => state.open);
  const reveal = useFilesStore((state) => state.reveal);

  const meta = KIND_META[file.type];
  const Icon = meta.icon;

  const [preview, setPreview] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(file.filename);

  // Lazily load the image thumbnail once per card.
  useEffect(() => {
    let active = true;
    if (isImageKind(file.type)) {
      void fileService.preview(file.id).then((url) => {
        if (active) setPreview(url);
      });
    }
    return () => {
      active = false;
    };
  }, [file.id, file.type]);

  const commit = (): void => {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== file.filename) void rename(file.id, name);
    else setDraft(file.filename);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") commit();
    if (event.key === "Escape") {
      setDraft(file.filename);
      setEditing(false);
    }
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group/file flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card/50 transition-colors hover:border-border"
    >
      <div className="relative flex h-32 items-center justify-center bg-secondary/40">
        {preview ? (
          <img src={preview} alt={file.filename} className="h-full w-full object-cover" />
        ) : (
          <div className={cn("flex h-14 w-14 items-center justify-center rounded-xl", meta.tint)}>
            <Icon className="h-7 w-7" />
          </div>
        )}
        <span className="absolute top-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
          {meta.label}
        </span>
        <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 transition-opacity group-hover/file:opacity-100">
          <button type="button" aria-label="Open" className={cn(iconButton, "bg-black/40 text-white hover:bg-black/60 hover:text-white")} onClick={() => void open(file.id)}>
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button type="button" aria-label="Show in folder" className={cn(iconButton, "bg-black/40 text-white hover:bg-black/60 hover:text-white")} onClick={() => void reveal(file.id)}>
            <FolderOpen className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={onKeyDown}
              className="min-w-0 flex-1 rounded-md border border-ring/50 bg-transparent px-1.5 py-1 text-sm focus:outline-none"
            />
            <button type="button" aria-label="Save name" className={iconButton} onMouseDown={(e) => e.preventDefault()} onClick={commit}>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            </button>
          </div>
        ) : (
          <p className="truncate text-sm font-medium" title={file.filename}>
            {file.filename}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {formatSize(file.size)} · {formatDate(file.createdAt)}
        </p>

        <DocumentStrip fileId={file.id} kind={file.type} />

        <div className="mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/file:opacity-100">
          <button
            type="button"
            aria-label="Rename"
            className={iconButton}
            onClick={() => {
              setDraft(file.filename);
              setEditing(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Delete"
            className={cn(iconButton, "hover:text-red-400")}
            onClick={() => void remove(file.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {editing && (
            <button type="button" aria-label="Cancel" className={iconButton} onClick={() => { setDraft(file.filename); setEditing(false); }}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}
