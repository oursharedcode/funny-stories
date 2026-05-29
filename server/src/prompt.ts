// SPDX-License-Identifier: AGPL-3.0-only

import type { Language, Story } from './types.js';
import { IMAGE_PROMPT_TEMPLATES } from './i18n/index.js';

// Locked style suffix — appended to every image prompt so the Worker AI
// model renders in a consistent goofy-cartoon look.
export const STYLE_SUFFIX =
  ', in a goofy cartoon style, googly eyes, exaggerated expressions, ' +
  'bright colors, hand-drawn doodle illustration';

// Simplified buildPrompt — substitute slots {0}-{6} from the per-language
// `imagePrompt` template in `server/src/i18n/<lang>.json`, then append the
// locked STYLE_SUFFIX. All other previous handling (length cap, duplicate-
// subject anchor, distinct-pair anchor, EN/RU connective fixes, RU action
// hints) is commented out below for reference.
export function buildPrompt(story: Story, language: Language): string {
  const template = IMAGE_PROMPT_TEMPLATES[language];
  const body = template.replace(
    /\{([0-6])\}/g,
    (_, digit: string) => story.answers[Number(digit)] ?? '',
  );
  return body + STYLE_SUFFIX;
}

/* ============================================================================
 * PREVIOUS IMPLEMENTATION — commented out, not removed.
 * ============================================================================

import { IMAGE_PROMPT_TEMPLATES, ruSlot1NeedsAndPrefix } from './i18n/index.js';
import { ruActionHint } from './promptHints.js';

// EN slot-1 leading-connective regex — slot 1 ("With whom?") values that
// already start with "with" or "and" don't need a synthetic "and " prefix
// in the image prompt. Item 12 of BUGS_AND_IMPROVEMENTS_02.md.
const EN_SLOT1_LEADING_CONNECTIVE = /^\s*(?:with|and)\s+/i;

// Locked style suffix — spec §22. Breaking-change-locked from v0.1.0.
// Do NOT modify without a major version bump + re-test on the gallery
// sample once v0.1.0 has been tagged.
//
// "no text, no words" was deliberately removed in v4.19.0 (pre-v0.1.0):
// CLIP-conditioned diffusion models interpret negation poorly, and
// *naming* an unwanted concept ("text") tends to reinforce it. Item 18
// of BUGS_AND_IMPROVEMENTS_01.md has the analysis.
export const STYLE_SUFFIX =
  ', in a goofy cartoon style, googly eyes, exaggerated expressions, ' +
  'bright colors, hand-drawn doodle illustration';

const MAX_PROMPT_LENGTH = 500;

// Stem length used by looksLikeSameSubject for the head-noun comparison.
// Four characters covers Russian declension (мышь / мышью / мыши all
// share "мышь") without becoming so lenient it collides on unrelated
// words.
const STEM_LENGTH = 4;

// Strips a small set of leading connectives so "a mouse", "with a mouse",
// and "and a mouse" all reduce to the same string for comparison and
// anchor listing. "со" is the variant of Russian "с" used before certain
// consonants. "and" was added in item 12 of BUGS_AND_IMPROVEMENTS_02.md so
// the distinct-pair anchor doesn't produce "cat and and a dog" when slot 1
// happens to start with the same connector this module synthesises.
function stripLeading(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/^(?:with|and|со|с)\s+/, '')
    .replace(/^(?:a|an|the)\s+/, '')
    .trim();
}

// Returns true when slots 0 and 1 plausibly refer to the same subject.
// Used by buildPrompt to prepend an explicit count anchor so the
// diffusion model renders two distinct subjects instead of collapsing
// them visually (item 19 of BUGS_AND_IMPROVEMENTS_01.md).
//
// The check is cheap and conservative: after stripping leading
// "with"/"с"/articles, accept an exact match or a head-noun stem match
// (last token, first 4 characters). False positives at this layer cost
// a stray "two of them" prefix on a prompt that didn't need it; false
// negatives leave the original bug untreated. The bias is toward
// catching duplicates.
function  looksLikeSameSubject(slot0: string, slot1: string): boolean {
  const a = stripLeading(slot0);
  const b = stripLeading(slot1);
  if (!a || !b) return false;
  if (a === b) return true;
  const aTokens = a.split(/\s+/);
  const bTokens = b.split(/\s+/);
  const aHead = aTokens[aTokens.length - 1] ?? '';
  const bHead = bTokens[bTokens.length - 1] ?? '';
  if (aHead.length < STEM_LENGTH || bHead.length < STEM_LENGTH) return false;
  return aHead.slice(0, STEM_LENGTH) === bHead.slice(0, STEM_LENGTH);
}

// Builds the Workers AI image prompt from a completed story (spec §10).
// The narrative is filled from the per-language `imagePrompt` template
// in `server/src/i18n/<lang>.json`, which uses slots 0-4 only (the
// visually-concrete who/with-whom/where/when/action) and reads as a
// natural sentence so Flux's text encoder treats it as a description
// rather than a comma-separated noun-phrase list (item 18 of
// BUGS_AND_IMPROVEMENTS_01.md). Slots 5 ("what for") and 6 ("what was at
// the end") are intentionally omitted — they remain in the player-
// facing prose but not in the picture prompt.
//
// Answers go in verbatim (no translation, no language detection); the
// English style suffix anchors Flux's visual output regardless of
// answer language.
export function buildPrompt(story: Story, language: Language): string {
  const a = story.answers.map((ans) => ans ?? 'something surprising');
  // Russian-only slot-1 "и" prefix (item 23 of BUGS_AND_IMPROVEMENTS_01.md)
  // mirrors the same transform in renderProse so the prose and the
  // image prompt stay aligned ("кот и лошадь …" rather than the
  // ambiguous "кот лошадь …"). Skipped when slot 1 already starts with
  // "с" / "со" / "и" — including the bot-fill stand-ins, which all
  // lead with "с".
  if (language === 'ru') {
    const raw1 = story.answers[1];
    if (raw1 && ruSlot1NeedsAndPrefix(raw1)) {
      a[1] = `и ${a[1]}`;
    }
  }
  // English equivalent — item 12 of BUGS_AND_IMPROVEMENTS_02.md. The EN
  // image template is "{0} {1} {4}, ..." with no connector between slots
  // 0 and 1, so a bare-noun slot 1 produced "cat dog skiing" which CLIP
  // parses as a compound noun (cat-dog chimera). Prepend "and " when slot
  // 1 doesn't already start with "with"/"and" so the narrative reads as
  // grammatical English ("cat and dog skiing") and the two subjects bind
  // to separate visual entities. The prose template hardcodes "and" so
  // it doesn't need this transform.
  if (language === 'en') {
    const raw1 = story.answers[1];
    if (raw1 && !EN_SLOT1_LEADING_CONNECTIVE.test(raw1)) {
      a[1] = `and ${a[1]}`;
    }
  }
  let narrative = IMAGE_PROMPT_TEMPLATES[language].replace(
    /\{([0-6])\}/g,
    (_, digit: string) => a[Number(digit)] ?? '',
  );
  // Russian-only English-keyword hint (item 2 of BUGS_AND_IMPROVEMENTS_02.md,
  // option B). When the action slot contains a recognisable visual-action
  // substring ("лыж", "машин", "плава", …) prepend the English keyword(s)
  // to the narrative so Flux's CLIP encoder has an English anchor for the
  // visual concept. The Russian content stays verbatim; the hint only
  // adds context.
  if (language === 'ru') {
    const raw4 = story.answers[4];
    if (raw4) {
      const hint = ruActionHint(raw4);
      if (hint) narrative = `${hint}, ${narrative}`;
    }
  }
  // Use the raw answers (not the "something surprising" fallback) for
  // duplicate detection — two null slots are not a real duplicate.
  const raw0 = story.answers[0];
  const raw1 = story.answers[1];
  const samePair = raw0 != null && raw1 != null && looksLikeSameSubject(raw0, raw1);
  // Item 10 of BUGS_AND_IMPROVEMENTS_02.md — entity merging. Flux's CLIP
  // text encoder doesn't strongly bind adjacent nouns to separate visual
  // entities, so a narrative like "a cat with a dog" / "кот с собакой"
  // frequently renders as one cat-dog chimera. The fix mirrors item 19's
  // same-subject anchor: prepend a structural anchor that numerically
  // and explicitly separates the two subjects, then let the narrative
  // repeat them in their natural slot order (the repetition is
  // intentional — CLIP rewards token redundancy on important concepts).
  //
  // Mutually exclusive with the samePair anchor: a duplicate pair gets
  // "two of them"; a distinct pair gets the language-specific anchor.
  //
  // Language-aware anchor (refined per user feedback):
  //   EN: "two distinct subjects, X and Y, " — disambiguator + listing
  //   RU: "1 X слева, 1 Y справа, "        — numeric + spatial separator
  // The Russian anchor uses spatial words (слева/справа) which Flux
  // weights strongly, and a digit "1" instead of word numerals so we
  // sidestep grammatical gender (один/одна/одно) — we'd otherwise need
  // a brittle ending-based detector to inflect player-typed nouns.
  // Player input is used as-is (e.g. instrumental case "собакой" stays
  // "собакой" inside the anchor); Flux recognises the noun root for
  // visual concept regardless of case.
  const distinctPair = raw0 != null && raw1 != null && !samePair;

  let body: string;
  if (samePair) {
    body = `two of them, ${narrative}`;
  } else if (distinctPair) {
    const s0 = stripLeading(raw0);
    const s1 = stripLeading(raw1);
    const anchor =
      language === 'ru'
        ? `1 ${s0} слева, 1 ${s1} справа, `
        : `two distinct subjects, ${s0} and ${s1}, `;
    body = `${anchor}${narrative}`;
  } else {
    body = narrative;
  }
  const prompt = body + STYLE_SUFFIX;
  if (prompt.length <= MAX_PROMPT_LENGTH) return prompt;
  // Cap total length at 500 chars; truncate the body only, never the
  // style suffix.
  const bodyBudget = MAX_PROMPT_LENGTH - STYLE_SUFFIX.length;
  return body.slice(0, bodyBudget) + STYLE_SUFFIX;
}

 * ============================================================================
 */
