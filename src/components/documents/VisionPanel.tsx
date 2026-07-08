import { Eye, Loader2, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDocumentsStore } from "@/store/documents/documents.store";

/**
 * Visual analysis section shown in the document detail panel for image
 * files: caption, description, detected objects, and scene summary from
 * the local vision model — or a button to run the (background) analysis
 * with progress. Read-only; no image chat.
 */
export function VisionPanel({ fileId }: { fileId: string }) {
  const entry = useDocumentsStore((state) => state.visionByFileId[fileId]);
  const analyze = useDocumentsStore((state) => state.analyzeVision);

  const phase = entry?.phase ?? "idle";
  const analysis = entry?.analysis ?? null;

  return (
    <section className="mt-4">
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <Eye className="h-3.5 w-3.5" />
        Visual analysis
      </h3>

      {phase === "analyzing" ? (
        <div className="rounded-lg border border-border/50 bg-background/40 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Analyzing image…
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.round((entry?.progress ?? 0) * 100)}%` }}
            />
          </div>
        </div>
      ) : phase === "failed" ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">
          <p>{entry?.error ?? "Vision analysis failed."}</p>
          <Button variant="secondary" className="mt-2 h-7 gap-1.5 text-xs" onClick={() => void analyze(fileId)}>
            <RefreshCw className="h-3 w-3" />
            Try again
          </Button>
        </div>
      ) : analysis ? (
        <div className="space-y-3 rounded-lg border border-border/50 bg-background/40 p-3">
          <p className="text-sm font-medium">{analysis.caption}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{analysis.description}</p>
          {analysis.objects.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {analysis.objects.map((obj, i) => (
                <span
                  key={`${obj}-${i}`}
                  className="rounded-full bg-secondary/70 px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {obj}
                </span>
              ))}
            </div>
          )}
          {analysis.sceneSummary && (
            <p className="text-[11px] text-muted-foreground/80 italic">{analysis.sceneSummary}</p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] text-muted-foreground/60">via {analysis.model}</span>
            <button
              type="button"
              onClick={() => void analyze(fileId)}
              className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3 w-3" />
              Re-analyze
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/60 p-3 text-center">
          <p className="text-xs text-muted-foreground">
            Describe this image with your local vision model.
          </p>
          <Button className="mt-2 h-7 gap-1.5 text-xs" onClick={() => void analyze(fileId)}>
            <Sparkles className="h-3 w-3" />
            Analyze image
          </Button>
        </div>
      )}
    </section>
  );
}
