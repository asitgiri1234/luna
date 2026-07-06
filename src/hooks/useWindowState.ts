import { useEffect, useState } from "react";

import { windowService } from "@/services/window.service";

/**
 * Tracks whether the native window is currently maximized so the title
 * bar can swap its maximize/restore control.
 */
export function useWindowState() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void windowService.isMaximized().then((value) => {
      if (!cancelled) setIsMaximized(value);
    });

    const unsubscribe = windowService.onMaximizedChange(setIsMaximized);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { isMaximized };
}
