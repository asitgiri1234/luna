import { create } from "zustand";

import { aiSettingsService } from "@/ai/settings/ai-settings.service";
import type { AISettings } from "@/ai/settings/ai-settings.types";

/**
 * # AI settings store — React adapter for AISettingsService
 *
 * Mirrors the current AI preferences so the Settings page re-renders on
 * change, and forwards every edit to the service (which persists locally
 * and applies the change to the live AI config). No logic lives here.
 */

interface AISettingsUiState extends AISettings {
  updateModel: (model: string) => void;
  updateTemperature: (temperature: number) => void;
  updateTopP: (topP: number) => void;
  updateMaxTokens: (maxTokens: number) => void;
  updateContextWindow: (contextWindow: number) => void;
  updateStreaming: (streaming: boolean) => void;
  updateAutoSave: (autoSaveConversations: boolean) => void;
  updateDocumentChatMode: (defaultDocumentChatMode: boolean) => void;
  updateVisionAnalysis: (defaultVisionAnalysis: boolean) => void;
}

export const useAISettingsStore = create<AISettingsUiState>()((set) => ({
  ...aiSettingsService.getAISettings(),

  updateModel: (model) => set(aiSettingsService.updateModel(model)),
  updateTemperature: (temperature) => set(aiSettingsService.updateTemperature(temperature)),
  updateTopP: (topP) => set(aiSettingsService.updateTopP(topP)),
  updateMaxTokens: (maxTokens) => set(aiSettingsService.updateMaxTokens(maxTokens)),
  updateContextWindow: (contextWindow) =>
    set(aiSettingsService.updateContextWindow(contextWindow)),
  updateStreaming: (streaming) => set(aiSettingsService.updateStreaming(streaming)),
  updateAutoSave: (autoSaveConversations) =>
    set(aiSettingsService.updateAutoSave(autoSaveConversations)),
  updateDocumentChatMode: (defaultDocumentChatMode) =>
    set(aiSettingsService.updateDocumentChatMode(defaultDocumentChatMode)),
  updateVisionAnalysis: (defaultVisionAnalysis) =>
    set(aiSettingsService.updateVisionAnalysis(defaultVisionAnalysis)),
}));
