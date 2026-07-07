import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { useAutomationStore } from "@/store/automation/automation.store";

import { ExecutionCard } from "./ExecutionCard";

/**
 * Floating stack of recent execution cards, anchored above the composer.
 * Renders nothing when idle.
 */
export function ExecutionCardStack() {
  const cards = useAutomationStore((state) => state.cards);
  const clearCards = useAutomationStore((state) => state.clearCards);
  if (cards.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-full z-10 flex justify-center px-8 pb-3">
      <div className="pointer-events-auto w-full max-w-2xl">
        <div className="mb-1 flex justify-end">
          <button
            type="button"
            onClick={clearCards}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {cards.slice(-4).map((card) => (
              <motion.div
                key={card.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <ExecutionCard card={card} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
