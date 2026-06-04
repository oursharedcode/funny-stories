// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { filterAnswer } from './index.js';
import { STANDINS } from './standins.js';

// Sample bad words used for matching. These are intentionally common, well-known
// profanity that the libraries are guaranteed to detect. They never reach end
// users — the filter replaces them silently with a stand-in (spec §6).
const EN_BAD = 'shit';
const EN_LEET = 'sh1t';
const EN_SEPARATED = 's.h.i.t';
const RU_BAD = 'хуй'; // present in bad-words-next/lib/ru
const FR_BAD = 'merde'; // present in bad-words-next/lib/fr
const DE_BAD = 'ficken'; // present in bad-words-next/lib/de
const ES_BAD = 'puta'; // present in bad-words-next/lib/es
const ZH_BAD = '鸡巴'; // present in bad-words-next/lib/ch

const STANDIN_POOL_EN_Q0 = STANDINS.en[0]!;
const STANDIN_POOL_RU_Q0 = STANDINS.ru[0]!;

describe('profanity filter — spec §6', () => {
  it('lets clean answers pass through unchanged', () => {
    expect(filterAnswer('a sleepy turtle', 'en', 0)).toBe('a sleepy turtle');
    expect(filterAnswer('сонный кот', 'ru', 0)).toBe('сонный кот');
  });

  it('lets empty string pass through (live-player empty submit, spec §17)', () => {
    expect(filterAnswer('', 'en', 0)).toBe('');
  });

  it('matches English profanity and replaces with an EN stand-in for that question', () => {
    const result = filterAnswer(EN_BAD, 'en', 0);
    expect(result).not.toBe(EN_BAD);
    expect(STANDIN_POOL_EN_Q0).toContain(result);
  });

  it('matches leet variants (sh1t) via obscenity transformers', () => {
    const result = filterAnswer(EN_LEET, 'en', 0);
    expect(result).not.toBe(EN_LEET);
    expect(STANDIN_POOL_EN_Q0).toContain(result);
  });

  it('matches dot-separated variants (s.h.i.t) via skip-non-alphabetic transformer', () => {
    const result = filterAnswer(EN_SEPARATED, 'en', 0);
    expect(result).not.toBe(EN_SEPARATED);
    expect(STANDIN_POOL_EN_Q0).toContain(result);
  });

  it('matches uppercase / mixed-case English profanity', () => {
    const result = filterAnswer('ShIt', 'en', 0);
    expect(result).not.toBe('ShIt');
    expect(STANDIN_POOL_EN_Q0).toContain(result);
  });

  it('matches Russian profanity via bad-words-next', () => {
    const result = filterAnswer(RU_BAD, 'ru', 0);
    expect(result).not.toBe(RU_BAD);
    expect(STANDIN_POOL_RU_Q0).toContain(result);
  });

  it('matches native profanity for each bad-words-next-backed language', () => {
    const cases: Array<[string, Parameters<typeof filterAnswer>[1]]> = [
      [FR_BAD, 'fr'],
      [DE_BAD, 'de'],
      [ES_BAD, 'es-419'],
      [ES_BAD, 'es-es'],
      [ZH_BAD, 'zh'],
    ];
    for (const [bad, lang] of cases) {
      const result = filterAnswer(bad, lang, 0);
      expect(result).not.toBe(bad);
      expect(STANDINS[lang][0]).toContain(result);
    }
  });

  it('lets clean answers pass in the newly-covered languages', () => {
    expect(filterAnswer('bonjour le chat', 'fr', 0)).toBe('bonjour le chat');
    expect(filterAnswer('hallo katze', 'de', 0)).toBe('hallo katze');
    expect(filterAnswer('un gato dormido', 'es-419', 0)).toBe('un gato dormido');
    expect(filterAnswer('你好小猫', 'zh', 0)).toBe('你好小猫');
  });

  it('replaces with a stand-in from the *room language* even if the bad word was in the other language', () => {
    // An English bad word submitted in a Russian room → Russian stand-in.
    const result = filterAnswer(EN_BAD, 'ru', 0);
    expect(STANDIN_POOL_RU_Q0).toContain(result);
  });

  it('uses the correct stand-in pool for each question index', () => {
    for (let q = 0; q < 7; q++) {
      const result = filterAnswer(EN_BAD, 'en', q);
      expect(STANDINS.en[q]).toContain(result);
    }
  });
});
