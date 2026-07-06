import { motion } from "framer-motion";
import { Ban, Check, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CATEGORY_META } from "@/lib/memory-categories";
import { cn } from "@/lib/utils";
import { type PendingCandidate, useMemoryStore } from "@/store/memory/memory.store";

/**
 * "Luna would like to remember" card. The only place a memory can be
 * approved — nothing persists until the user chooses. Shows the
 * category, the proposed value, and Luna's reason.
 */
export function MemoryApprovalCard({ candidate }: { candidate: PendingCandidate }) {
  const approve = useMemoryStore((state) => state.approve);
  const ignore = useMemoryStore((state) => state.ignore);
  const alwaysSimilar = useMemoryStore((state) => state.alwaysSimilar);
  const neverSimilar = useMemoryStore((state) => state.neverSimilar);

  const meta = CATEGORY_META[candidate.category];
  const Icon = meta.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="rounded-2xl border border-primary/25 bg-card/95 p-4 shadow-xl shadow-black/30 backdrop-blur"
    >
      <div className="flex items-center gap-2 text-xs font-medium text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        Luna would like to remember
      </div>

      <div className="mt-3 flex items-start gap-3">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.badgeClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
              meta.badgeClass,
            )}
          >
            {meta.label}
          </span>
          <p className="mt-1.5 text-sm font-medium text-foreground">{candidate.value}</p>
          {candidate.reason && (
            <p className="mt-1 text-xs text-muted-foreground">{candidate.reason}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" className="gap-1.5" onClick={() => void approve(candidate.localId)}>
          <Check className="h-3.5 w-3.5" />
          Remember
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5"
          onClick={() => ignore(candidate.localId)}
        >
          <X className="h-3.5 w-3.5" />
          Ignore
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-xs"
          onClick={() => void alwaysSimilar(candidate.localId)}
        >
          <Check className="h-3.5 w-3.5" />
          Always similar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
          onClick={() => void neverSimilar(candidate.localId)}
        >
          <Ban className="h-3.5 w-3.5" />
          Never similar
        </Button>
      </div>
    </motion.div>
  );
}
