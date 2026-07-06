import { useCallback, useEffect, useRef, useState } from "react";

const BOTTOM_THRESHOLD_PX = 80;

/**
 * Keeps a scroll container pinned to the bottom while `signal` changes
 * (e.g. streaming text), unless the user has scrolled up to read.
 */
export function useStickToBottom(signal: unknown) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD_PX;
    pinnedRef.current = atBottom;
    setIsAtBottom(atBottom);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = containerRef.current;
    if (!el) return;
    pinnedRef.current = true;
    setIsAtBottom(true);
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (pinnedRef.current) {
      const el = containerRef.current;
      el?.scrollTo({ top: el.scrollHeight });
    }
  }, [signal]);

  return { containerRef, isAtBottom, handleScroll, scrollToBottom };
}
