// SPDX-License-Identifier: AGPL-3.0-only

import BadWordsNext from 'bad-words-next';
// bad-words-next names its Chinese dictionary `ch`; the game's language code
// for Mandarin is `zh`, so the import and the export deliberately differ.
import ch from 'bad-words-next/lib/ch';

const matcher = new BadWordsNext({ data: ch });

export function isChineseProfane(text: string): boolean {
  return matcher.check(text);
}
