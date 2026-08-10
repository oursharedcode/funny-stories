// SPDX-License-Identifier: AGPL-3.0-only

import type { Language } from '../types.js';
import { isEnglishProfane } from './en.js';
import { isRussianProfane } from './ru.js';
import { isFrenchProfane } from './fr.js';
import { isGermanProfane } from './de.js';
import { isSpanishProfane } from './es.js';
import { isChineseProfane } from './zh.js';
import { isItalianProfane } from './it.js';
import { isIndonesianProfane } from './id.js';
import { isJapaneseProfane } from './ja.js';
import { isKoreanProfane } from './ko.js';
import { isPortugueseProfane } from './pt.js';
import { isUkrainianProfane } from './uk.js';
import { isHebrewProfane } from './he.js';
import { isTamilProfane } from './ta.js';
import { pickStandin } from './standins.js';

// Language → profanity matcher map. Adding a new language with profanity
// coverage means writing a `<code>.ts` matcher in this folder and adding a
// row here. `filterAnswer` runs the OR over every registered matcher, which is
// load-bearing for the silent-stand-in brand asset: an English-room player
// typing Russian profanity is still caught, and vice-versa.
//
// All 15 shipped languages now have a native matcher. Seven are backed by
// bundled dictionaries (en via `obscenity`; ru/fr/de/zh/es/uk via
// `bad-words-next` — Ukrainian under its legacy `ua` code). The rest
// (it/id/ja/ko/pt-br/he/ta via `bad-words-next` with a hand-built dataset;
// ja/ko/ta also re-compose NFC) had no bundled dictionary and ship
// conservative starter stubs pending native review — see each `<code>.ts`
// header and docs/LANGUAGES.md.
//
// Type stays `Partial<Record<Language, …>>` so a future stub language can
// register in shared/ before its matcher lands here.
type ProfanityMatcher = (text: string) => boolean;
const MATCHERS: Partial<Record<Language, ProfanityMatcher>> = {
  en: isEnglishProfane,
  ru: isRussianProfane,
  fr: isFrenchProfane,
  de: isGermanProfane,
  zh: isChineseProfane,
  // Both Spanish locales share bad-words-next's single `es` dictionary.
  'es-419': isSpanishProfane,
  'es-es': isSpanishProfane,
  it: isItalianProfane,
  id: isIndonesianProfane,
  ja: isJapaneseProfane,
  ko: isKoreanProfane,
  'pt-br': isPortugueseProfane,
  uk: isUkrainianProfane,
  he: isHebrewProfane,
  ta: isTamilProfane,
};

// Light pre-normalisation (spec §6):
//  - lowercase
//  - strip diacritics (é -> e) via NFKD decomposition + combining-mark removal
// We do NOT pre-strip punctuation here — obscenity's transformers handle leet
// and non-alphabetic skips for the English check. bad-words-next is fed both
// the raw and the pre-cleaned form to widen catch.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');
}

// Aggressive variant for Russian-style matching: also collapses non-letter
// separators (s.h.i.t -> shit).
function aggressiveNormalize(s: string): string {
  return normalize(s).replace(/[^\p{L}\p{N}\s]/gu, '');
}

// Returns the original answer when clean, or a random stand-in from the
// room's language list for the current question when profanity is detected.
// The player is never told their answer was replaced (spec §6).
export function filterAnswer(
  answer: string,
  language: Language,
  questionIndex: number,
): string {
  if (!answer) return answer;

  const normalized = normalize(answer);
  const aggressive = aggressiveNormalize(answer);

  for (const matcher of Object.values(MATCHERS)) {
    if (!matcher) continue;
    if (matcher(normalized) || matcher(aggressive)) {
      return pickStandin(language, questionIndex);
    }
  }
  return answer;
}
