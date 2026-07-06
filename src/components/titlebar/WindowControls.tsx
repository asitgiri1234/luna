import { Copy, Minus, Square, X } from "lucide-react";

import { useWindowState } from "@/hooks/useWindowState";
import { cn } from "@/lib/utils";
import { windowService } from "@/services/window.service";

const controlClass =
  "app-no-drag inline-flex h-10 w-12 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

export function WindowControls() {
  const { isMaximized } = useWindowState();

  return (
    <div className="flex items-stretch">
      <button
        type="button"
        aria-label="Minimize"
        className={controlClass}
        onClick={() => windowService.minimize()}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={isMaximized ? "Restore" : "Maximize"}
        className={controlClass}
        onClick={() => windowService.toggleMaximize()}
      >
        {isMaximized ? (
          <Copy className="h-3 w-3 -scale-x-100" />
        ) : (
          <Square className="h-3 w-3" />
        )}
      </button>
      <button
        type="button"
        aria-label="Close"
        className={cn(controlClass, "hover:bg-red-600 hover:text-white")}
        onClick={() => windowService.close()}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
