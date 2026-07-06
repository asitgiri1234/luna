import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Heart,
  PenLine,
  Sparkles,
  Star,
  Target,
  User,
  Users,
} from "lucide-react";

import type { MemoryCategory } from "@shared/memory";

/**
 * Presentation metadata for memory categories: label, icon, and a
 * tint used for badges. Pure UI concern — kept out of the domain layer.
 */
export interface CategoryMeta {
  label: string;
  icon: LucideIcon;
  badgeClass: string;
}

export const CATEGORY_META: Record<MemoryCategory, CategoryMeta> = {
  identity: { label: "Identity", icon: User, badgeClass: "bg-sky-500/15 text-sky-300" },
  preferences: {
    label: "Preferences",
    icon: Heart,
    badgeClass: "bg-violet-500/15 text-violet-300",
  },
  projects: {
    label: "Projects",
    icon: Briefcase,
    badgeClass: "bg-amber-500/15 text-amber-300",
  },
  people: { label: "People", icon: Users, badgeClass: "bg-emerald-500/15 text-emerald-300" },
  goals: { label: "Goals", icon: Target, badgeClass: "bg-rose-500/15 text-rose-300" },
  "writing-style": {
    label: "Writing Style",
    icon: PenLine,
    badgeClass: "bg-teal-500/15 text-teal-300",
  },
  favorites: { label: "Favorites", icon: Star, badgeClass: "bg-yellow-500/15 text-yellow-300" },
  custom: { label: "Custom", icon: Sparkles, badgeClass: "bg-zinc-500/15 text-zinc-300" },
};
