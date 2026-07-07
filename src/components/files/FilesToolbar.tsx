import { ArrowDownAZ, ArrowUpAZ, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  type FileFilter,
  type SortKey,
  useFilesStore,
} from "@/store/files/files.store";

/** Search, filter, sort, and the add-files action for the Files page. */
export function FilesToolbar() {
  const query = useFilesStore((state) => state.query);
  const filter = useFilesStore((state) => state.filter);
  const sortKey = useFilesStore((state) => state.sortKey);
  const sortDir = useFilesStore((state) => state.sortDir);
  const setQuery = useFilesStore((state) => state.setQuery);
  const setFilter = useFilesStore((state) => state.setFilter);
  const setSort = useFilesStore((state) => state.setSort);
  const pickAndImport = useFilesStore((state) => state.pickAndImport);

  return (
    <div className="mb-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search files…"
            className="h-10 rounded-xl pl-9"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button className="h-10 gap-2 rounded-xl" onClick={() => void pickAndImport()}>
          <Plus className="h-4 w-4" />
          Add files
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(["all", "documents", "images"] as FileFilter[]).map((value) => (
          <Chip key={value} active={filter === value} onClick={() => setFilter(value)}>
            {value[0].toUpperCase() + value.slice(1)}
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px bg-border" />
        {(["createdAt", "name", "size"] as SortKey[]).map((key) => (
          <Chip key={key} active={sortKey === key} onClick={() => setSort(key)}>
            <span className="flex items-center gap-1">
              {sortLabel(key)}
              {sortKey === key &&
                (sortDir === "asc" ? (
                  <ArrowUpAZ className="h-3 w-3" />
                ) : (
                  <ArrowDownAZ className="h-3 w-3" />
                ))}
            </span>
          </Chip>
        ))}
      </div>
    </div>
  );
}

function sortLabel(key: SortKey): string {
  return key === "createdAt" ? "Date" : key === "name" ? "Name" : "Size";
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
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
      {children}
    </button>
  );
}
