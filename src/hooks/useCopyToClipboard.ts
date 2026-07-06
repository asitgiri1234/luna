import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Copies text to the clipboard and exposes a short-lived `copied` flag
 * for "Copied!" feedback in the UI.
 */
export function useCopyToClipboard(resetAfterMs = 1500) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setCopied(false), resetAfterMs);
      } catch {
        // Clipboard access denied — nothing actionable for the user here.
      }
    },
    [resetAfterMs],
  );

  return { copied, copy };
}
