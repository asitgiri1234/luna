import { AnimatePresence, motion } from "framer-motion";
import { FileText, RefreshCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { documentMetrics, languageName } from "@/lib/document-presentation";
import { useDocumentsStore } from "@/store/documents/documents.store";
import type { DocumentChunk } from "@shared/documents";

/** Stable empty reference so selectors never return a fresh array (avoids render loops). */
const NO_CHUNKS: DocumentChunk[] = [];

/**
 * A slide-in panel showing everything Document Intelligence extracted for
 * one file: title/author, headline metrics (pages / words / reading time
 * / chunk count), a normalized-text preview, and the ordered chunks that
 * a future embedding step will consume. Read-only — no AI, no search.
 */
export function DocumentDetail() {
  const selectedFileId = useDocumentsStore((state) => state.selectedFileId);
  const entry = useDocumentsStore((state) =>
    selectedFileId ? state.byFileId[selectedFileId] : undefined,
  );
  const docId = entry?.record?.id;
  const chunks =
    useDocumentsStore((state) => (docId ? state.chunksByDoc[docId] : undefined)) ?? NO_CHUNKS;
  const close = useDocumentsStore((state) => state.closeDetail);
  const process = useDocumentsStore((state) => state.process);

  const open = Boolean(selectedFileId);
  const record = entry?.record ?? null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={close}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border/70 bg-card shadow-2xl"
          >
            <header className="flex items-start gap-3 border-b border-border/60 p-4">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <FileText className="h-4.5 w-4.5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold" title={record?.title}>
                  {record?.title ?? "Document"}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {record?.author ? `${record.author} · ` : ""}
                  {record ? languageName(record.language) : ""}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={close}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              {record?.status === "failed" ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-300">
                  {record.error ?? "This document could not be parsed."}
                </div>
              ) : record ? (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    {documentMetrics(record).map((metric) => (
                      <div
                        key={metric.label}
                        className="rounded-lg border border-border/60 bg-secondary/30 p-2 text-center"
                      >
                        <p className="text-sm font-semibold tabular-nums">{metric.value}</p>
                        <p className="mt-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
                          {metric.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  <Section title="Preview">
                    <p className="max-h-56 overflow-y-auto rounded-lg border border-border/50 bg-background/40 p-3 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                      {record.preview || "No preview available."}
                    </p>
                  </Section>

                  <Section title={`Chunks (${record.chunkCount})`}>
                    <div className="space-y-2">
                      {chunks.map((chunk) => (
                        <div
                          key={chunk.id}
                          className="rounded-lg border border-border/50 bg-background/40 p-2.5"
                        >
                          <div className="mb-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="rounded bg-secondary px-1.5 py-0.5 font-medium">
                              #{chunk.position + 1}
                            </span>
                            {chunk.metadata.page ? <span>p.{chunk.metadata.page}</span> : null}
                            <span className="ml-auto">{chunk.metadata.wordCount} words</span>
                          </div>
                          {chunk.metadata.headingPath && chunk.metadata.headingPath.length > 0 && (
                            <p className="mb-1 truncate text-[10px] text-muted-foreground/80">
                              {chunk.metadata.headingPath.join(" › ")}
                            </p>
                          )}
                          <p className="line-clamp-3 text-xs leading-relaxed text-foreground/90">
                            {chunk.text}
                          </p>
                        </div>
                      ))}
                      {chunks.length === 0 && (
                        <p className="text-xs text-muted-foreground">No chunks.</p>
                      )}
                    </div>
                  </Section>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No document data.</p>
              )}
            </div>

            {record && selectedFileId && (
              <footer className="border-t border-border/60 p-3">
                <Button
                  variant="secondary"
                  className="w-full gap-2"
                  onClick={() => void process(selectedFileId, true)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Re-process
                </Button>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
