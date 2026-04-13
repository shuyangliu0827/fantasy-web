export type AppLanguage = "zh" | "en";

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  zh: "中",
  en: "EN",
};

export function getLanguageDisplayLabel(lang: AppLanguage): string {
  return LANGUAGE_LABELS[lang];
}
