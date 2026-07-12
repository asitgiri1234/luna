import { create } from "zustand";

import { personalizationService } from "@/personalization/personalization.service";
import type {
  AssistantAvatar,
  Language,
  Personality,
  PersonalizationSettings,
  ResponseLength,
} from "@/personalization/personalization.types";

/**
 * # Personalization store — React adapter for PersonalizationService
 *
 * Mirrors the current personalization so the UI (title bar, empty chat
 * screen, settings) re-renders the moment the assistant name, welcome,
 * avatar, or starter changes. Every edit forwards to the service, which
 * persists locally and feeds the prompt builder. No logic lives here.
 */

interface PersonalizationUiState extends PersonalizationSettings {
  updateAssistantName: (assistantName: string) => void;
  updateWelcomeMessage: (welcomeMessage: string) => void;
  updateAvatar: (avatar: AssistantAvatar) => void;
  updatePersonality: (personality: Personality) => void;
  updateResponseLength: (responseLength: ResponseLength) => void;
  updateConversationStarter: (conversationStarter: string) => void;
  updateLanguage: (language: Language) => void;
}

export const usePersonalizationStore = create<PersonalizationUiState>()((set) => ({
  ...personalizationService.getPersonalization(),

  updateAssistantName: (name) => set(personalizationService.updateAssistantName(name)),
  updateWelcomeMessage: (message) => set(personalizationService.updateWelcomeMessage(message)),
  updateAvatar: (avatar) => set(personalizationService.updateAvatar(avatar)),
  updatePersonality: (personality) => set(personalizationService.updatePersonality(personality)),
  updateResponseLength: (length) => set(personalizationService.updateResponseLength(length)),
  updateConversationStarter: (starter) =>
    set(personalizationService.updateConversationStarter(starter)),
  updateLanguage: (language) => set(personalizationService.updateLanguage(language)),
}));
