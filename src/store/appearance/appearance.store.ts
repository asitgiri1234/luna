import { create } from "zustand";

import { appearanceService } from "@/appearance/appearance.service";
import type {
  AccentColor,
  AppearanceSettings,
  Density,
  FontSize,
  SidebarDefault,
  Theme,
} from "@/appearance/appearance.types";

/**
 * # Appearance store — React adapter for AppearanceService
 *
 * Mirrors the current appearance preferences so components re-render on
 * change, and forwards every edit to the service (which persists locally
 * and applies to the document). No persistence or DOM logic lives here.
 */

interface AppearanceUiState extends AppearanceSettings {
  /** Convenience flag for the sidebar (mirrors `sidebar === "collapsed"`). */
  sidebarCollapsed: boolean;

  updateTheme: (theme: Theme) => void;
  updateAccent: (accent: AccentColor) => void;
  updateFontSize: (fontSize: FontSize) => void;
  updateDensity: (density: Density) => void;
  updateSidebar: (sidebar: SidebarDefault) => void;
}

function mirror(settings: AppearanceSettings) {
  return { ...settings, sidebarCollapsed: settings.sidebar === "collapsed" };
}

export const useAppearanceStore = create<AppearanceUiState>()((set) => ({
  ...mirror(appearanceService.getAppearance()),

  updateTheme: (theme) => set(mirror(appearanceService.updateTheme(theme))),
  updateAccent: (accent) => set(mirror(appearanceService.updateAccent(accent))),
  updateFontSize: (fontSize) => set(mirror(appearanceService.updateFontSize(fontSize))),
  updateDensity: (density) => set(mirror(appearanceService.updateDensity(density))),
  updateSidebar: (sidebar) => set(mirror(appearanceService.updateSidebar(sidebar))),
}));
