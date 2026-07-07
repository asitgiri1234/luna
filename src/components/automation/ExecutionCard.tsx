import { AlertCircle, Ban, Check, Loader2, Shield } from "lucide-react";

import type { ExecutionCard as ExecutionCardModel } from "@/automation/executor/types";
import { statusTone, toolLabel, toolRunningLabel } from "@/lib/automation-presentation";
import { cn } from "@/lib/utils";

/**
 * One execution card, e.g. "Launching VS Code…" → "✓ VS Code opened".
 * Purely presentational — driven by the automation store.
 */
export function ExecutionCard({ card }: { card: ExecutionCardModel }) {
  const tone = statusTone(card.status);

  const title =
    card.status === "running" || card.status === "planned"
      ? `${toolRunningLabel(card.toolName)}…`
      : card.status === "awaiting-permission"
        ? `${toolLabel(card.toolName)} — needs permission`
        : toolLabel(card.toolName);

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/70 px-3.5 py-2.5">
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          tone === "good" && "bg-emerald-500/15 text-emerald-400",
          tone === "bad" && "bg-red-500/15 text-red-400",
          tone === "active" && "bg-primary/15 text-primary",
          tone === "pending" && "bg-muted text-muted-foreground",
        )}
      >
        {tone === "good" && <Check className="h-3 w-3" />}
        {tone === "bad" && (card.status === "denied" ? <Ban className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />)}
        {card.status === "running" && <Loader2 className="h-3 w-3 animate-spin" />}
        {card.status === "awaiting-permission" && <Shield className="h-3 w-3" />}
        {card.status === "planned" && <Loader2 className="h-3 w-3 animate-spin" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {card.detail && (
          <p className={cn("mt-0.5 text-xs", tone === "bad" ? "text-red-400/90" : "text-muted-foreground")}>
            {card.detail}
          </p>
        )}
      </div>
    </div>
  );
}
