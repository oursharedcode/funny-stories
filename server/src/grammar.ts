// SPDX-License-Identifier: AGPL-3.0-only

// Post-processes assembled Russian story prose through LanguageTool's free
// public grammar API (https://languagetool.org) so the story reads as proper
// Russian: it inserts the commas Russian clause structure needs, tidies
// punctuation and spacing, capitalises the opening word, and guarantees a
// sentence-final period. The corrected string is what the reveal screen shows
// and what the downloadable picture and video render (they all read the same
// `prose` — see server/src/game.ts).
//
// Mirrors the design of translate.ts: a free, no-key public endpoint, an
// in-memory cache, a short timeout, and fail-open — any network/parse failure
// falls back to a deterministically tidied version (capitalised, period-
// terminated) so a story always renders.
//
// Verbatim-answer invariant: player answers are highlighted in the prose by
// matching them as substrings (client/src/prose.ts), and the game's humour
// comes from the players' exact words. So we only apply a LanguageTool
// suggestion when it leaves the *letters* unchanged — it may add/move
// punctuation and whitespace or change letter case, but never rewrite a word
// (spelling, agreement). The one letter-touching change we do make —
// capitalising the first word — is tolerated on the client by a
// case-insensitive highlight fallback (client/src/prose.ts).

const ENDPOINT = 'https://api.languagetool.org/v2/check';
const TIMEOUT_MS = 4000;
const CACHE_LIMIT = 2000;

const cache = new Map<string, string>();

function cacheGet(key: string): string | undefined {
  const hit = cache.get(key);
  if (hit !== undefined) {
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit;
}

function cacheSet(key: string, value: string): void {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

interface LtMatch {
  offset: number;
  length: number;
  replacements: { value: string }[];
}

// Same letters/digits ignoring case, spacing, and punctuation. Guards the
// verbatim-answer invariant: a suggestion that changes letters (a real word
// rewrite) is rejected; one that only adjusts punctuation/whitespace/case is
// applied.
function sameLetters(a: string, b: string): boolean {
  const strip = (s: string): string => s.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  return strip(a) === strip(b);
}

// Applies the accepted LanguageTool replacements right-to-left so each match's
// offset stays valid as earlier ones are spliced in.
function applyMatches(text: string, matches: LtMatch[]): string {
  const sorted = [...matches].sort((a, b) => b.offset - a.offset);
  let out = text;
  for (const m of sorted) {
    const replacement = m.replacements[0]?.value;
    if (replacement == null) continue;
    const original = out.slice(m.offset, m.offset + m.length);
    if (!sameLetters(original, replacement)) continue;
    out = out.slice(0, m.offset) + replacement + out.slice(m.offset + m.length);
  }
  return out;
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

async function fetchMatches(text: string): Promise<LtMatch[] | null> {
  const params = new URLSearchParams({ text, language: 'ru-RU' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { matches?: LtMatch[] };
    return data.matches ?? [];
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Deterministic tidy applied on every path (with or without LanguageTool):
// collapse the runs of spaces that empty answer slots leave behind, trim,
// capitalise the opening word, and guarantee a terminal period.
function tidy(text: string): string {
  return ensureTerminalPeriod(capitalizeFirst(text.replace(/ {2,}/g, ' ').trim()));
}

// Polishes Russian prose. Fail-open: when LanguageTool is unreachable the
// prose is still capitalised and period-terminated by `tidy`.
export async function polishRussianProse(prose: string): Promise<string> {
  const cached = cacheGet(prose);
  if (cached !== undefined) return cached;

  const matches = await fetchMatches(prose);
  const corrected = matches ? applyMatches(prose, matches) : prose;
  const result = tidy(corrected);

  cacheSet(prose, result);
  return result;
}
