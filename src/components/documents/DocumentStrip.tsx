import { AlertTriangle, Layers, Loader2, ScanText } from "lucide-react";

import { formatReadingTime } from "@/lib/document-presentation";
import { cn } from "@/lib/utils";
import { useDocumentsStore } from "@/store/documents/documents.store";
import { isDocumentKind } from "@shared/documents";
import type { FileKind } from "@shared/files";

/**
 * The Document Intelligence status row shown at the foot of a document
 * file's card: a spinner while parsing, headline metrics when ready, or a
 * retry affordance on failure. Images and unsupported kinds render nothing.
 */
export function DocumentStrip({ fileId, kind }: { fileId: string; kind: FileKind }) {
  const entry = useDocumentsStore((state) => state.byFileId[fileId]);
  const openDetail = useDocumentsStore((state) => state.openDetail);
  const process = useDocumentsStore((state) => state.process);

  if (!isDocumentKind(kind)) return null;

  const phase = entry?.phase ?? "idle";

  if (phase === "processing" || phase === "idle") {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Analyzing…
      </div>
    );
  }

  if (phase === "failed") {
    return (
      <button
        type="button"
        onClick={() => void process(fileId, true)}
        className="mt-1 flex items-center gap-1.5 text-xs text-amber-400/90 transition-colors hover:text-amber-300"
        title={entry?.error ?? "Parsing failed"}
      >
        <AlertTriangle className="h-3 w-3" />
        Couldn&apos;t read · Retry
      </button>
    );
  }

  const record = entry?.record;
  if (!record) return null;

  return (
    <button
      type="button"
      onClick={() => void openDetail(fileId)}
      className={cn(
        "mt-1 flex w-full items-center gap-2 rounded-md text-xs text-muted-foreground",
        "transition-colors hover:text-foreground",
      )}
    >
      <span className="flex items-center gap-1">
        <ScanText className="h-3 w-3" />
        {record.pageCount}p · {formatReadingTime(record.readingTimeMinutes)}
      </span>
      <span className="ml-auto flex items-center gap-1 text-muted-foreground/80">
        <Layers className="h-3 w-3" />
        {record.chunkCount}
      </span>
    </button>
  );
}
