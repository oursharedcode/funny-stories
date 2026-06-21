// SPDX-License-Identifier: AGPL-3.0-only

import BadWordsNext from 'bad-words-next';

// bad-words-next ships no Indonesian dictionary, and this environment can't add
// new deps, so we feed a hand-built dataset to the same engine. Token-based
// matching (like fr/de/es).
//
// STARTER STUB — conservative, unambiguous terms; needs a native pass
// (`needs-id-review`). Literal animal names commonly used as insults but also
// as ordinary nouns ("anjing" = dog, "babi" = pig) are deliberately omitted:
// the game may legitimately use them as picture answers, and matching them would
// silently replace innocent submissions.
const idData = {
  id: 'id',
  words: [
    'kontol', 'memek', 'pepek',
    'ngentot', 'entot',
    'bangsat', 'bajingan', 'keparat',
    'jancok', 'jancuk', 'cuk',
    'pelacur', 'sundal', 'lonte',
    'taik', 'tolol', 'goblok',
    'kampang', 'pukimak',
  ],
  lookalike: { '@': 'a', '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '$': 's', '7': 't' },
};

const matcher = new BadWordsNext({ data: idData });

export function isIndonesianProfane(text: string): boolean {
  return matcher.check(text);
}
