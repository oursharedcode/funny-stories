// SPDX-License-Identifier: AGPL-3.0-only

// Offline, dependency-free Russian punctuation pass for assembled story prose.
// The story is a run of player-typed answers dropped into a fixed template
// (server/src/i18n/ru.json), so it frequently arrives without the commas
// Russian clause structure needs, without a capitalised opening, and without a
// final period. This module adds them deterministically — no network, no
// external engine. It runs synchronously and instantly, so it never blocks or
// delays the reveal or the image (Worker AI) request: the image generation is
// kicked off from the same tick, and this pass only shapes the *text* that the
// reveal screen shows and that the downloadable image/video embed.
//
// Scope is deliberately conservative. We insert a comma *before* a small set of
// high-confidence clause-boundary words (adversative/subordinating conjunctions
// and relative pronouns) where a comma is almost always required and rarely
// wrong. We do NOT attempt participial/adverbial phrases (причастные /
// деепричастные обороты) or introductory words: those need real syntactic
// analysis, and a wrong comma reads worse than a missing one — especially on
// chaotic player input. The bias is to under-punctuate, never to mis-punctuate.
//
// Verbatim-answer note: player answers are highlighted by matching them in the
// prose (client/src/prose.ts). Inserted commas land between words, so an answer
// substring stays intact unless a trigger word sits *inside* a multi-word
// answer (rare, accepted). The opening-word capitalisation is tolerated by a
// case-insensitive highlight fallback on the client.

// Words that take a comma immediately before them when they join clauses
// mid-sentence. Chosen for a low false-positive rate on free-form input:
//   но / а / зато / однако  — adversative coordinating conjunctions
//   чтобы / хотя / словно    — subordinators (comma before is near-universal)
//   если / когда            — subordinators (guarded below against "даже …")
//   который…                — relative pronoun, every inflected form
// Deliberately excluded as too ambiguous on raw input: что, как, так, пока,
// будто, и, да.
const COMMA_BEFORE = new Set<string>([
  'но',
  'а',
  'зато',
  'однако',
  'чтобы',
  'хотя',
  'словно',
  'если',
  'когда',
  'который',
  'которая',
  'которое',
  'которые',
  'которого',
  'которому',
  'которым',
  'котором',
  'которую',
  'которой',
  'которых',
  'которыми',
]);

// Previous-word forms that cancel the comma: "даже если" / "даже когда" put
// the comma before "даже", not before the conjunction, so we skip it rather
// than produce the wrong "даже, если".
const CANCEL_PREV = new Set<string>(['даже']);

// Lowercased, punctuation-stripped form of a token, for matching against the
// trigger sets. Cyrillic is not a \w character, so \b word boundaries are
// unreliable — we tokenise on spaces and normalise here instead.
function wordKey(token: string): string {
  return token.replace(/[^\p{L}]/gu, '').toLowerCase();
}

// True when the token already ends in punctuation that makes a preceding comma
// redundant or wrong (existing comma, sentence end, colon, dash, …).
function endsWithPunctuation(token: string): boolean {
  return /[,.!?:;—–-]$/.test(token);
}

// Inserts a comma before each high-confidence clause-boundary word by appending
// it to the *previous* token, so "спать но" → "спать, но". "потому" only
// triggers as part of "потому что" (a one-token lookahead) so a bare "потому"
// is left alone.
function insertClauseCommas(text: string): string {
  const tokens = text.split(' ');
  for (let i = 1; i < tokens.length; i++) {
    const key = wordKey(tokens[i]!);
    const isTrigger =
      COMMA_BEFORE.has(key) || (key === 'потому' && wordKey(tokens[i + 1] ?? '') === 'что');
    if (!isTrigger) continue;
    const prev = tokens[i - 1]!;
    if (prev === '' || endsWithPunctuation(prev)) continue;
    if (CANCEL_PREV.has(wordKey(prev))) continue;
    tokens[i - 1] = prev + ',';
  }
  return tokens.join(' ');
}

function capitalizeFirst(text: string): string {
  const m = text.match(/\p{L}/u);
  if (!m || m.index === undefined) return text;
  const i = m.index;
  return text.slice(0, i) + text[i]!.toUpperCase() + text.slice(i + 1);
}

// Adds a period when the prose doesn't already end in sentence-final
// punctuation (the RU template ends in "." already, but a player's final-slot
// answer can carry its own terminal mark or none).
function ensureTerminalPeriod(text: string): string {
  const trimmed = text.trimEnd();
  if (trimmed === '') return trimmed;
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

// Full offline pass: collapse the space runs empty answer slots leave behind,
// insert clause commas, capitalise the opening word, and guarantee a terminal
// period. Pure and synchronous.
export function polishRussianProse(prose: string): string {
  const collapsed = prose.replace(/ {2,}/g, ' ').trim();
  const withCommas = insertClauseCommas(collapsed);
  return ensureTerminalPeriod(capitalizeFirst(withCommas));
}
