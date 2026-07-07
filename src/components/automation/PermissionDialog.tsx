import { useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { permissionLabel, toolLabel } from "@/lib/automation-presentation";
import { useAutomationStore } from "@/store/automation/automation.store";

/**
 * # Permission dialog
 *
 * The reusable approval gate. Shows the pending request (tool, reason,
 * exact permissions, arguments), and returns the user's decision —
 * Approve / Deny / Cancel — with an optional "Remember my choice". One
 * dialog at a time; further requests queue behind it.
 */
export function PermissionDialog() {
  const pending = useAutomationStore((state) => state.pending);
  const approve = useAutomationStore((state) => state.approve);
  const deny = useAutomationStore((state) => state.deny);
  const cancel = useAutomationStore((state) => state.cancel);

  const [remember, setRemember] = useState(false);
  const current = pending[0];

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Permission request"
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
            initial={{ scale: 0.96, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Allow this action?</h2>
                <p className="text-xs text-muted-foreground">
                  {toolLabel(current.request.toolName)}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm">{current.request.reason}</p>

            <div className="mt-3 rounded-xl border border-border/70 bg-secondary/40 p-3">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                Luna will be able to
              </p>
              <ul className="mt-1.5 space-y-1">
                {current.request.permissions.map((permission) => (
                  <li key={permission} className="text-sm">
                    • {permissionLabel(permission)}
                  </li>
                ))}
              </ul>
              {Object.keys(current.request.parameters).length > 0 && (
                <p className="mt-2 font-mono text-[11px] break-words text-muted-foreground">
                  {JSON.stringify(current.request.parameters)}
                </p>
              )}
            </div>

            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="h-3.5 w-3.5 accent-[oklch(0.72_0.145_285)]"
              />
              Remember my choice for this tool
            </label>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  cancel(current.id);
                  setRemember(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  deny(current.id, remember);
                  setRemember(false);
                }}
              >
                Deny
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  approve(current.id, remember);
                  setRemember(false);
                }}
              >
                Approve
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
