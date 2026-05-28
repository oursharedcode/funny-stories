// SPDX-License-Identifier: AGPL-3.0-only

import { createRequire } from 'node:module';
import type { Language } from '../types.js';

// createRequire works under both tsx (dev) and compiled Node (prod, once the
// build script copies the .json files into dist/i18n — see step 14).
const require = createRequire(import.meta.url);
type ServerI18n = { questions: string[]; prose: string; imagePrompt: string };
const en = require('./en.json') as ServerI18n;
const ru = require('./ru.json') as ServerI18n;

export const QUESTIONS: Record<Language, readonly string[]> = {
  en: en.questions,
  ru: ru.questions,
};

export const PROSE_TEMPLATES: Record<Language, string> = {
  en: en.prose,
  ru: ru.prose,
};

// Natural-sentence template for the AI image prompt (spec §10). Uses
// slots 0-4 only — slots 5 ("what for") and 6 ("what was at the end")
// produce abstract content that rarely translates into pixels, so they
// are kept in the prose but excluded from the image prompt (item 18 of
// BUGS_AND_IMPROVEMENTS_01.md).
export const IMAGE_PROMPT_TEMPLATES: Record<Language, string> = {
  en: en.imagePrompt,
  ru: ru.imagePrompt,
};

// Matches an answer that already begins with a connective that would
// collide with a hardcoded "for " prefix. Item 20 of
// BUGS_AND_IMPROVEMENTS_01.md has the analysis; covers every leading word
// in the EN slot-5 stand-in pool ('for', 'to', 'because', 'in exchange
// for', 'out of') plus a couple of common player-input variants.
const EN_SLOT5_LEADING_CONNECTIVE =
  /^\s*(?:for|to|because|so\s+that|in\s+order|in\s+exchange|out\s+of|since)\b/i;

// Matches a Russian slot-1 ("С кем?") answer that already begins with
// a connective that would collide with a hardcoded "и " prefix. Item
// 23 of BUGS_AND_IMPROVEMENTS_01.md has the analysis; covers the
// Russian slot-1 stand-in pool ('с …', 'со …') plus the literal 'и'
// case which is unusual but possible in player input.
const RU_SLOT1_LEADING_CONNECTIVE = /^\s*(?:с|со|и)\s+/i;

// Returns true when a Russian slot-1 answer needs an "и " prefix at
// render time. Exported so server/src/prompt.ts can apply the same
// transform to the image prompt and keep the two paths aligned.
export function ruSlot1NeedsAndPrefix(slot1: string): boolean {
  if (!slot1) return false;
  return !RU_SLOT1_LEADING_CONNECTIVE.test(slot1);
}

// Heuristic: a Russian slot-6 ("Чем всё закончилось?") answer of 1-2
// words is treated as a bare-noun answer that needs the verb phrase
// "это закончилось" prepended to compose with "В итоге". The existing
// 10 RU slot-6 stand-ins are all 4+ words and read naturally after "В
// итоге", so they are not touched. Item 23's analysis covers the
// tradeoffs; the simpler heuristic was chosen over morphology-based
// detection of instrumental-case suffixes.
function ruSlot6IsBareNoun(slot6: string): boolean {
  if (!slot6) return false;
  return slot6.trim().split(/\s+/).length <= 2;
}

// Fills the locked prose template (spec §9) with a story's 7 answers.
// Slot {n} maps to answers[n]; the Russian template reorders slots but uses
// the same {n} indices, so a single substitution pass works for both.
//
// English-only post-processing (item 20 of BUGS_AND_IMPROVEMENTS_01.md):
// the slot-5 answer to "What for?" gets a literal "for " prepended at
// render time when it doesn't already start with a connective. So bare
// player answers like "money" / "fun" / "the lulz" read as
// "...skiing for money..." in the assembled prose, while existing
// stand-ins that already start with "for"/"to"/"because" are left
// alone (no "for to impress a pigeon"). Russian is untouched — its
// "Зачем?" question naturally elicits answers that compose with the
// existing template.
export function renderProse(language: Language, answers: readonly string[]): string {
  const processed = [...answers];
  if (language === 'en') {
    const slot5 = processed[5];
    if (slot5 && !EN_SLOT5_LEADING_CONNECTIVE.test(slot5)) {
      processed[5] = `for ${slot5}`;
    }
  } else if (language === 'ru') {
    // Item 23 of BUGS_AND_IMPROVEMENTS_01.md — two Russian-only fixes
    // for bare-noun player answers in slots 1 and 6.
    const slot1 = processed[1];
    if (slot1 && ruSlot1NeedsAndPrefix(slot1)) {
      processed[1] = `и ${slot1}`;
    }
    const slot6 = processed[6];
    if (slot6 && ruSlot6IsBareNoun(slot6)) {
      processed[6] = `это закончилось ${slot6}`;
    }
  }
  return PROSE_TEMPLATES[language].replace(
    /\{([0-6])\}/g,
    (_, digit: string) => processed[Number(digit)] ?? '',
  );
}
