import { Check, Copy, RefreshCw } from "lucide-react";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

interface ChatMessageActionsProps {
  content: string;
  canRegenerate: boolean;
  onRegenerate: () => void;
}

const actionClass =
  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

/** Copy / regenerate row under a completed assistant message. */
export function ChatMessageActions({
  content,
  canRegenerate,
  onRegenerate,
}: ChatMessageActionsProps) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover/message:opacity-100 focus-within:opacity-100">
      <button type="button" className={actionClass} onClick={() => void copy(content)}>
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy"}
      </button>
      {canRegenerate && (
        <button type="button" className={actionClass} onClick={onRegenerate}>
          <RefreshCw className="h-3.5 w-3.5" />
          Regenerate
        </button>
      )}
    </div>
  );
}
