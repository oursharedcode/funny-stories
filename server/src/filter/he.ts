// SPDX-License-Identifier: AGPL-3.0-only

import BadWordsNext from 'bad-words-next';

// bad-words-next ships no Hebrew dictionary, and this environment can't add new
// deps, so we feed a hand-built dataset to the same engine. Hebrew is written
// with spaces, so entries match token-based like the Latin-script matchers —
// no `*…*` wildcards, which keeps letter-name collisions (e.g. the letter
// zayin inside longer words) from tripping the filter. Note Hebrew final-form
// letters (ם/מ etc.) make a word-final spelling distinct from the same stem
// mid-word, so inflected forms are listed explicitly where they matter.
//
// STARTER STUB — conservative, common, unambiguous vulgar terms only. Needs a
// native-speaker pass to widen coverage (`needs-he-review`). Mirrors the
// machine-translated stand-in convention in docs/LANGUAGES.md.
const heData = {
  id: 'he',
  words: [
    'חרא',
    'זונה', 'זונות',
    'שרמוטה', 'שרמוטות',
    'זין',
    'זיון',
    'מזדיין', 'מזדיינת',
    'תזדיין', 'תזדייני', 'להזדיין',
    'כוסית',
    'קוקסינל',
  ],
  lookalike: {},
};

const matcher = new BadWordsNext({ data: heData });

export function isHebrewProfane(text: string): boolean {
  return matcher.check(text);
}
