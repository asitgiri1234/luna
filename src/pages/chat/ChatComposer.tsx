import { useState } from "react";

import { ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Message input bar. Purely presentational in this milestone — sending
 * is wired up when the AI layer lands.
 */
export function ChatComposer() {
  const [value, setValue] = useState("");

  return (
    <div className="shrink-0 px-8 pb-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-end gap-2 rounded-2xl border border-border/70 bg-card p-2 shadow-lg shadow-black/20 transition-colors focus-within:border-ring/50">
          <textarea
            rows={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Message Luna…"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <Button
            size="icon"
            aria-label="Send message"
            disabled={value.trim().length === 0}
            className="rounded-xl"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
          Luna is an early preview. Responses are not yet connected.
        </p>
      </div>
    </div>
  );
}
