import { useMemo } from "react";

import { Archive, Search } from "lucide-react";

import { MemoryCard } from "@/components/memory/MemoryCard";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/layouts/PageContainer";
import { CATEGORY_META } from "@/lib/memory-categories";
import { cn } from "@/lib/utils";
import { useMemoryStore } from "@/store/memory/memory.store";
import { MEMORY_CATEGORIES, type MemoryCategory } from "@shared/memory";

/**
 * Memory page: the user's window into everything Luna remembers.
 * Search, filter by category, toggle archived, and edit/archive/delete
 * each memory. All data + actions come from the memory store.
 */
export function MemoryPage() {
  const memories = useMemoryStore((state) => state.memories);
  const query = useMemoryStore((state) => state.query);
  const categoryFilter = useMemoryStore((state) => state.categoryFilter);
  const showArchived = useMemoryStore((state) => state.showArchived);
  const status = useMemoryStore((state) => state.status);
  const setQuery = useMemoryStore((state) => state.setQuery);
  const setCategoryFilter = useMemoryStore((state) => state.setCategoryFilter);
  const setShowArchived = useMemoryStore((state) => state.setShowArchived);

  const visible = useMemo(
    () =>
      memories.filter((memory) => {
        if (!showArchived && memory.isArchived) return false;
        if (categoryFilter !== "all" && memory.category !== categoryFilter) return false;
        return true;
      }),
    [memories, showArchived, categoryFilter],
  );

  // Group by category, preserving the canonical category order.
  const groups = useMemo(() => {
    const byCategory = new Map<MemoryCategory, typeof visible>();
    for (const memory of visible) {
      const bucket = byCategory.get(memory.category) ?? [];
      bucket.push(memory);
      byCategory.set(memory.category, bucket);
    }
    return MEMORY_CATEGORIES.map((category) => ({
      category,
      items: byCategory.get(category) ?? [],
    })).filter((group) => group.items.length > 0);
  }, [visible]);

  const archivedCount = memories.filter((m) => m.isArchived).length;

  return (
    <PageContainer
      title="Memory"
      description="Everything Luna remembers about you. You're always in control — edit, archive, or delete anything."
    >
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search memories…"
            className="h-10 rounded-xl pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            active={categoryFilter === "all"}
            onClick={() => setCategoryFilter("all")}
            label="All"
          />
          {MEMORY_CATEGORIES.map((category) => (
            <FilterChip
              key={category}
              active={categoryFilter === category}
              onClick={() => setCategoryFilter(category)}
              label={CATEGORY_META[category].label}
            />
          ))}
          {archivedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className={cn(
                "ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                showArchived
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border/70 text-muted-foreground hover:text-foreground",
              )}
            >
              <Archive className="h-3 w-3" />
              {showArchived ? "Hiding none" : `Show archived (${archivedCount})`}
            </button>
          )}
        </div>

        {status === "unavailable" && (
          <p className="text-sm text-muted-foreground">
            Memory is unavailable — the local database could not be opened.
          </p>
        )}
        {status === "ready" && visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-border/70 px-6 py-12 text-center">
            <p className="text-sm font-medium">Nothing remembered yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {query || categoryFilter !== "all"
                ? "No memories match this filter."
                : "As you chat, Luna will ask before remembering things about you."}
            </p>
          </div>
        )}

        {groups.map((group) => (
          <section key={group.category}>
            <h2 className="mb-2 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {CATEGORY_META[group.category].label}
            </h2>
            <div className="space-y-2">
              {group.items.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageContainer>
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
