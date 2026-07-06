/**
 * Thin service over the Electron window bridge.
 *
 * UI components talk to this module, never to `window.luna` directly, so
 * the renderer keeps working (as a no-op) in a plain browser tab and the
 * IPC surface stays swappable/testable.
 */

const bridge = window.luna;

export const windowService = {
  isElectron: bridge !== undefined,

  minimize(): void {
    bridge?.window.minimize();
  },

  toggleMaximize(): void {
    bridge?.window.toggleMaximize();
  },

  close(): void {
    bridge?.window.close();
  },

  async isMaximized(): Promise<boolean> {
    return bridge ? bridge.window.isMaximized() : false;
  },

  /** Subscribe to maximize/restore changes. Returns an unsubscribe function. */
  onMaximizedChange(callback: (isMaximized: boolean) => void): () => void {
    return bridge ? bridge.window.onMaximizedChange(callback) : () => {};
  },
};
