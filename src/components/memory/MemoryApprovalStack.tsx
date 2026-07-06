import { AnimatePresence } from "framer-motion";

import { useMemoryStore } from "@/store/memory/memory.store";

import { MemoryApprovalCard } from "./MemoryApprovalCard";

/**
 * Floating stack of pending memory-approval cards, anchored above the
 * composer. Renders nothing when there are no candidates.
 */
export function MemoryApprovalStack() {
  const candidates = useMemoryStore((state) => state.candidates);
  if (candidates.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-full z-10 flex justify-center px-8 pb-3">
      <div className="pointer-events-auto flex w-full max-w-2xl flex-col gap-2">
        <AnimatePresence initial={false}>
          {candidates.slice(-3).map((candidate) => (
            <MemoryApprovalCard key={candidate.localId} candidate={candidate} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
