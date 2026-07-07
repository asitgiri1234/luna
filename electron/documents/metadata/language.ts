/**
 * # Language detection (main process, embedding-free)
 *
 * A lightweight, dependency-free guess — NOT a model. It first checks
 * for non-Latin scripts by Unicode range, then scores Latin text against
 * small stop-word sets. Good enough to tag a document; downstream code
 * treats the result as a hint, never a guarantee.
 */

const SCRIPT_RANGES: { code: string; test: RegExp }[] = [
  { code: "ja", test: /[぀-ゟ゠-ヿ]/ }, // kana ⇒ Japanese
  { code: "zh", test: /[一-鿿]/ }, // Han (after kana check)
  { code: "ko", test: /[가-힣]/ },
  { code: "ru", test: /[Ѐ-ӿ]/ },
  { code: "ar", test: /[؀-ۿ]/ },
  { code: "hi", test: /[ऀ-ॿ]/ },
  { code: "he", test: /[֐-׿]/ },
  { code: "el", test: /[Ͱ-Ͽ]/ },
];

const STOP_WORDS: Record<string, string[]> = {
  en: ["the", "and", "of", "to", "in", "is", "that", "for", "it", "with", "as", "this"],
  es: ["el", "la", "de", "que", "y", "en", "los", "del", "las", "por", "con", "una"],
  fr: ["le", "la", "les", "de", "et", "des", "un", "une", "que", "dans", "pour", "est"],
  de: ["der", "die", "und", "den", "das", "mit", "von", "ist", "nicht", "auch", "ein", "sich"],
  pt: ["de", "que", "os", "as", "para", "com", "uma", "não", "por", "mais", "dos", "das"],
  it: ["di", "che", "la", "il", "un", "per", "in", "una", "sono", "con", "non", "del"],
};

/** Returns an ISO-639-1-ish code, or "und" when there's too little text. */
export function detectLanguage(text: string): string {
  const sample = text.slice(0, 4000);
  if (sample.replace(/\s/g, "").length < 12) return "und";

  for (const { code, test } of SCRIPT_RANGES) {
    if (test.test(sample)) return code;
  }

  const words = sample.toLowerCase().match(/[a-zà-öø-ÿ]+/g);
  if (!words || words.length < 8) return "und";
  const counts = new Set(words);

  let best = "und";
  let bestScore = 0;
  for (const [code, list] of Object.entries(STOP_WORDS)) {
    const score = list.reduce((sum, word) => sum + (counts.has(word) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = code;
    }
  }
  return bestScore >= 2 ? best : "en";
}
