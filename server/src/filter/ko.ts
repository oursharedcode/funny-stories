// SPDX-License-Identifier: AGPL-3.0-only

import BadWordsNext from 'bad-words-next';

// bad-words-next ships no Korean dictionary, and this environment can't add new
// deps, so we feed a hand-built dataset to the same engine. Korean is written
// without inter-word spaces in many constructions and the engine matches on
// token boundaries, so each entry is wrapped in `*…*` wildcards to match as a
// substring inside continuous text (same trick as the bundled `ch` dictionary).
//
// NFC re-composition (load-bearing): `filterAnswer` feeds matchers NFKD-
// normalized text, which decomposes Hangul syllables into conjoining jamo
// (씨 → ㅆ + ㅣ) and would stop these pre-composed entries from matching. We
// re-compose with NFC here so dictionary and input share one form.
//
// STARTER STUB — conservative, unambiguous terms; needs a native pass
// (`needs-ko-review`). Homonyms of innocent words are deliberately omitted:
// 보지/자지 (verb conjugations of 보다 "see" / 자다 "sleep") and 시발 (a Sino-
// Korean word for "start", 시발점/시발역) would all cause false positives.
const koData = {
  id: 'ko',
  words: [
    '*씨발*', '*씨팔*', '*시팔*',
    '*개새끼*', '*개년*', '*개놈*',
    '*병신*', '*지랄*', '*존나*',
    '*좆*', '*썅*', '*닥쳐*', '*꺼져*',
  ],
  lookalike: {},
};

const matcher = new BadWordsNext({ data: koData });

export function isKoreanProfane(text: string): boolean {
  // See NFC note above — input arrives NFKD-decomposed from filterAnswer.
  return matcher.check(text.normalize('NFC'));
}
