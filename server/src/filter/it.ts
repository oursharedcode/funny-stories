// SPDX-License-Identifier: AGPL-3.0-only

import BadWordsNext from 'bad-words-next';

// bad-words-next ships no Italian dictionary, and this environment can't add new
// deps, so we feed a hand-built dataset to the same engine (same `{ id, words,
// lookalike }` shape as the bundled dicts). Matching is token-based, like the
// other Latin-script matchers (fr/de/es), so entries are listed as explicit
// words rather than substring stems — this keeps innocent words that merely
// *contain* a profanity (e.g. "cazzuola", a trowel) from tripping the filter.
//
// STARTER STUB — conservative, common, unambiguous terms only. Needs a
// native-speaker pass to widen coverage and add regional variants
// (`needs-it-review`). Mirrors the machine-translated stand-in convention in
// docs/LANGUAGES.md.
const itData = {
  id: 'it',
  words: [
    'cazzo', 'cazzi', 'incazzato',
    'stronzo', 'stronza', 'stronzi',
    'merda', 'merdoso',
    'troia', 'puttana', 'puttane',
    'vaffanculo', 'affanculo',
    'coglione', 'coglioni',
    'minchia', 'pompino',
    'scopare', 'scopata',
    'bastardo', 'zoccola', 'figa',
  ],
  lookalike: { '@': 'a', '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '$': 's', '7': 't' },
};

const matcher = new BadWordsNext({ data: itData });

export function isItalianProfane(text: string): boolean {
  return matcher.check(text);
}
