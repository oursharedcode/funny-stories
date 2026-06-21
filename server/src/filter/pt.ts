// SPDX-License-Identifier: AGPL-3.0-only

import BadWordsNext from 'bad-words-next';

// bad-words-next ships no Portuguese dictionary, and this environment can't add
// new deps, so we feed a hand-built dataset to the same engine. Token-based
// matching (like fr/de/es). The upstream `filterAnswer` strips diacritics before
// calling matchers (NFKD + combining-mark removal), so entries are listed in
// their **de-accented** ASCII form ("cuzao", not "cuzão") — that is the shape
// the matcher actually receives.
//
// STARTER STUB — conservative Brazilian-Portuguese terms; needs a native pass
// (`needs-pt-review`). Words that are also innocent animals/objects (e.g. "cu"
// alone) are deliberately omitted to avoid false positives.
const ptData = {
  id: 'pt',
  words: [
    'caralho', 'porra', 'merda',
    'foder', 'fodido', 'fodida', 'fodendo',
    'buceta', 'boceta', 'piroca',
    'puta', 'putas', 'putaria',
    'viado', 'corno', 'cuzao', 'arrombado',
    'vagabunda', 'vadia', 'desgracado',
    'filho_da_puta', 'puta_que_pariu',
  ],
  lookalike: { '@': 'a', '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '$': 's', '7': 't' },
};

const matcher = new BadWordsNext({ data: ptData });

export function isPortugueseProfane(text: string): boolean {
  return matcher.check(text);
}
