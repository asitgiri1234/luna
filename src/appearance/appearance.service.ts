import {
  APPEARANCE_STORAGE_KEY,
  type AccentColor,
  type AppearanceSettings,
  DEFAULT_APPEARANCE,
  type Density,
  type FontSize,
  type SidebarDefault,
  type Theme,
} from "./appearance.types";

/**
 * # AppearanceService (renderer)
 *
 * Owns Luna's look-and-feel: loads the saved preferences, persists every
 * change locally (localStorage), and applies them to the document
 * immediately — no restart. Theme toggles the `.dark` class (following
 * `prefers-color-scheme` when set to "system"); accent, font size, and
 * density map to `data-*` attributes the stylesheet reacts to.
 *
 * This is deliberately a pure renderer concern — no IPC, no database.
 */

type Listener = (settings: AppearanceSettings) => void;

export class AppearanceService {
  private settings: AppearanceSettings;
  private readonly listeners = new Set<Listener>();
  private mediaQuery: MediaQueryList | null = null;

  constructor() {
    this.settings = this.load();
    this.watchSystemTheme();
    this.apply();
  }

  /** The current appearance preferences. */
  getAppearance(): AppearanceSettings {
    return { ...this.settings };
  }

  updateTheme(theme: Theme): AppearanceSettings {
    return this.set({ theme });
  }

  updateAccent(accent: AccentColor): AppearanceSettings {
    return this.set({ accent });
  }

  updateFontSize(fontSize: FontSize): AppearanceSettings {
    return this.set({ fontSize });
  }

  updateDensity(density: Density): AppearanceSettings {
    return this.set({ density });
  }

  updateSidebar(sidebar: SidebarDefault): AppearanceSettings {
    return this.set({ sidebar });
  }

  /** Subscribe to changes; returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private set(patch: Partial<AppearanceSettings>): AppearanceSettings {
    this.settings = { ...this.settings, ...patch };
    this.persist();
    this.apply();
    for (const listener of this.listeners) listener(this.getAppearance());
    return this.getAppearance();
  }

  private load(): AppearanceSettings {
    try {
      const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_APPEARANCE };
      const parsed = JSON.parse(raw) as Partial<AppearanceSettings>;
      // Merge over defaults so a newly-added field is always present.
      return { ...DEFAULT_APPEARANCE, ...parsed };
    } catch {
      return { ...DEFAULT_APPEARANCE };
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Persistence is best-effort; the live UI still reflects the choice.
    }
  }

  /** Writes the current settings onto the document root. */
  private apply(): void {
    const root = document.documentElement;
    root.classList.toggle("dark", this.resolveDark());
    root.dataset.accent = this.settings.accent;
    root.dataset.fontSize = this.settings.fontSize;
    root.dataset.density = this.settings.density;
  }

  /** Whether dark styling should be active right now. */
  private resolveDark(): boolean {
    if (this.settings.theme === "system") {
      return this.mediaQuery?.matches ?? true;
    }
    return this.settings.theme === "dark";
  }

  /** Re-apply when the OS theme changes while "system" is selected. */
  private watchSystemTheme(): void {
    if (typeof window === "undefined" || !window.matchMedia) return;
    this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.mediaQuery.addEventListener("change", () => {
      if (this.settings.theme === "system") this.apply();
    });
  }
}

/** App-wide singleton. Importing it applies the saved appearance at once. */
export const appearanceService = new AppearanceService();
