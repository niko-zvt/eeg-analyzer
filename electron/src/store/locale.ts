import { create } from "zustand";
import { getStrings, isLocale, type Locale, type Strings } from "@shared/i18n";

const STORAGE_KEY = "eeg-analyzer-locale";

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isLocale(stored)) return stored;
  } catch {
    /* ignore */
  }
  return "en";
}

interface LocaleStore {
  locale: Locale;
  t: Strings;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleStore>((set) => {
  const locale = readStoredLocale();
  return {
    locale,
    t: getStrings(locale),
    setLocale: (next) => {
      localStorage.setItem(STORAGE_KEY, next);
      set({ locale: next, t: getStrings(next) });
      void window.electronAPI?.setLocale?.(next);
    },
  };
});

export function useT(): Strings {
  return useLocaleStore((s) => s.t);
}
