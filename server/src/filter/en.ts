// SPDX-License-Identifier: AGPL-3.0-only

import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from 'obscenity';

// obscenity's recommended transformers already handle: lowercase, leetspeak
// substitutions (sh!t, sh1t), skip-non-alphabetic (s.h.i.t), and duplicate
// collapse (sssshit). So we feed the raw answer in.
const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export function isEnglishProfane(text: string): boolean {
  return matcher.hasMatch(text);
}
