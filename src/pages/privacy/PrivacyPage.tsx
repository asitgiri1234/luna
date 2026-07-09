import { useEffect, useState } from "react";

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Brain,
  ChevronDown,
  ClipboardList,
  FileText,
  FolderOpen,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { PageContainer } from "@/layouts/PageContainer";
import { cn } from "@/lib/utils";
import { usePermissionsStore } from "@/store/permissions/permissions.store";
import type { PermissionId, PermissionRecord } from "@shared/permissions";

const ICONS: Record<PermissionId, LucideIcon> = {
  filesystem: FolderOpen,
  automation: MousePointerClick,
  clipboard: ClipboardList,
  notifications: Bell,
  "local-ai": Sparkles,
  memory: Brain,
  documents: FileText,
};

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatLastUsed(lastUsed: number | null): string {
  return lastUsed ? `Last used ${dateFormat.format(lastUsed)}` : "Never used";
}

/**
 * Privacy Dashboard: every capability Luna uses, with its status, last-use
 * time, and a control to allow or disable it. Read-only beyond the toggle
 * and the "why" reveal — enforcement lives with each capability.
 */
export function PrivacyPage() {
  const permissions = usePermissionsStore((state) => state.permissions);
  const status = usePermissionsStore((state) => state.status);
  const refresh = usePermissionsStore((state) => state.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <PageContainer
      title="Privacy"
      description="Review and control what Luna can access. Everything runs locally on your device."
    >
      <div className="mx-auto max-w-3xl space-y-3 pb-6">
        {status === "unavailable" && (
          <p className="text-sm text-muted-foreground">
            Permissions are unavailable — the local database could not be opened.
          </p>
        )}
        {permissions.map((permission) => (
          <PermissionCard key={permission.id} permission={permission} />
        ))}
      </div>
    </PageContainer>
  );
}

function PermissionCard({ permission }: { permission: PermissionRecord }) {
  const setEnabled = usePermissionsStore((state) => state.setEnabled);
  const busy = usePermissionsStore((state) => Boolean(state.pending[permission.id]));
  const [showWhy, setShowWhy] = useState(false);

  const Icon = ICONS[permission.id] ?? ShieldCheck;
  const allowed = permission.status === "allowed";

  return (
    <article className="rounded-xl border border-border/70 bg-card/50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              allowed ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">{permission.name}</h2>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  allowed
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {allowed ? "Allowed" : "Disabled"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{permission.description}</p>
          </div>
        </div>
        <Switch
          checked={allowed}
          disabled={busy}
          onCheckedChange={(value) => void setEnabled(permission.id, value)}
          aria-label={`${allowed ? "Disable" : "Enable"} ${permission.name}`}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-4 pl-13">
        <span className="text-[11px] text-muted-foreground/70">
          {formatLastUsed(permission.lastUsed)}
        </span>
        <button
          type="button"
          onClick={() => setShowWhy((open) => !open)}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Why is this needed?
          <ChevronDown className={cn("h-3 w-3 transition-transform", showWhy && "rotate-180")} />
        </button>
      </div>

      {showWhy && (
        <p className="mt-2 rounded-lg border border-border/50 bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
          {permission.reason}
        </p>
      )}
    </article>
  );
}
