// SPDX-License-Identifier: AGPL-3.0-only

import BadWordsNext from 'bad-words-next';
import es from 'bad-words-next/lib/es';

// One Spanish matcher serves both registered Spanish locales (es-419 and
// es-es) — bad-words-next ships a single `es` dictionary and the core
// profanity it covers is shared across Latin-American and European Spanish.
const matcher = new BadWordsNext({ data: es });

export function isSpanishProfane(text: string): boolean {
  return matcher.check(text);
}
