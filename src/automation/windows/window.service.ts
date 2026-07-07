/**
 * # Window service (renderer)
 *
 * Placeholder seam for OS window management (focus, minimize, arrange).
 * The "already running → focus" behavior currently lives in the
 * main-process application launcher (`electron/automation/applications.ts`
 * calls WScript.Shell AppActivate), which is the most reliable path on
 * Windows.
 *
 * ## Extension point
 * When Luna needs richer window control (tile two apps, move a window to
 * another monitor), those operations get IPC channels and land here,
 * consumed by executors — without changing the execution engine.
 */
export const windowService = {
  /**
   * Whether Luna can focus application windows. Focus is currently
   * handled during launch; this reports the capability for future UIs.
   */
  canFocusWindows(): boolean {
    return window.luna?.platform === "win32";
  },
};
