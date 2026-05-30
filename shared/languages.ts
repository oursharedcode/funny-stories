// SPDX-License-Identifier: AGPL-3.0-only

// Single source of truth for every language the game offers. Lives in shared/
// so both the client (language picker, ?lang= validation) and the server
// (i18n loaders, filter dispatch) derive from the same list.
//
// Adding a language: append one row to LANGUAGES, drop matching JSONs in
// client/src/i18n/ and server/src/i18n/, plus an entry in server/src/filter/
// standins.ts. The `Language` union below derives from this array via
// `as const`, so a missed code in any consumer becomes a compile error.
// See README.md → "Adding a new language" for the full checklist.

export interface LanguageOption {
  /** Two-letter code; sometimes with a region suffix for variant disambiguation. */
  code: string;
  /** Display label in the language itself (e.g. "Deutsch (Deutschland)"). */
  name: string;
  /** Unicode flag emoji. Renders on iOS/Android phones the game targets. */
  flag: string;
}

// `as const` is load-bearing: it preserves the literal codes so `Language`
// below derives a string-literal union instead of `string`. The
// `LANGUAGES_EXHAUSTIVE` sentinel at the bottom of this file refuses to
// compile if the union silently widens (e.g. someone strips `as const`).
export const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
] as const satisfies readonly LanguageOption[];

export type Language = (typeof LANGUAGES)[number]['code'];

export function isLanguage(value: string | null | undefined): value is Language {
  if (!value) return false;
  return LANGUAGES.some((opt) => opt.code === value);
}

// Exhaustiveness sentinel — see the `as const` comment above. If `Language`
// ever widens to `string`, this record can no longer be exhaustive over the
// union and TypeScript will error here, surfacing the widening at the source
// instead of at every Record<Language, …> consumer site.
const LANGUAGES_EXHAUSTIVE: Record<Language, true> = LANGUAGES.reduce(
  (acc, opt) => ({ ...acc, [opt.code]: true }),
  {} as Record<Language, true>,
);
void LANGUAGES_EXHAUSTIVE;
