// SPDX-License-Identifier: AGPL-3.0-only

import BadWordsNext from 'bad-words-next';
import ua from 'bad-words-next/lib/ua';

// bad-words-next ships its Ukrainian dictionary under the legacy `ua` code;
// our registry uses the ISO 639-1 `uk`.
const matcher = new BadWordsNext({ data: ua });

export function isUkrainianProfane(text: string): boolean {
  return matcher.check(text);
}
