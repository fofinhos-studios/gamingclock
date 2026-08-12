import { createContext } from "preact";
import { useContext, useState } from "preact/hooks";

import { type Language, strings } from "./strings";

const STORAGE_KEY = "gaming-clock.language";
const supportedLanguages = Object.keys(strings) as Language[];

export function detectLanguage(browserLanguages: readonly string[]): Language {
  for (const browserLanguage of browserLanguages) {
    const exactMatch = supportedLanguages.find(
      (language) => language === browserLanguage,
    );
    if (exactMatch) return exactMatch;
    const languageMatch = supportedLanguages.find(
      (language) => language.split("-")[0] === browserLanguage.split("-")[0],
    );
    if (languageMatch) return languageMatch;
  }
  return "en";
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (typeof strings)[Language];
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => undefined,
  t: strings.en,
});

export function LanguageProvider({
  children,
  browserLanguages = navigator.languages,
}: {
  children: preact.ComponentChildren;
  browserLanguages?: readonly string[];
}) {
  const [language, setCurrentLanguage] = useState<Language>(() => {
    const storedLanguage = window.localStorage.getItem(STORAGE_KEY);
    return storedLanguage &&
      supportedLanguages.includes(storedLanguage as Language)
      ? (storedLanguage as Language)
      : detectLanguage(browserLanguages);
  });
  const setLanguage = (nextLanguage: Language) => {
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
    setCurrentLanguage(nextLanguage);
  };

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, t: strings[language] }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
