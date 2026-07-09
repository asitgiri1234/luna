import { aiCore } from "@/ai";
import {
  AI_SETTINGS_STORAGE_KEY,
  type AISettings,
  DEFAULT_AI_SETTINGS,
} from "./ai-settings.types";

/**
 * # AISettingsService (renderer)
 *
 * Owns the user's AI preferences. Loads them at startup, persists every
 * change locally (localStorage), and applies the request-affecting fields
 * onto the live `aiCore.config` — the same object the ConversationManager
 * reads when it builds each request, so a change takes effect on the very
 * next message without restarting Luna.
 *
 * This reuses the existing config (`ai/config/ai.config.ts`) rather than
 * introducing a parallel one; the two "default mode" flags are held here
 * and read by the chat / documents stores.
 */

type Listener = (settings: AISettings) => void;

export class AISettingsService {
  private settings: AISettings;
  private readonly listeners = new Set<Listener>();

  constructor() {
    this.settings = this.load();
    this.applyToConfig();
  }

  /** The current AI preferences. */
  getAISettings(): AISettings {
    return { ...this.settings };
  }

  updateModel(model: string): AISettings {
    return this.set({ model });
  }

  updateTemperature(temperature: number): AISettings {
    return this.set({ temperature: clamp(temperature, 0, 1) });
  }

  updateTopP(topP: number): AISettings {
    return this.set({ topP: clamp(topP, 0, 1) });
  }

  updateMaxTokens(maxTokens: number): AISettings {
    return this.set({ maxTokens: Math.max(1, Math.round(maxTokens)) });
  }

  updateContextWindow(contextWindow: number): AISettings {
    return this.set({ contextWindow: Math.max(1, Math.round(contextWindow)) });
  }

  updateStreaming(streaming: boolean): AISettings {
    return this.set({ streaming });
  }

  updateAutoSave(autoSaveConversations: boolean): AISettings {
    return this.set({ autoSaveConversations });
  }

  updateDocumentChatMode(defaultDocumentChatMode: boolean): AISettings {
    return this.set({ defaultDocumentChatMode });
  }

  updateVisionAnalysis(defaultVisionAnalysis: boolean): AISettings {
    return this.set({ defaultVisionAnalysis });
  }

  /** Subscribe to changes; returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private set(patch: Partial<AISettings>): AISettings {
    this.settings = { ...this.settings, ...patch };
    this.persist();
    this.applyToConfig();
    for (const listener of this.listeners) listener(this.getAISettings());
    return this.getAISettings();
  }

  private load(): AISettings {
    try {
      const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_AI_SETTINGS };
      const parsed = JSON.parse(raw) as Partial<AISettings>;
      // Merge over defaults so a newly-added field is always present.
      return { ...DEFAULT_AI_SETTINGS, ...parsed };
    } catch {
      return { ...DEFAULT_AI_SETTINGS };
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Persistence is best-effort; the live config still reflects the choice.
    }
  }

  /**
   * Writes the request-affecting settings onto the shared AiConfig. The
   * ConversationManager holds this same object by reference, so the next
   * generation uses the updated values. The two "default mode" flags are
   * intentionally not config — the stores read them from here.
   */
  private applyToConfig(): void {
    const config = aiCore.config;
    config.model = this.settings.model;
    config.temperature = this.settings.temperature;
    config.topP = this.settings.topP;
    config.maxTokens = this.settings.maxTokens;
    config.contextWindow = this.settings.contextWindow;
    config.streaming = this.settings.streaming;
    config.autoSaveConversations = this.settings.autoSaveConversations;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** App-wide singleton. Importing it applies the saved AI settings at once. */
export const aiSettingsService = new AISettingsService();
