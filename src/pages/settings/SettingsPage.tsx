import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { PageContainer } from "@/layouts/PageContainer";
import { cn } from "@/lib/utils";
import {
  AVATAR_ICONS,
  AVATAR_OPTIONS,
  LANGUAGE_OPTIONS,
  PERSONALITY_OPTIONS,
  RESPONSE_LENGTH_OPTIONS,
} from "@/personalization/personalization.types";
import { usePersonalizationStore } from "@/store/personalization/personalization.store";
import {
  ACCENT_OPTIONS,
  DENSITY_OPTIONS,
  FONT_SIZE_OPTIONS,
  type Option,
  SIDEBAR_OPTIONS,
  THEME_OPTIONS,
} from "@/appearance/appearance.types";
import { useAppearanceStore } from "@/store/appearance/appearance.store";
import {
  CONTEXT_WINDOW_OPTIONS,
  MAX_TOKENS_OPTIONS,
  MODEL_OPTIONS,
  type NumberOption,
  TEMPERATURE_RANGE,
  TOP_P_RANGE,
} from "@/ai/settings/ai-settings.types";
import { useAISettingsStore } from "@/store/ai-settings/ai-settings.store";

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

/** A labelled row with a controlled on/off Switch. */
function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** A labelled row whose control is a native select of values. */
function SelectRow<T extends string | number>({
  label,
  description,
  options,
  value,
  onChange,
}: {
  label: string;
  description: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <select
        value={String(value)}
        onChange={(event) => {
          const raw = event.target.value;
          const next = options.find((option) => String(option.value) === raw);
          if (next) onChange(next.value);
        }}
        className="h-9 rounded-lg border border-border/70 bg-background/40 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** A labelled row whose control is a range slider with a live value read-out. */
function SliderRow({
  label,
  description,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-1.5 w-40 cursor-pointer appearance-none rounded-full bg-secondary accent-primary"
        />
        <span className="w-9 text-right text-sm tabular-nums text-muted-foreground">
          {value.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

/** A labelled row with a free-text input (committed on change). */
function TextRow({
  label,
  description,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-64 rounded-lg"
      />
    </div>
  );
}

/** A labelled row for picking one of the built-in avatar icons. */
function AvatarRow({
  value,
  onChange,
}: {
  value: (typeof AVATAR_OPTIONS)[number];
  onChange: (value: (typeof AVATAR_OPTIONS)[number]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-4">
      <div>
        <p className="text-sm font-medium">Avatar</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Choose a built-in icon for your assistant.
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {AVATAR_OPTIONS.map((avatar) => {
          const Icon = AVATAR_ICONS[avatar];
          const active = value === avatar;
          return (
            <button
              key={avatar}
              type="button"
              aria-label={avatar}
              onClick={() => onChange(avatar)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg border transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/70 text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Settings page. The Assistant, Appearance, and AI sections are live:
 * every control applies immediately and persists locally through its store.
 */
export function SettingsPage() {
  const persona = usePersonalizationStore();

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

  const ai = useAISettingsStore();

  return (
    <PageContainer title="Settings" description="Configure how Luna looks and behaves.">
      <div className="mx-auto max-w-3xl space-y-8">
        <section className="rounded-xl border border-border/70 bg-card/50 px-5">
          <h2 className="pt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Assistant
          </h2>
          <TextRow
            label="Assistant name"
            description="What your assistant is called throughout Luna."
            value={persona.assistantName}
            placeholder="Luna"
            onChange={persona.updateAssistantName}
          />
          <Separator />
          <AvatarRow value={persona.avatar} onChange={persona.updateAvatar} />
          <Separator />
          <TextRow
            label="Welcome message"
            description="Shown on the empty chat screen."
            value={persona.welcomeMessage}
            placeholder="How can I help you today?"
            onChange={persona.updateWelcomeMessage}
          />
          <Separator />
          <OptionRow
            label="Personality"
            description="The tone your assistant uses in replies."
            options={PERSONALITY_OPTIONS}
            value={persona.personality}
            onChange={persona.updatePersonality}
          />
          <Separator />
          <OptionRow
            label="Response length"
            description="How long replies should generally be."
            options={RESPONSE_LENGTH_OPTIONS}
            value={persona.responseLength}
            onChange={persona.updateResponseLength}
          />
          <Separator />
          <TextRow
            label="Default conversation starter"
            description="A one-tap prompt offered on the empty chat screen."
            value={persona.conversationStarter}
            placeholder="e.g. Summarize my day"
            onChange={persona.updateConversationStarter}
          />
          <Separator />
          <SelectRow
            label="Language"
            description="Preferred reply language (multilingual support is evolving)."
            options={LANGUAGE_OPTIONS}
            value={persona.language}
            onChange={persona.updateLanguage}
          />
        </section>

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

        <section className="rounded-xl border border-border/70 bg-card/50 px-5">
          <h2 className="pt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            AI
          </h2>
          <SelectRow
            label="Default model"
            description="The local model that answers your messages."
            options={MODEL_OPTIONS}
            value={ai.model}
            onChange={ai.updateModel}
          />
          <Separator />
          <SliderRow
            label="Temperature"
            description="Higher is more creative; lower is more focused."
            value={ai.temperature}
            min={TEMPERATURE_RANGE.min}
            max={TEMPERATURE_RANGE.max}
            step={TEMPERATURE_RANGE.step}
            onChange={ai.updateTemperature}
          />
          <Separator />
          <SliderRow
            label="Top P"
            description="Nucleus sampling: the probability mass to sample from."
            value={ai.topP}
            min={TOP_P_RANGE.min}
            max={TOP_P_RANGE.max}
            step={TOP_P_RANGE.step}
            onChange={ai.updateTopP}
          />
          <Separator />
          <SelectRow
            label="Max tokens"
            description="The longest a single response can be."
            options={MAX_TOKENS_OPTIONS as readonly NumberOption[]}
            value={ai.maxTokens}
            onChange={ai.updateMaxTokens}
          />
          <Separator />
          <SelectRow
            label="Context window size"
            description="How much conversation history is sent with each request."
            options={CONTEXT_WINDOW_OPTIONS as readonly NumberOption[]}
            value={ai.contextWindow}
            onChange={ai.updateContextWindow}
          />
          <Separator />
          <ToggleRow
            label="Streaming"
            description="Show the response as it is generated, token by token."
            checked={ai.streaming}
            onChange={ai.updateStreaming}
          />
          <Separator />
          <ToggleRow
            label="Auto-save conversations"
            description="Keep a local history of your chats and messages."
            checked={ai.autoSaveConversations}
            onChange={ai.updateAutoSave}
          />
          <Separator />
          <ToggleRow
            label="Default document chat mode"
            description="Start new chats grounded in your uploaded documents."
            checked={ai.defaultDocumentChatMode}
            onChange={ai.updateDocumentChatMode}
          />
          <Separator />
          <ToggleRow
            label="Default vision analysis"
            description="Automatically analyze an image the first time you open it."
            checked={ai.defaultVisionAnalysis}
            onChange={ai.updateVisionAnalysis}
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
