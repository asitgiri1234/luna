/**
 * # Appearance types (renderer)
 *
 * The shape of Luna's look-and-feel preferences and the option catalogs
 * the Settings page renders from. Appearance is a pure renderer concern —
 * it maps to CSS classes / data attributes / custom properties and is
 * persisted locally (localStorage), so there is no IPC or database here.
 */

export type Theme = "light" | "dark" | "system";
export type AccentColor = "blue" | "purple" | "green" | "orange";
export type FontSize = "small" | "medium" | "large";
export type Density = "compact" | "comfortable";
export type SidebarDefault = "collapsed" | "expanded";

/** The complete set of appearance preferences. */
export interface AppearanceSettings {
  theme: Theme;
  accent: AccentColor;
  fontSize: FontSize;
  density: Density;
  sidebar: SidebarDefault;
}

/** Ships dark-first with the current violet accent, so defaults preserve it. */
export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "dark",
  accent: "purple",
  fontSize: "medium",
  density: "comfortable",
  sidebar: "expanded",
};

/** localStorage key holding the serialized {@link AppearanceSettings}. */
export const APPEARANCE_STORAGE_KEY = "luna.appearance";

// ---------------------------------------------------------------------------
// Option catalogs (drive the Settings UI, in display order)
// ---------------------------------------------------------------------------

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const THEME_OPTIONS: readonly Option<Theme>[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/** Accent options carry a preview swatch color (sRGB, for the UI dot only). */
export const ACCENT_OPTIONS: readonly (Option<AccentColor> & { swatch: string })[] = [
  { value: "blue", label: "Blue", swatch: "#3b82f6" },
  { value: "purple", label: "Purple", swatch: "#8b5cf6" },
  { value: "green", label: "Green", swatch: "#22c55e" },
  { value: "orange", label: "Orange", swatch: "#f97316" },
];

export const FONT_SIZE_OPTIONS: readonly Option<FontSize>[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

export const DENSITY_OPTIONS: readonly Option<Density>[] = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
];

export const SIDEBAR_OPTIONS: readonly Option<SidebarDefault>[] = [
  { value: "collapsed", label: "Collapse by default" },
  { value: "expanded", label: "Expand by default" },
];
