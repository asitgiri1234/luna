import type { DocumentRecord } from "@shared/documents";

/**
 * Presentation helpers for the Document Intelligence layer. Pure UI
 * formatting, kept out of the domain/store layers.
 */

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
  he: "Hebrew",
  el: "Greek",
  ja: "Japanese",
  zh: "Chinese",
  ko: "Korean",
  und: "Unknown",
};

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}

/** "< 1 min", "3 min read", etc. */
export function formatReadingTime(minutes: number): string {
  if (minutes <= 0) return "—";
  return `${minutes} min read`;
}

/** Compact count formatting, e.g. 1234 → "1,234". */
export function formatCount(value: number): string {
  return value.toLocaleString();
}

/** The headline metrics shown on a card / detail panel. */
export function documentMetrics(record: DocumentRecord): { label: string; value: string }[] {
  return [
    { label: "Pages", value: formatCount(record.pageCount) },
    { label: "Words", value: formatCount(record.wordCount) },
    { label: "Reading", value: formatReadingTime(record.readingTimeMinutes) },
    { label: "Chunks", value: formatCount(record.chunkCount) },
  ];
}
