export type AppLanguage = "zh" | "en";

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  zh: "中文",
  en: "EN",
};

export function getLanguageDisplayLabel(lang: AppLanguage): string {
  return LANGUAGE_LABELS[lang];
}
