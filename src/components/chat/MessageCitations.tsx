import { FileText, Info } from "lucide-react";

import type { MessageDocumentContext } from "@/ai/types";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/store/chat/chat.store";

/**
 * Renders document-chat grounding under an assistant reply: a "No
 * relevant information found" note, or the documents used plus clickable
 * citation chips. Clicking a citation opens the source document.
 */
export function MessageCitations({ documentChat }: { documentChat: MessageDocumentContext }) {
  const openCitation = useChatStore((state) => state.openCitation);

  if (documentChat.noResults) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/50 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" />
        No relevant information found in your documents.
      </div>
    );
  }

  if (documentChat.citations.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
          Sources
        </span>
        {documentChat.documentsUsed.map((doc) => (
          <span
            key={doc.documentId}
            className="inline-flex items-center gap-1 rounded-full bg-secondary/60 px-2 py-0.5 text-[11px] text-muted-foreground"
          >
            <FileText className="h-3 w-3" />
            {doc.title}
            {doc.chunkCount > 1 && <span className="text-muted-foreground/60">×{doc.chunkCount}</span>}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {documentChat.citations.map((citation) => (
          <button
            key={citation.id}
            type="button"
            onClick={() => openCitation(citation)}
            title={`${citation.documentTitle}${citation.page ? ` · Page ${citation.page}` : ""}\n${citation.snippet}`}
            className={cn(
              "group inline-flex max-w-full items-center gap-1 rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[11px]",
              "text-muted-foreground transition-colors hover:border-ring/50 hover:text-foreground",
            )}
          >
            <span className="rounded bg-secondary px-1 font-medium text-foreground/80">
              {citation.index}
            </span>
            <span className="truncate">
              {citation.documentTitle}
              {citation.page ? ` · p.${citation.page}` : ""}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
