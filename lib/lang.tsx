"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Lang = "zh" | "en";

type LangContextType = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (zh: string, en: string) => string;
};

const LangContext = createContext<LangContextType | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    const saved = localStorage.getItem("bp_lang") as Lang;
    if (saved === "zh" || saved === "en") setLangState(saved);
  }, []);

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem("bp_lang", newLang);
  };

  const t = (zh: string, en: string) => (lang === "zh" ? zh : en);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const context = useContext(LangContext);
  if (!context) throw new Error("useLang must be used within LangProvider");
  return context;
}
