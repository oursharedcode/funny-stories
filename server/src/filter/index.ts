// SPDX-License-Identifier: AGPL-3.0-only

import type { Language } from '../types.js';
import { isEnglishProfane } from './en.js';
import { isRussianProfane } from './ru.js';
import { pickStandin } from './standins.js';

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

// Aggressive variant for Russian matching: also collapses non-letter
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

  if (
    isEnglishProfane(normalized) ||
    isEnglishProfane(aggressive) ||
    isRussianProfane(normalized) ||
    isRussianProfane(aggressive)
  ) {
    return pickStandin(language, questionIndex);
  }
  return answer;
}
