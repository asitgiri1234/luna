import type { ReactNode } from "react";

import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { PageContainer } from "@/layouts/PageContainer";
import { cn } from "@/lib/utils";
import {
  ACCENT_OPTIONS,
  DENSITY_OPTIONS,
  FONT_SIZE_OPTIONS,
  type Option,
  SIDEBAR_OPTIONS,
  THEME_OPTIONS,
} from "@/appearance/appearance.types";
import { useAppearanceStore } from "@/store/appearance/appearance.store";

interface SettingRowProps {
  label: string;
  description: string;
  defaultChecked?: boolean;
}

function SettingRow({ label, description, defaultChecked }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}

/** A labelled row whose control is a segmented set of exclusive options. */
function OptionRow<T extends string>({
  label,
  description,
  options,
  value,
  onChange,
  renderOption,
}: {
  label: string;
  description: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  renderOption?: (option: Option<T>) => ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/40 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              value === option.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {renderOption ? renderOption(option) : option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Settings page. The Appearance section is live: every control applies
 * immediately and persists locally through the appearance store.
 */
export function SettingsPage() {
  const theme = useAppearanceStore((state) => state.theme);
  const accent = useAppearanceStore((state) => state.accent);
  const fontSize = useAppearanceStore((state) => state.fontSize);
  const density = useAppearanceStore((state) => state.density);
  const sidebar = useAppearanceStore((state) => state.sidebar);
  const updateTheme = useAppearanceStore((state) => state.updateTheme);
  const updateAccent = useAppearanceStore((state) => state.updateAccent);
  const updateFontSize = useAppearanceStore((state) => state.updateFontSize);
  const updateDensity = useAppearanceStore((state) => state.updateDensity);
  const updateSidebar = useAppearanceStore((state) => state.updateSidebar);

  return (
    <PageContainer title="Settings" description="Configure how Luna looks and behaves.">
      <div className="mx-auto max-w-3xl space-y-8">
        <section className="rounded-xl border border-border/70 bg-card/50 px-5">
          <h2 className="pt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            General
          </h2>
          <SettingRow
            label="Launch on startup"
            description="Start Luna automatically when you sign in to Windows."
          />
          <Separator />
          <SettingRow
            label="Minimize to tray"
            description="Keep Luna running in the system tray when the window is closed."
            defaultChecked
          />
        </section>

        <section className="rounded-xl border border-border/70 bg-card/50 px-5">
          <h2 className="pt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Appearance
          </h2>
          <OptionRow
            label="Theme"
            description="Use a light or dark look, or follow your system setting."
            options={THEME_OPTIONS}
            value={theme}
            onChange={updateTheme}
          />
          <Separator />
          <OptionRow
            label="Accent color"
            description="The highlight color for buttons and active items."
            options={ACCENT_OPTIONS}
            value={accent}
            onChange={updateAccent}
            renderOption={(option) => (
              <>
                <span
                  className="h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: ACCENT_OPTIONS.find((a) => a.value === option.value)?.swatch,
                  }}
                />
                {option.label}
              </>
            )}
          />
          <Separator />
          <OptionRow
            label="Font size"
            description="Scale the interface text and spacing."
            options={FONT_SIZE_OPTIONS}
            value={fontSize}
            onChange={updateFontSize}
          />
          <Separator />
          <OptionRow
            label="UI density"
            description="Choose tighter or roomier spacing throughout."
            options={DENSITY_OPTIONS}
            value={density}
            onChange={updateDensity}
          />
          <Separator />
          <OptionRow
            label="Sidebar"
            description="Whether the navigation sidebar starts collapsed or expanded."
            options={SIDEBAR_OPTIONS}
            value={sidebar}
            onChange={updateSidebar}
          />
        </section>

        <section className="rounded-xl border border-border/70 bg-card/50 p-5">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            About
          </h2>
          <p className="mt-3 text-sm">Luna</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Version 0.1.0 · Application shell preview
          </p>
        </section>
      </div>
    </PageContainer>
  );
}
