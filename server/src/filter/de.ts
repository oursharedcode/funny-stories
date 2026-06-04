// SPDX-License-Identifier: AGPL-3.0-only

import BadWordsNext from 'bad-words-next';
import de from 'bad-words-next/lib/de';

const matcher = new BadWordsNext({ data: de });

export function isGermanProfane(text: string): boolean {
  return matcher.check(text);
}
