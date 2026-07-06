import lunaLogo from "@/assets/luna-logo.svg";

import { WindowControls } from "./WindowControls";

/**
 * Custom title bar for the frameless window. The whole strip is a drag
 * region; interactive children opt out via `app-no-drag`.
 */
export function TitleBar() {
  return (
    <header className="app-drag flex h-10 shrink-0 items-center justify-between border-b border-border/60 bg-sidebar pl-4 select-none">
      <div className="flex items-center gap-2">
        <img src={lunaLogo} alt="" className="h-4 w-4" draggable={false} />
        <span className="text-xs font-medium tracking-wide text-muted-foreground">
          Luna
        </span>
      </div>
      <WindowControls />
    </header>
  );
}
