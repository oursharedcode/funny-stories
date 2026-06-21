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
// The same lowercase-only rule applies to the Latin-script languages below:
// because we don't strip diacritics, accented forms ('niño', 'bébé',
// 'érotique') and their de-accented spellings are listed explicitly side by
// side — the same "list both variants where it matters" path used for ё/е.
function normalize(s: string): string {
  return s.toLowerCase();
}

// Coverage spans all 12 shipped languages, not only EN/RU. The picture prompt
// is translated to English before this guard runs, so the English list already
// catches most non-English input; these per-language lists are the fallback for
// the cases translation can't fully clean — a slot the provider passed through
// untranslated, or mixed-language text. (Total translation failure is handled
// separately and fails closed; see translate.ts / generateStoryPicture.)
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
  // Fandom markers — script-independent, shared across all languages.
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

  // French. ('adolescent' also covers ES/PT 'adolescente'; 'minor' covers
  // IT 'minore'. 'gamin' covers 'gamine/s', 'mineur' covers 'mineure/s'.)
  'enfant', 'gamin', 'fille', 'fillette', 'garçon', 'garcon',
  'bébé', 'bebe', 'mineur', 'adolescent',
  'écolier', 'ecolier', 'écolière', 'ecoliere',

  // German. Bare 'kind' is omitted on purpose — it collides with English
  // "kind"/"kindness"; the inflected/derived German forms below don't.
  'mädchen', 'madchen', 'junge', 'kleinkind',
  'minderjährig', 'minderjahrig', 'säugling', 'saugling',
  'schüler', 'schuler', 'schülerin', 'schulerin', 'jugendlich',
  'kindes', 'kindern', 'kindlich',

  // Spanish (serves es-419 and es-es).
  'niño', 'nino', 'niña', 'nina', 'muchacho', 'muchacha',
  'menor', 'colegiala', 'colegial',

  // Italian.
  'bambin', 'ragazzin', 'minorenne', 'neonato', 'scolaretta',

  // Portuguese (pt-br).
  'criança', 'crianc', 'menin', 'bebê',

  // Indonesian.
  'anak', 'bocah', 'gadis', 'bayi', 'remaja', 'balita', 'bawah umur',

  // Chinese (Mandarin). Compounds only — bare 性/子 would over-match.
  '儿童', '小孩', '孩子', '女孩', '男孩', '婴儿', '幼儿', '未成年', '萝莉', '正太',

  // Japanese. (未成年 is shared with the Chinese list above.)
  '子供', '子ども', '児童', '女の子', '男の子', '幼児', '赤ちゃん', '小学生', 'ロリ', 'ショタ',

  // Korean. Bare 아이 omitted — collides with 아이폰/아이디 (iPhone/ID).
  '어린이', '아동', '소녀', '소년', '유아', '아기', '미성년', '청소년', '로리',
];

const SEXUAL_INDICATORS: readonly string[] = [
  // English.
  'sex', 'sexual', 'sexy', 'naked', 'nude', 'nudity', 'undress',
  'porn', 'erotic', 'lewd', 'fuck', 'fucking',
  'genital', 'penis', 'vagina', 'breast', 'breasts', 'nipple',
  'masturbat', 'orgasm', 'ejaculat', 'arous', 'fondl',
  // Generic stem — covers FR/DE/ES/IT/PT 'masturb*' in one entry.
  'masturb',

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

  // French. ('sex' already catches 'sexe/sexuel'; 'porn' catches 'porno';
  // 'orgasm' catches 'orgasme'. 'baiser' is omitted — it also means "kiss".)
  'nudité', 'nudite', 'dénudé', 'denude', 'érotique', 'erotique',
  'pénis', 'vagin', 'seins', 'éjacul', 'ejacul',

  // German.
  'nackt', 'erotik', 'erotisch', 'brüste', 'bruste', 'ficken',

  // Spanish (serves es-419 and es-es). ('erotic' catches unaccented
  // 'erotico'; 'erótic' adds the accented form, shared with Portuguese.)
  'desnud', 'erótic', 'senos', 'tetas', 'follar', 'follando',

  // Italian. ('sex' does NOT catch 'sesso', so it's listed.)
  'sesso', 'sessuale', 'nudo', 'nuda', 'nudi', 'tette',

  // Portuguese (pt-br).
  'nudez', 'despid', 'pênis', 'seios', 'foder',

  // Indonesian. ('seks' has no 'sex' substring, so it's listed.)
  'seks', 'seksual', 'telanjang', 'erotis', 'payudara', 'ngentot',

  // Chinese (Mandarin). Compounds only — bare 性 means gender/nature.
  '性交', '性爱', '裸体', '裸照', '色情', '阴茎', '阴道', '乳房', '自慰', '做爱',

  // Japanese. (性交/裸体/乳房/自慰/色情 shared with the Chinese list.)
  'セックス', 'エロ', 'ポルノ', 'ペニス', '陰茎', '膣', 'おっぱい', '全裸', 'オナニー',

  // Korean. Bare 질 (vagina) omitted — it collides with 질 = "quality".
  '섹스', '성교', '나체', '알몸', '포르노', '에로', '음경', '자위', '성기', '유방',
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
