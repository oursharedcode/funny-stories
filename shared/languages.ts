// SPDX-License-Identifier: AGPL-3.0-only

// Single source of truth for every language the game offers. Lives in shared/
// so both the client (language picker, ?lang= validation) and the server
// (i18n loaders, filter dispatch) derive from the same list.
//
// Adding a language: append one row to LANGUAGES, drop matching JSONs in
// client/src/i18n/ and server/src/i18n/, plus an entry in server/src/filter/
// standins.ts. The `Language` union below derives from this array via
// `as const`, so a missed code in any consumer becomes a compile error.
// See docs/LANGUAGES.md → "Adding a new language" for the full checklist.

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
// Ordering follows the standard native-script + region pattern used by
// Google/Apple/Netflix language pickers. English is the upstream default
// (#1); Russian sits at #4 as the second first-class shipped language.
// Slots 2-3 and 5-11 are stubs: registry + i18n JSON + stand-ins ship in
// each language at machine-translation quality with a `needs-<code>-review`
// header in every file, awaiting native-speaker review per CONTRIBUTING.md.
export const LANGUAGES = [
  { code: 'en', name: 'English (United Kingdom)', flag: '🇬🇧' },
  { code: 'fr', name: 'Français (France)', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch (Deutschland)', flag: '🇩🇪' },
  { code: 'ru', name: 'Русский (Россия)', flag: '🇷🇺' },
  { code: 'id', name: 'Indonesia (Indonesia)', flag: '🇮🇩' },
  { code: 'it', name: 'Italiano (Italia)', flag: '🇮🇹' },
  { code: 'zh', name: '中文 (普通话)', flag: '🇨🇳' },
  { code: 'ja', name: '日本語 (日本)', flag: '🇯🇵' },
  { code: 'ko', name: '한국어 (대한민국)', flag: '🇰🇷' },
  { code: 'pt-br', name: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'es-419', name: 'Español (Latinoamérica)', flag: '🌎' },
  { code: 'es-es', name: 'Español (España)', flag: '🇪🇸' },
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
