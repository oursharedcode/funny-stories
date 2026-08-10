// SPDX-License-Identifier: AGPL-3.0-only

import BadWordsNext from 'bad-words-next';

// bad-words-next ships no Tamil dictionary, and this environment can't add new
// deps, so we feed a hand-built dataset to the same engine. Tamil is
// agglutinative — vocative/plural/case suffixes attach directly to the stem
// (தேவடியா → தேவடியாளே) — so each entry is wrapped in `*…*` wildcards to match
// the stem inside a suffixed word, the same trick the ja/zh matchers use. The
// stems below are long and unambiguous enough not to appear inside innocent
// words.
//
// NFC re-composition (load-bearing): `filterAnswer` feeds matchers
// NFKD-decomposed text, which splits Tamil two-part vowel signs (ொ/ோ/ௌ) off
// their consonants and would stop pre-composed entries from matching. We
// re-compose with NFC here, mirroring the ja/ko matchers.
//
// STARTER STUB — conservative, common, unambiguous vulgar terms only. Needs a
// native-speaker pass to widen coverage (`needs-ta-review`).
const taData = {
  id: 'ta',
  words: [
    '*புண்டை*',
    '*சுன்னி*',
    '*தேவடியா*', '*தேவிடியா*',
    '*ஓத்தா*',
    '*கூதி*',
    '*தாயோளி*',
    '*பொருக்கி*',
  ],
  lookalike: {},
};

const matcher = new BadWordsNext({ data: taData });

export function isTamilProfane(text: string): boolean {
  // See NFC note above — input arrives NFKD-decomposed from filterAnswer.
  return matcher.check(text.normalize('NFC'));
}
