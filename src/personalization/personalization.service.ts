import {
  type AssistantAvatar,
  type Language,
  LANGUAGE_OPTIONS,
  type Personality,
  PERSONALITY_DIRECTIVES,
  type PersonalizationSettings,
  PERSONALIZATION_STORAGE_KEY,
  DEFAULT_PERSONALIZATION,
  type ResponseLength,
  RESPONSE_LENGTH_DIRECTIVES,
} from "./personalization.types";

/**
 * # PersonalizationService (renderer)
 *
 * Owns the user's assistant personalization. Loads it at startup,
 * persists every change locally (localStorage), and compiles the
 * behavior-affecting fields (personality, response length, name,
 * language) into a prompt directive. The PromptBuilder pulls that
 * directive when it assembles each request, so a change takes effect on
 * the next response — no restart. Display fields (name, welcome, avatar,
 * starter) are read reactively by the UI store.
 *
 * A pure renderer concern — no IPC, no database.
 */

type Listener = (settings: PersonalizationSettings) => void;

export class PersonalizationService {
  private settings: PersonalizationSettings;
  private readonly listeners = new Set<Listener>();

  constructor() {
    this.settings = this.load();
  }

  /** The current personalization settings. */
  getPersonalization(): PersonalizationSettings {
    return { ...this.settings };
  }

  updateAssistantName(assistantName: string): PersonalizationSettings {
    return this.set({ assistantName });
  }

  updateWelcomeMessage(welcomeMessage: string): PersonalizationSettings {
    return this.set({ welcomeMessage });
  }

  updateAvatar(avatar: AssistantAvatar): PersonalizationSettings {
    return this.set({ avatar });
  }

  updatePersonality(personality: Personality): PersonalizationSettings {
    return this.set({ personality });
  }

  updateResponseLength(responseLength: ResponseLength): PersonalizationSettings {
    return this.set({ responseLength });
  }

  updateConversationStarter(conversationStarter: string): PersonalizationSettings {
    return this.set({ conversationStarter });
  }

  updateLanguage(language: Language): PersonalizationSettings {
    return this.set({ language });
  }

  /**
   * The system-prompt directive compiled from the current settings.
   * Appended by the PromptBuilder so personality / length / name /
   * language shape every future response. Read live at build time.
   */
  getPersonaDirective(): string {
    const { assistantName, personality, responseLength, language } = this.settings;
    const lines = [
      `Your name is ${assistantName.trim() || DEFAULT_PERSONALIZATION.assistantName}.`,
      PERSONALITY_DIRECTIVES[personality],
      RESPONSE_LENGTH_DIRECTIVES[responseLength],
    ];
    // Language: only instruct when it isn't the default English, so default
    // prompts are unchanged.
    if (language !== "en") {
      const label = LANGUAGE_OPTIONS.find((option) => option.value === language)?.label ?? language;
      lines.push(`Respond in ${label} unless the user writes in another language.`);
    }
    return lines.join(" ");
  }

  /** Subscribe to changes; returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private set(patch: Partial<PersonalizationSettings>): PersonalizationSettings {
    this.settings = { ...this.settings, ...patch };
    this.persist();
    for (const listener of this.listeners) listener(this.getPersonalization());
    return this.getPersonalization();
  }

  private load(): PersonalizationSettings {
    try {
      const raw = localStorage.getItem(PERSONALIZATION_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_PERSONALIZATION };
      const parsed = JSON.parse(raw) as Partial<PersonalizationSettings>;
      // Merge over defaults so a newly-added field is always present.
      return { ...DEFAULT_PERSONALIZATION, ...parsed };
    } catch {
      return { ...DEFAULT_PERSONALIZATION };
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Persistence is best-effort; the live UI still reflects the choice.
    }
  }
}

/** App-wide singleton, consumed by the prompt builder and the UI store. */
export const personalizationService = new PersonalizationService();
