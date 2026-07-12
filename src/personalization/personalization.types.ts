import type { LucideIcon } from "lucide-react";
import { Bot, Brain, Moon, Sparkles, Star, Zap } from "lucide-react";

/**
 * # Personalization types (renderer)
 *
 * How the user has personalized their assistant — name, welcome message,
 * avatar, personality, response length, a default conversation starter,
 * and language. Personalization is a pure renderer concern: the display
 * fields drive the UI, and the personality / response-length / language
 * are compiled into a prompt directive the PromptBuilder appends. Persisted
 * locally (localStorage) — no IPC, no database.
 */

export type Personality = "professional" | "friendly" | "creative" | "concise";
export type ResponseLength = "short" | "medium" | "detailed";
export type AssistantAvatar = "sparkles" | "moon" | "bot" | "brain" | "star" | "zap";
export type Language = "en" | "es" | "fr" | "de" | "hi" | "zh" | "ja" | "pt";

export interface PersonalizationSettings {
  assistantName: string;
  welcomeMessage: string;
  avatar: AssistantAvatar;
  personality: Personality;
  responseLength: ResponseLength;
  /** A prompt shown as a one-tap starter on the empty chat screen. */
  conversationStarter: string;
  language: Language;
}

export const DEFAULT_PERSONALIZATION: PersonalizationSettings = {
  assistantName: "Luna",
  welcomeMessage: "How can I help you today?",
  avatar: "sparkles",
  personality: "friendly",
  responseLength: "medium",
  conversationStarter: "",
  language: "en",
};

/** localStorage key holding the serialized {@link PersonalizationSettings}. */
export const PERSONALIZATION_STORAGE_KEY = "luna.personalization";

// ---------------------------------------------------------------------------
// Option catalogs (drive the Settings UI)
// ---------------------------------------------------------------------------

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const AVATAR_ICONS: Record<AssistantAvatar, LucideIcon> = {
  sparkles: Sparkles,
  moon: Moon,
  bot: Bot,
  brain: Brain,
  star: Star,
  zap: Zap,
};

export const AVATAR_OPTIONS: readonly AssistantAvatar[] = [
  "sparkles",
  "moon",
  "bot",
  "brain",
  "star",
  "zap",
];

export const PERSONALITY_OPTIONS: readonly Option<Personality>[] = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "creative", label: "Creative" },
  { value: "concise", label: "Concise" },
];

export const RESPONSE_LENGTH_OPTIONS: readonly Option<ResponseLength>[] = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "detailed", label: "Detailed" },
];

export const LANGUAGE_OPTIONS: readonly Option<Language>[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "hi", label: "Hindi" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "pt", label: "Portuguese" },
];

// ---------------------------------------------------------------------------
// Prompt directive fragments (compiled into the system prompt)
// ---------------------------------------------------------------------------

export const PERSONALITY_DIRECTIVES: Record<Personality, string> = {
  professional: "Maintain a professional, precise, and businesslike tone.",
  friendly: "Be warm, friendly, and approachable in your tone.",
  creative: "Be imaginative and creative, offering original ideas and vivid language.",
  concise: "Be direct and to the point, avoiding unnecessary elaboration.",
};

export const RESPONSE_LENGTH_DIRECTIVES: Record<ResponseLength, string> = {
  short: "Keep responses short — a few sentences at most.",
  medium: "Keep responses moderately detailed.",
  detailed: "Provide thorough, detailed responses with relevant depth.",
};
