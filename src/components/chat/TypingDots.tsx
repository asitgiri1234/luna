import { motion } from "framer-motion";

/** Three-dot "thinking" indicator shown before the first token arrives. */
export function TypingDots() {
  return (
    <div className="flex h-6 items-center gap-1.5" role="status" aria-label="Luna is thinking">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="h-2 w-2 rounded-full bg-muted-foreground/70"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: index * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
