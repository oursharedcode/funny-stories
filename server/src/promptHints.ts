// SPDX-License-Identifier: AGPL-3.0-only

// Russian-action English-keyword hint lexicon (spec §10).
//
// Item 2 of BUGS_AND_IMPROVEMENTS_02.md — option B. The v4.27.0
// template-reorder fix (option A) put the Russian action verb at
// position 0 of the prompt, but empirical testing showed action verbs
// still don't reliably appear in the generated cartoons. The deeper
// problem is that Flux's CLIP text encoder weights Russian tokens
// less strongly than English ones; reordering alone doesn't bridge
// that asymmetry.
//
// This module addresses the asymmetry directly. When the Russian
// slot 4 ("Что они сделали?") contains a recognisable visual-action
// substring — *"лыж"*, *"машин"*, *"плава"*, *"танц"*, etc. — a
// short English keyword string is prepended to the assembled
// narrative, giving Flux an English visual anchor without removing
// any of the player's Russian content. The prose path (spec §9) is
// untouched; only the AI prompt gains the hint.
//
// Design notes:
//
// - **Substring matching, lowercased.** Russian inflection is too
//   varied to enumerate full conjugations, and substring matching is
//   the same approach the spec §6 CSAM and hard-block lists use.
//   Stems are chosen to be ≥4 characters and to minimise collisions
//   with unrelated common words (e.g. "лыж" doesn't appear in
//   normal Russian outside ski-related words).
//
// - **Multiple matches are concatenated.** A single answer can fire
//   several hints ("катались на лыжах и плавали" → *"skiing on snow,
//   swimming"*); the result is de-duplicated and comma-joined.
//
// - **False positives are cheap.** A spurious hint adds an English
//   keyword to the prompt but doesn't remove the player's Russian.
//   The cost is a slightly bloated prompt; the benefit when the
//   match is correct is a visible action in the cartoon. The lexicon
//   is intentionally biased toward over-matching.
//
// - **No silent translation of the player's voice.** The prose still
//   uses the verbatim Russian answers; the in-game source footer
//   (§27) and content-moderation framing are unchanged.
//
// Rollback note: option B can be reverted in one commit (this file
// plus the small call site in `server/src/prompt.ts`). The v4.27.0
// option-A template reorder stays; rolling back to pre-option-A
// requires reverting two commits.

interface ActionHint {
  // Lowercase Russian substring (stem or short phrase).
  readonly ru: string;
  // English keyword(s) to prepend to the prompt when the substring matches.
  readonly en: string;
}

const RU_ACTION_HINTS: readonly ActionHint[] = [
  // ── Transport / vehicles (visual nouns) ───────────────────────────
  { ru: 'лыж', en: 'skiing on snow' },
  { ru: 'санк', en: 'on a sled' },
  { ru: 'санях', en: 'on a sleigh' },
  { ru: 'машин', en: 'in a car' },
  { ru: 'велосипед', en: 'on a bicycle' },
  { ru: 'мотоцикл', en: 'on a motorcycle' },
  { ru: 'самолёт', en: 'in an airplane' },
  { ru: 'самолет', en: 'in an airplane' },
  { ru: 'поезд', en: 'on a train' },
  { ru: 'корабл', en: 'on a ship' },
  { ru: 'лодк', en: 'in a boat' },
  { ru: 'лошад', en: 'riding a horse' },
  { ru: 'верблюд', en: 'on a camel' },
  { ru: 'слон', en: 'on an elephant' },

  // ── Motion verbs (4+ char stems) ──────────────────────────────────
  { ru: 'плава', en: 'swimming in water' },
  { ru: 'плыв', en: 'swimming' },
  { ru: 'плыл', en: 'swimming' },
  { ru: 'бега', en: 'running' },
  { ru: 'бежа', en: 'running' },
  { ru: 'летал', en: 'flying through sky' },
  { ru: 'летае', en: 'flying' },
  { ru: 'прыга', en: 'jumping' },
  { ru: 'прыгн', en: 'jumping' },
  { ru: 'гуля', en: 'walking outdoors' },
  { ru: 'ехал', en: 'travelling' },
  { ru: 'едет', en: 'travelling' },
  { ru: 'катал', en: 'riding' },

  // ── Daily activities ──────────────────────────────────────────────
  { ru: 'танц', en: 'dancing' },
  { ru: 'играл', en: 'playing' },
  { ru: 'играют', en: 'playing' },
  { ru: 'играю', en: 'playing' },
  { ru: 'играть', en: 'playing' },
  { ru: 'читал', en: 'reading a book' },
  { ru: 'читаю', en: 'reading a book' },
  { ru: 'писал', en: 'writing' },
  { ru: 'пишут', en: 'writing' },
  { ru: 'рисов', en: 'drawing painting' },
  { ru: 'смотре', en: 'watching' },
  { ru: 'смотря', en: 'watching' },
  { ru: 'готови', en: 'cooking food' },
  { ru: 'кушал', en: 'eating food' },
  { ru: 'кушают', en: 'eating food' },
  { ru: 'кушать', en: 'eating' },
  { ru: 'пили', en: 'drinking' },
  { ru: 'пьют', en: 'drinking' },
  { ru: 'пьёт', en: 'drinking' },
  { ru: 'пьет', en: 'drinking' },
  { ru: 'спал', en: 'sleeping in bed' },
  { ru: 'спят', en: 'sleeping' },
  { ru: 'спим', en: 'sleeping' },
  { ru: 'поют', en: 'singing' },
  { ru: 'поёт', en: 'singing' },
  { ru: 'поет', en: 'singing' },
  { ru: 'пели', en: 'singing' },
  { ru: 'смеют', en: 'laughing' },
  { ru: 'смеял', en: 'laughing' },
  { ru: 'плака', en: 'crying' },
  { ru: 'дрались', en: 'fighting' },
  { ru: 'обнима', en: 'hugging' },
  { ru: 'целова', en: 'kissing' },
];

// Returns a comma-joined English hint string built from all lexicon
// entries whose Russian stem appears (case-insensitively) in `text`,
// or `null` when nothing matched. The result is intended to be
// prepended to the assembled image-prompt narrative as a structural
// English anchor (server/src/prompt.ts).
export function ruActionHint(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  // Set preserves insertion order; entries are listed roughly by
  // category in the lexicon above, which gives a stable order.
  const matches = new Set<string>();
  for (const { ru, en } of RU_ACTION_HINTS) {
    if (lower.includes(ru)) matches.add(en);
  }
  if (matches.size === 0) return null;
  return Array.from(matches).join(', ');
}
