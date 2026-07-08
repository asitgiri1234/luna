import { AlertTriangle, Layers, Loader2, ScanText } from "lucide-react";

import { formatReadingTime } from "@/lib/document-presentation";
import { cn } from "@/lib/utils";
import { useDocumentsStore } from "@/store/documents/documents.store";
import { isDocumentKind } from "@shared/documents";
import { type FileKind, isImageKind } from "@shared/files";

/**
 * The status row at the foot of a file's card: a spinner while a text
 * document is parsed or an image is OCR'd (with progress), headline
 * metrics when ready, or a retry affordance on failure. Only rendered for
 * text documents and images.
 */
export function DocumentStrip({ fileId, kind }: { fileId: string; kind: FileKind }) {
  const entry = useDocumentsStore((state) => state.byFileId[fileId]);
  const openDetail = useDocumentsStore((state) => state.openDetail);
  const process = useDocumentsStore((state) => state.process);
  const ocr = useDocumentsStore((state) => state.ocr);

  const image = isImageKind(kind);
  if (!isDocumentKind(kind) && !image) return null;

  const phase = entry?.phase ?? "idle";
  const retry = (): void => void (image ? ocr(fileId) : process(fileId, true));

  if (phase === "processing" || phase === "idle") {
    const pct = image && entry?.progress ? ` ${Math.round(entry.progress * 100)}%` : "";
    return (
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        {image ? `Reading text…${pct}` : "Analyzing…"}
      </div>
    );
  }

  if (phase === "failed") {
    // Images: open the detail panel (where re-run + visual analysis live).
    if (image) {
      return (
        <button
          type="button"
          onClick={() => void openDetail(fileId)}
          className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          title={entry?.error ?? "No text found"}
        >
          <ScanText className="h-3 w-3" />
          No text · View &amp; analyze
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={retry}
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
        {image
          ? `${record.wordCount} words`
          : `${record.pageCount}p · ${formatReadingTime(record.readingTimeMinutes)}`}
      </span>
      <span className="ml-auto flex items-center gap-1 text-muted-foreground/80">
        <Layers className="h-3 w-3" />
        {record.chunkCount}
      </span>
    </button>
  );
}
