// SPDX-License-Identifier: AGPL-3.0-only

// Combinatorial CSAM-pattern guard (spec §6).
//
// What this is.
//   A defensive heuristic that refuses to send an assembled image prompt to
//   the Cloudflare Worker when the prompt contains BOTH a minor-indicator
//   token AND a sexual-indicator token. Either list on its own is harmless
//   in a party game ("three kids in a trench coat", "a sexy hat") — only
//   the combination trips the guard.
//
// What this is not.
//   This is not a curated CSAM blocklist. Thorn (Safer) and NCMEC do not
//   publish such a list publicly — Thorn's product is commercial and
//   NCMEC's term holdings are restricted to law-enforcement partners.
//   Open-source projects in this space rely on a combinatorial heuristic
//   like this one. It will miss obfuscated inputs and produce occasional
//   false positives. It is calibrated to err toward over-blocking: the
//   user impact of a false positive is "generation failed, try again."
//
// Both lists are deliberately conservative. Adding terms increases
// false-positive rate; removing terms increases false-negative rate. The
// reference behaviour is documented by the tests in csam.test.ts — change
// the lists and the tests together.

// Substring matching against the lower-cased prompt. We intentionally do
// NOT NFKD-strip combining marks here: NFKD decomposes Cyrillic 'й'→'и'
// and 'ё'→'е' (both are precomposed letters with combining marks under
// the hood), which would force the indicator list to be authored in a
// post-decomposition form different from how Russian is actually written.
// Listing both ё/е variants where it matters is the simpler path.
function normalize(s: string): string {
  return s.toLowerCase();
}

const MINOR_INDICATORS: readonly string[] = [
  // English. Listed as substrings so plurals/derivations are covered
  // ("kid"/"kids", "child"/"children" both contain "child"/"kid" stems
  // — listed explicitly for readability rather than relying on stemming).
  'child', 'kid', 'kids', 'minor', 'minors',
  'boy', 'boys', 'girl', 'girls',
  'teen', 'teens', 'preteen', 'pre-teen',
  'infant', 'baby', 'babies', 'toddler', 'toddlers',
  'schoolboy', 'schoolgirl', 'schoolboys', 'schoolgirls',
  'underage', 'juvenile',
  'lolita', 'lolicon', 'shota', 'shotacon',

  // Russian. Stems chosen to cover the common inflections without
  // colliding with unrelated words.
  // - 'ребёнок' / 'ребенок' (both ё and е spellings) and the oblique
  //   stem 'ребёнк' / 'ребенк' cover all noun forms.
  // - 'дети' covers nominative; the oblique forms have to be listed
  //   separately because they don't share a single substring.
  'ребёнок', 'ребенок', 'ребёнк', 'ребенк',
  'дети', 'детей', 'детям', 'детьми', 'детишк',
  'мальчик', 'мальчиш',
  'девочк', 'девчонк',
  'малыш',
  'подрост',
  'школьник', 'школьниц',
  'несовершеннолет',
  'лолит',
];

const SEXUAL_INDICATORS: readonly string[] = [
  // English.
  'sex', 'sexual', 'sexy', 'naked', 'nude', 'nudity', 'undress',
  'porn', 'erotic', 'lewd', 'fuck', 'fucking',
  'genital', 'penis', 'vagina', 'breast', 'breasts', 'nipple',
  'masturbat', 'orgasm', 'ejaculat', 'arous', 'fondl',

  // Russian. Forms listed individually where stems would over-match
  // unrelated common words ('гол' is in 'голос'/'голод'; 'грудь' is fine).
  'секс',
  'голый', 'голая', 'голое', 'голые', 'голым', 'голых', 'голую', 'голой',
  'обнажённ', 'обнаженн',
  'порно', 'эротик',
  'ебать', 'ебут', 'ебал', 'ёбан', 'ебан',
  'трахать', 'трахн',
  'интимн', 'гениталий', 'гениталии',
  'грудь', 'груди',
  'мастурбац', 'оргазм',
];

function containsAny(haystack: string, needles: readonly string[]): boolean {
  for (const n of needles) {
    if (haystack.includes(n)) return true;
  }
  return false;
}

// Returns true when the prompt contains both a minor-indicator AND a
// sexual-indicator token. Either category alone is not enough. Call site
// (game.ts handlePictureRequest) refuses the image generation on true.
export function containsCsamCombination(prompt: string): boolean {
  const lower = normalize(prompt);
  return (
    containsAny(lower, MINOR_INDICATORS) &&
    containsAny(lower, SEXUAL_INDICATORS)
  );
}
