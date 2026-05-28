// SPDX-License-Identifier: AGPL-3.0-only

import type { Language } from 'shared';

export interface LanguageOption {
  code: Language;
  // The language's name in the language itself.
  name: string;
  // Unicode flag emoji. Renders on the iOS/Android phones the game targets; on
  // Windows desktop it falls back to region letters — a preview-only cosmetic.
  flag: string;
}

// Single source for the languages the UI offers. The language selector and the
// `?lang=` URL check both derive from this list. Adding a language: extend the
// `Language` union in shared/events.ts, add an entry here, and add the content
// files (i18n JSON, stand-ins, profanity list) — see the README.
export const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
];

export function isLanguage(value: string | null | undefined): value is Language {
  return LANGUAGES.some((opt) => opt.code === value);
}
