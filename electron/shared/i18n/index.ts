import { en } from "./en";
import { ru } from "./ru";
import type { Locale, Strings } from "./types";

const dictionaries: Record<Locale, Strings> = { en, ru };

export function getStrings(locale: Locale): Strings {
  return dictionaries[locale] ?? en;
}

export function isLocale(value: string): value is Locale {
  return value === "en" || value === "ru";
}

export type { Locale, Strings } from "./types";
export { LOCALES } from "./types";
