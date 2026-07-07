import type { LucideIcon } from "lucide-react";
import { FileImage, FileText, FileType, FileType2 } from "lucide-react";

import type { FileKind } from "@shared/files";

/**
 * Presentation metadata for file kinds — label, icon, tint. Pure UI,
 * kept out of the domain layer.
 */
export interface KindMeta {
  label: string;
  icon: LucideIcon;
  tint: string;
}

export const KIND_META: Record<FileKind, KindMeta> = {
  pdf: { label: "PDF", icon: FileType, tint: "bg-red-500/15 text-red-300" },
  docx: { label: "Word", icon: FileText, tint: "bg-blue-500/15 text-blue-300" },
  txt: { label: "Text", icon: FileType2, tint: "bg-zinc-500/15 text-zinc-300" },
  md: { label: "Markdown", icon: FileType2, tint: "bg-violet-500/15 text-violet-300" },
  png: { label: "PNG", icon: FileImage, tint: "bg-emerald-500/15 text-emerald-300" },
  jpeg: { label: "JPEG", icon: FileImage, tint: "bg-emerald-500/15 text-emerald-300" },
  webp: { label: "WEBP", icon: FileImage, tint: "bg-emerald-500/15 text-emerald-300" },
};

/** Human-readable byte size, e.g. "1.4 MB". */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
