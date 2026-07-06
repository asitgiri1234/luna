import type { ConversationMeta } from "@shared/conversations";

/**
 * Pure grouping/filtering helpers for conversation lists. Order:
 * Pinned → Today → Yesterday → Last Week → Older (empty groups are
 * omitted; pinned conversations appear only in Pinned).
 */

export interface ConversationGroup {
  label: string;
  conversations: ConversationMeta[];
}

const DAY_MS = 86_400_000;

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export function filterConversations(
  conversations: ConversationMeta[],
  query: string,
): ConversationMeta[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return conversations;
  return conversations.filter((c) => c.title.toLowerCase().includes(needle));
}

export function groupConversations(conversations: ConversationMeta[]): ConversationGroup[] {
  const today = startOfToday();
  const yesterday = today - DAY_MS;
  const lastWeek = today - 7 * DAY_MS;

  const buckets: Record<string, ConversationMeta[]> = {
    Pinned: [],
    Today: [],
    Yesterday: [],
    "Last Week": [],
    Older: [],
  };

  for (const conversation of conversations) {
    if (conversation.isPinned) buckets.Pinned.push(conversation);
    else if (conversation.updatedAt >= today) buckets.Today.push(conversation);
    else if (conversation.updatedAt >= yesterday) buckets.Yesterday.push(conversation);
    else if (conversation.updatedAt >= lastWeek) buckets["Last Week"].push(conversation);
    else buckets.Older.push(conversation);
  }

  const byRecency = (a: ConversationMeta, b: ConversationMeta) => b.updatedAt - a.updatedAt;
  return Object.entries(buckets)
    .map(([label, items]) => ({ label, conversations: items.sort(byRecency) }))
    .filter((group) => group.conversations.length > 0);
}

/** Compact recency stamp: time today, weekday within a week, date otherwise. */
export function formatRecency(timestamp: number): string {
  const today = startOfToday();
  if (timestamp >= today) {
    return new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(timestamp);
  }
  if (timestamp >= today - 6 * DAY_MS) {
    return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(timestamp);
  }
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
}
