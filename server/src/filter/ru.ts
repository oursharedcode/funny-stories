// SPDX-License-Identifier: AGPL-3.0-only

import BadWordsNext from 'bad-words-next';
import ru from 'bad-words-next/lib/ru';

const matcher = new BadWordsNext({ data: ru });

export function isRussianProfane(text: string): boolean {
  return matcher.check(text);
}
