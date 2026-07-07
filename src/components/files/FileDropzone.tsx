import { type DragEvent, type ReactNode, useEffect, useState } from "react";

import { UploadCloud } from "lucide-react";

import { fileService } from "@/files/file.service";
import { cn } from "@/lib/utils";
import { useFilesStore } from "@/store/files/files.store";

/**
 * Drag-and-drop surface. Resolves dropped `File`s to absolute paths via
 * the preload `webUtils` bridge, then hands them to the store for
 * import. Also suppresses the default Electron behavior of navigating
 * the window when a file is dropped anywhere.
 */
export function FileDropzone({ children }: { children: ReactNode }) {
  const importPaths = useFilesStore((state) => state.importPaths);
  const [dragging, setDragging] = useState(false);

  // Prevent the window from navigating to a file dropped outside the zone.
  useEffect(() => {
    const prevent = (event: Event): void => event.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const onDrop = (event: DragEvent): void => {
    event.preventDefault();
    setDragging(false);
    const items = Array.from(event.dataTransfer.files).map((file) => ({
      path: fileService.pathForFile(file),
      name: file.name,
    }));
    void importPaths(items.filter((item) => item.path));
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={onDrop}
      className="relative min-h-0 flex-1"
    >
      {children}
      {dragging && (
        <div className="pointer-events-none absolute inset-3 z-20 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/60 bg-primary/10 backdrop-blur-sm">
          <UploadCloud className={cn("h-8 w-8 text-primary")} />
          <p className="text-sm font-medium text-foreground">Drop files to add them to Luna</p>
        </div>
      )}
    </div>
  );
}
