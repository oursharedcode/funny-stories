// SPDX-License-Identifier: AGPL-3.0-only

export interface ProseSegment {
  text: string;
  highlight: boolean;
}

// Walks the prose left-to-right, wrapping each player-supplied answer in a
// highlight segment. Language-agnostic: it never relies on answer order, so the
// Russian slot reordering (spec §9) needs no special handling.
export function splitProse(prose: string, answers: string[]): ProseSegment[] {
  const phrases = answers.filter((a) => a.length > 0);
  const segments: ProseSegment[] = [];
  let cursor = 0;
  while (cursor < prose.length) {
    let bestIdx = -1;
    let bestLen = 0;
    for (const phrase of phrases) {
      const idx = prose.indexOf(phrase, cursor);
      if (idx === -1) continue;
      if (bestIdx === -1 || idx < bestIdx || (idx === bestIdx && phrase.length > bestLen)) {
        bestIdx = idx;
        bestLen = phrase.length;
      }
    }
    if (bestIdx === -1) {
      segments.push({ text: prose.slice(cursor), highlight: false });
      break;
    }
    if (bestIdx > cursor) {
      segments.push({ text: prose.slice(cursor, bestIdx), highlight: false });
    }
    segments.push({ text: prose.slice(bestIdx, bestIdx + bestLen), highlight: true });
    cursor = bestIdx + bestLen;
  }
  return segments;
}
