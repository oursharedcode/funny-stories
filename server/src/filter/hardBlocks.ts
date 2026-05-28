// SPDX-License-Identifier: AGPL-3.0-only

// Unconditional hard-block list (spec §6).
//
// What this is.
//   A short list of terms whose presence in an image prompt has no
//   legitimate use in a party game. Detection is unconditional — unlike
//   the combinatorial CSAM guard in csam.ts, a single hit is enough.
//   This is the second of two pre-Worker prompt-safety layers; it sits
//   alongside the CSAM guard in handlePictureRequest (game.ts), runs
//   before the daily-cap reservation, and surfaces the same generic
//   "Generation failed" error as a Cloudflare failure so the heuristic
//   cannot be probed.
//
// Calibration.
//   The list is intentionally narrow. Each entry has been chosen because
//   no plausible silly-story prompt would legitimately include it. A
//   prompt about a violent action movie ("the duck was murdered by the
//   penguin") does NOT trip this — "murder", "kill", "shoot", and
//   similar broad-use words are absent by design. The bar for inclusion
//   is "a screenshot of a cartoon containing this word is something a
//   journalist would write about."

// English matches are word-bounded (\b...\b) — JavaScript's \b is
// ASCII-only, which fits English but not Cyrillic.
const EN_HARD_BLOCK_WORDS: readonly string[] = [
  // Sexual violence.
  'rape', 'raping', 'raped', 'rapist', 'rapists',
  'molest', 'molested', 'molesting', 'molester', 'molesters', 'molestation',
  // Child sexual abuse (CSAM combinatorial guard catches most cases by
  // construction; these are the unambiguous standalone terms).
  'pedophile', 'pedophiles', 'pedophilia',
  'paedophile', 'paedophiles', 'paedophilia',
  'pedo', 'paedo',
  // Bestiality.
  'bestiality',
  // Targeted-violence verbs that have no party-game purpose.
  'assassinate', 'assassinated', 'assassinating', 'assassination',
  'behead', 'beheaded', 'beheading', 'beheads',
];

const EN_HARD_BLOCK_RE = new RegExp(
  '\\b(?:' + EN_HARD_BLOCK_WORDS.join('|') + ')\\b',
  'i',
);

// Russian matches are substring-based — Cyrillic doesn't participate in
// JS \b boundaries, and Russian inflection makes substring stems the
// natural unit anyway. Stems chosen to avoid collision with unrelated
// common words: "насил" alone would catch "насилие" (violence,
// generic), so we use the longer stem "насилов" which is specific to
// the sexual-assault verb family.
const RU_HARD_BLOCK_STEMS: readonly string[] = [
  'изнасил',
  'насилов',
  'педофил',
  'скотолож',
  'обезглав',
];

const HARD_BLOCK_PHRASES: readonly string[] = [
  'child porn',
  'child pornography',
  'kiddie porn',
  'kid porn',
  'детское порно',
  'детская порнография',
];

export function containsHardBlock(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  if (EN_HARD_BLOCK_RE.test(lower)) return true;
  for (const stem of RU_HARD_BLOCK_STEMS) {
    if (lower.includes(stem)) return true;
  }
  for (const phrase of HARD_BLOCK_PHRASES) {
    if (lower.includes(phrase)) return true;
  }
  return false;
}
