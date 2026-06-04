// SPDX-License-Identifier: AGPL-3.0-only

import BadWordsNext from 'bad-words-next';
import fr from 'bad-words-next/lib/fr';

const matcher = new BadWordsNext({ data: fr });

export function isFrenchProfane(text: string): boolean {
  return matcher.check(text);
}
