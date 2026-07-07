import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Copy, Loader2, X } from "lucide-react";

import { formatSize } from "@/lib/file-presentation";
import { cn } from "@/lib/utils";
import { type UploadItem, useFilesStore } from "@/store/files/files.store";

/** Live upload progress rows shown while files copy into the workspace. */
export function UploadList() {
  const uploads = useFilesStore((state) => state.uploads);
  const dismiss = useFilesStore((state) => state.dismissUpload);
  if (uploads.length === 0) return null;

  return (
    <div className="mb-5 space-y-2">
      <AnimatePresence initial={false}>
        {uploads.map((upload) => (
          <motion.div
            key={upload.uploadId}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-border/70 bg-card/60 p-3"
          >
            <div className="flex items-center gap-2.5">
              <StatusIcon upload={upload} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {upload.filename}
              </span>
              <span className="text-xs text-muted-foreground">{label(upload)}</span>
              {(upload.status === "error" || upload.status === "duplicate") && (
                <button
                  type="button"
                  aria-label="Dismiss"
                  className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                  onClick={() => dismiss(upload.uploadId)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {upload.status === "uploading" && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-150"
                  style={{ width: `${percent(upload)}%` }}
                />
              </div>
            )}
            {upload.status === "error" && upload.error && (
              <p className="mt-1 text-xs text-red-400">{upload.error}</p>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function percent(upload: UploadItem): number {
  if (upload.total === 0) return 8;
  return Math.min(100, Math.round((upload.loaded / upload.total) * 100));
}

function label(upload: UploadItem): string {
  switch (upload.status) {
    case "uploading":
      return upload.total ? `${formatSize(upload.loaded)} / ${formatSize(upload.total)}` : "Adding…";
    case "done":
      return "Added";
    case "duplicate":
      return "Already added";
    case "error":
      return "Failed";
  }
}

function StatusIcon({ upload }: { upload: UploadItem }) {
  const base = "h-4 w-4 shrink-0";
  if (upload.status === "uploading") return <Loader2 className={cn(base, "animate-spin text-primary")} />;
  if (upload.status === "done") return <CheckCircle2 className={cn(base, "text-emerald-400")} />;
  if (upload.status === "duplicate") return <Copy className={cn(base, "text-amber-400")} />;
  return <AlertCircle className={cn(base, "text-red-400")} />;
}
