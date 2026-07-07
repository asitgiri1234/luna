import { useEffect, useMemo } from "react";

import { FolderOpen, UploadCloud } from "lucide-react";

import { FileCard } from "@/components/files/FileCard";
import { FileDropzone } from "@/components/files/FileDropzone";
import { FilesToolbar } from "@/components/files/FilesToolbar";
import { UploadList } from "@/components/files/UploadList";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/layouts/PageContainer";
import { computeVisibleFiles, useFilesStore } from "@/store/files/files.store";

/**
 * Files page: drag-drop or pick to import into the Luna Workspace, then
 * browse the card grid with search / filter / sort. All logic lives in
 * the store and file service — this component only renders.
 */
export function FilesPage() {
  const status = useFilesStore((state) => state.status);
  const allFiles = useFilesStore((state) => state.files);
  const query = useFilesStore((state) => state.query);
  const sortKey = useFilesStore((state) => state.sortKey);
  const sortDir = useFilesStore((state) => state.sortDir);
  const filter = useFilesStore((state) => state.filter);
  const refresh = useFilesStore((state) => state.refresh);
  const pickAndImport = useFilesStore((state) => state.pickAndImport);

  const totalCount = allFiles.length;
  const files = useMemo(
    () => computeVisibleFiles(allFiles, { query, sortKey, sortDir, filter }),
    [allFiles, query, sortKey, sortDir, filter],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <PageContainer
      title="Files"
      description="Add files to your Luna Workspace. They're copied locally — originals stay where they are."
    >
      <FileDropzone>
        <div className="mx-auto h-full max-w-4xl overflow-y-auto pr-1">
          <FilesToolbar />
          <UploadList />

          {status === "unavailable" && (
            <p className="text-sm text-muted-foreground">
              Files are unavailable — the local database could not be opened.
            </p>
          )}

          {status === "ready" && totalCount === 0 ? (
            <EmptyState onAdd={() => void pickAndImport()} />
          ) : files.length === 0 && totalCount > 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No files match your search or filter.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-6 sm:grid-cols-3 lg:grid-cols-4">
              {files.map((file) => (
                <FileCard key={file.id} file={file} />
              ))}
            </div>
          )}
        </div>
      </FileDropzone>
    </PageContainer>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
        <FolderOpen className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">No files yet</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Drag &amp; drop PDFs, documents, or images here — or add them from your computer.
          Supported: PDF, DOCX, TXT, Markdown, PNG, JPEG, WEBP.
        </p>
      </div>
      <Button className="gap-2 rounded-xl" onClick={onAdd}>
        <UploadCloud className="h-4 w-4" />
        Add files
      </Button>
    </div>
  );
}
