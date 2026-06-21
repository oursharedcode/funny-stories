// SPDX-License-Identifier: AGPL-3.0-only

import BadWordsNext from 'bad-words-next';

// bad-words-next ships no Japanese dictionary, and this environment can't add
// new deps, so we feed a hand-built dataset to the same engine. Japanese has no
// inter-word spaces and the engine matches on token boundaries, so each entry is
// wrapped in `*…*` wildcards to match as a substring inside continuous text —
// the same trick the bundled Chinese (`ch`) dictionary uses.
//
// NFC re-composition (load-bearing): `filterAnswer` feeds matchers text that has
// been NFKD-normalized, which decomposes voiced kana (ぽ → は + ゜) and would
// stop these pre-composed entries from matching. We re-compose with NFC here so
// the dictionary and the input are in the same form. (The Chinese matcher needs
// no such step because Han characters have no canonical decomposition.)
//
// STARTER STUB — conservative, unambiguous vulgar terms; needs a native pass
// (`needs-ja-review`). Both hiragana and katakana spellings are listed where a
// term is commonly written either way.
const jaData = {
  id: 'ja',
  words: [
    '*くそ*', '*クソ*',
    '*ちんこ*', '*チンコ*', '*ちんぽ*', '*ちんちん*',
    '*まんこ*', '*マンコ*',
    '*きんたま*', '*やりまん*',
    '*ファック*', '*くたばれ*',
  ],
  lookalike: {},
};

const matcher = new BadWordsNext({ data: jaData });

export function isJapaneseProfane(text: string): boolean {
  // See NFC note above — input arrives NFKD-decomposed from filterAnswer.
  return matcher.check(text.normalize('NFC'));
}
