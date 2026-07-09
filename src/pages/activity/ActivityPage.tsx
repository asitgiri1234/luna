import { useEffect, useMemo, useState } from "react";

import type { LucideIcon } from "lucide-react";
import {
  AppWindow,
  Bell,
  Brain,
  ClipboardList,
  FileSearch,
  FileText,
  MessageSquarePlus,
  Pencil,
  Search,
  Send,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/layouts/PageContainer";
import { cn } from "@/lib/utils";
import { useActivityStore } from "@/store/activity/activity.store";
import {
  ACTIVITY_LABELS,
  ACTIVITY_TYPES,
  type ActivityRecord,
  type ActivityStatus,
  type ActivityType,
} from "@shared/activity";

const ICONS: Record<ActivityType, LucideIcon> = {
  "conversation-started": MessageSquarePlus,
  "message-sent": Send,
  "memory-created": Brain,
  "memory-updated": Pencil,
  "memory-deleted": Trash2,
  "file-uploaded": Upload,
  "document-parsed": FileText,
  "document-chat": FileSearch,
  "tool-executed": Wrench,
  "application-opened": AppWindow,
  "reminder-created": Bell,
  "clipboard-access": ClipboardList,
  "permission-granted": ShieldCheck,
  "permission-revoked": ShieldOff,
};

const STATUS_META: Record<ActivityStatus, { label: string; className: string }> = {
  success: { label: "Success", className: "bg-emerald-500/15 text-emerald-400" },
  failed: { label: "Failed", className: "bg-red-500/15 text-red-400" },
  cancelled: { label: "Cancelled", className: "bg-amber-500/15 text-amber-400" },
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

/** "just now", "2 mins ago", "Yesterday", "3 days ago", or an absolute date. */
function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) {
    const mins = Math.floor(diff / MINUTE);
    return `${mins} min${mins === 1 ? "" : "s"} ago`;
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(diff / DAY);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return dayFormat.format(timestamp);
}

/**
 * Activity History: a timeline of important user and assistant actions,
 * filterable by type and searchable by description, with a control to
 * clear the history. Read-only beyond that — logging happens in the
 * main process.
 */
export function ActivityPage() {
  const activities = useActivityStore((state) => state.activities);
  const status = useActivityStore((state) => state.status);
  const typeFilter = useActivityStore((state) => state.typeFilter);
  const query = useActivityStore((state) => state.query);
  const refresh = useActivityStore((state) => state.refresh);
  const setTypeFilter = useActivityStore((state) => state.setTypeFilter);
  const searchActivities = useActivityStore((state) => state.searchActivities);
  const clearActivities = useActivityStore((state) => state.clearActivities);

  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Only offer type chips that actually exist unless a filter is active.
  const presentTypes = useMemo(
    () => new Set(activities.map((activity) => activity.type)),
    [activities],
  );
  const typeChips = ACTIVITY_TYPES.filter(
    (type) => typeFilter === "all" || presentTypes.has(type) || type === typeFilter,
  );

  const hasActivities = activities.length > 0;

  return (
    <PageContainer
      title="Activity"
      description="A timeline of what you and Luna have done. Everything is recorded locally."
      actions={
        confirmingClear ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Clear all activity?</span>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingClear(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                void clearActivities();
                setConfirmingClear(false);
              }}
            >
              Clear history
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!hasActivities}
            onClick={() => setConfirmingClear(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear history
          </Button>
        )
      }
    >
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search activity…"
            className="h-10 rounded-xl pl-9"
            value={query}
            onChange={(event) => searchActivities(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")} label="All" />
          {typeChips.map((type) => (
            <FilterChip
              key={type}
              active={typeFilter === type}
              onClick={() => setTypeFilter(type)}
              label={ACTIVITY_LABELS[type]}
            />
          ))}
        </div>

        {status === "unavailable" && (
          <p className="text-sm text-muted-foreground">
            Activity is unavailable — the local database could not be opened.
          </p>
        )}

        {status === "ready" && !hasActivities && (
          <div className="rounded-xl border border-dashed border-border/70 px-6 py-12 text-center">
            <p className="text-sm font-medium">No activity yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {query || typeFilter !== "all"
                ? "No activity matches this filter."
                : "As you use Luna, your actions will appear here."}
            </p>
          </div>
        )}

        {hasActivities && (
          <ol className="relative space-y-1 pl-2">
            {/* The vertical timeline rail. */}
            <span
              aria-hidden
              className="absolute top-2 bottom-2 left-[1.4rem] w-px bg-border/60"
            />
            {activities.map((activity) => (
              <TimelineRow key={activity.id} activity={activity} />
            ))}
          </ol>
        )}
      </div>
    </PageContainer>
  );
}

function TimelineRow({ activity }: { activity: ActivityRecord }) {
  const Icon = ICONS[activity.type] ?? Wrench;
  const statusMeta = STATUS_META[activity.status];

  return (
    <li className="relative flex items-start gap-4 py-2 pl-1">
      <div
        className={cn(
          "z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card",
          activity.status === "failed" ? "text-red-400" : "text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground/80 uppercase">
            {ACTIVITY_LABELS[activity.type]}
          </span>
          {activity.status !== "success" && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                statusMeta.className,
              )}
            >
              {statusMeta.label}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm">{activity.description}</p>
      </div>
      <time className="shrink-0 pt-1 text-xs text-muted-foreground/70" title={timeFormat.format(activity.timestamp)}>
        {formatRelative(activity.timestamp)}
      </time>
    </li>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border/70 text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
