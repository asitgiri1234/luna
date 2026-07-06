/**
 * Shared domain types. These model the shapes the UI is built against;
 * real data sources arrive in a later milestone.
 */

export interface ChatSummary {
  id: string;
  title: string;
  snippet: string;
  updatedAt: string;
}

export interface MemoryItem {
  id: string;
  content: string;
  category: "preference" | "fact" | "context";
  createdAt: string;
}
