// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { STYLE_SUFFIX, buildPrompt } from './prompt.js';
import { isEnglishProfane } from './filter/en.js';
import { pickStandin, STANDINS } from './filter/standins.js';
import type { Story } from './types.js';

// Most of the old buildPrompt assertions (length cap, duplicate/distinct-pair
// anchors, connective prefixes, action hints) describe the previous
// implementation and are kept commented out below until the new prompt design
// stabilises. The active suite here covers the layer-2 moderation check added
// to the simplified buildPrompt — see docs/MODERATION.md.

// Layer-2 moderation: an English-side profanity check on the *translated*
// image prompt, run inside buildPrompt before the CSAM/hard-block guards.
// English answers skip translation (translate.ts short-circuits `en`), so an
// English profane answer exercises the check deterministically with no network
// call. A hit is swapped for an English stand-in for that slot.
describe('buildPrompt — layer-2 image-prompt profanity check', () => {
  function story(answers: (string | null)[]): Story {
    return { answers, pictureUrl: null };
  }

  it('replaces a profane (translated) slot with an English stand-in', async () => {
    // Pick a profanity obscenity flags, and confirm the assumption holds so
    // the test fails loudly if the dataset ever stops matching it.
    const profane = 'shit';
    expect(isEnglishProfane(profane)).toBe(true);

    const { prompt: p } = await buildPrompt(
      story([profane, 'a dog', 'in a library', 'on Saturday', 'skiing', null, null]),
      'en',
    );
    expect(p).not.toContain(profane);
    // The slot-0 stand-in pool supplies the replacement.
    expect(STANDINS.en[0]!.some((s) => p.includes(s))).toBe(true);
    expect(p.endsWith(STYLE_SUFFIX)).toBe(true);
  });

  it('leaves a clean prompt untouched', async () => {
    const { prompt: p } = await buildPrompt(
      story(['a llama', 'a dog', 'in a library', 'on Saturday', 'skiing', null, null]),
      'en',
    );
    expect(p).toContain('a llama');
    expect(p).toContain('a dog');
    expect(p).toContain('skiing');
    expect(p.endsWith(STYLE_SUFFIX)).toBe(true);
  });

  it('does not throw on all-null answers', async () => {
    const { prompt: p } = await buildPrompt(
      story([null, null, null, null, null, null, null]),
      'en',
    );
    expect(p.endsWith(STYLE_SUFFIX)).toBe(true);
  });

  // Sanity: pickStandin('en', i) is the replacement source used above.
  it('every used slot index (0-4) has an English stand-in pool', () => {
    for (let i = 0; i <= 4; i++) {
      expect(typeof pickStandin('en', i)).toBe('string');
      expect(pickStandin('en', i).length).toBeGreaterThan(0);
    }
  });
});

/* ============================================================================

import { describe, expect, it } from 'vitest';
import { STYLE_SUFFIX, buildPrompt } from './prompt.js';
import type { Story } from './types.js';

function story(answers: (string | null)[]): Story {
  return { answers, pictureUrl: null };
}

describe('buildPrompt — spec §10', () => {
  it('preserves the locked style suffix verbatim (spec §22)', () => {
    expect(STYLE_SUFFIX).toBe(
      ', in a goofy cartoon style, googly eyes, exaggerated expressions, ' +
        'bright colors, hand-drawn doodle illustration',
    );
    const p = buildPrompt(story(['a', 'b', 'c', 'd', 'e', 'f', 'g']), 'en');
    expect(p.endsWith(STYLE_SUFFIX)).toBe(true);
  });

  it('substitutes a fallback phrase for null (unanswered) slots', () => {
    const p = buildPrompt(story([null, null, null, null, null, null, null]), 'en');
    expect(p).toContain('something surprising');
    expect(p.endsWith(STYLE_SUFFIX)).toBe(true);
  });

  it('keeps total length <= 500 chars, truncating narrative not the suffix', () => {
    const long = 'x'.repeat(100);
    const p = buildPrompt(
      story([long, long, long, long, long, long, long]),
      'en',
    );
    expect(p.length).toBeLessThanOrEqual(500);
    expect(p.endsWith(STYLE_SUFFIX)).toBe(true);
  });

  it('handles Russian and English answers interleaved without translation', () => {
    const p = buildPrompt(
      story(['кот', 'with a dog', 'в Париже', 'at 2am', 'спали', 'for fun', 'конец']),
      'en',
    );
    expect(p).toContain('кот');
    expect(p).toContain('with a dog');
    expect(p).toContain('в Париже');
    expect(p.endsWith(STYLE_SUFFIX)).toBe(true);
  });

  // Item 18 of BUGS_AND_IMPROVEMENTS_01.md — image prompt uses slots 0-4
  // only. Slots 5 and 6 stay in the prose but are deliberately excluded
  // from the picture prompt so the action verb gets the token budget.
  it('omits slots 5 and 6 from the image prompt', () => {
    const p = buildPrompt(
      story([
        'WHO_0',
        'WITH_1',
        'WHERE_2',
        'WHEN_3',
        'ACTION_4',
        'FORWHAT_5',
        'ENDING_6',
      ]),
      'en',
    );
    expect(p).toContain('WHO_0');
    expect(p).toContain('WITH_1');
    expect(p).toContain('WHERE_2');
    expect(p).toContain('WHEN_3');
    expect(p).toContain('ACTION_4');
    expect(p).not.toContain('FORWHAT_5');
    expect(p).not.toContain('ENDING_6');
  });

  // Item 18 — the action slot is moved ahead of the where/when slots so
  // it sits earlier in the prompt, where the text encoder weights tokens
  // most strongly.
  it('places the action slot ahead of the where/when slots', () => {
    const p = buildPrompt(
      story(['A_0', 'B_1', 'C_2', 'D_3', 'E_4', 'F_5', 'G_6']),
      'en',
    );
    const idx4 = p.indexOf('E_4');
    const idx2 = p.indexOf('C_2');
    const idx3 = p.indexOf('D_3');
    expect(idx4).toBeGreaterThan(-1);
    expect(idx2).toBeGreaterThan(idx4);
    expect(idx3).toBeGreaterThan(idx4);
  });

  it('uses the language-specific template (ru)', () => {
    const p = buildPrompt(
      story([
        'сонная лама',
        'с проклятым тостером',
        'внутри сырного завода',
        'во время землетрясения',
        'каталась на лыжах',
        null,
        null,
      ]),
      'ru',
    );
    expect(p).toContain('сонная лама');
    expect(p).toContain('каталась на лыжах');
    expect(p.indexOf('каталась на лыжах')).toBeLessThan(p.indexOf('внутри сырного завода'));
  });

  // Item 2 of BUGS_AND_IMPROVEMENTS_02.md — the Russian template puts
  // slot 4 (the action) at position 0 with a caption-style colon, so
  // the action survives CLIP's mid-prompt truncation and gets the
  // strongest positional weight WITHIN the narrative. English keeps
  // its own template. (Note: item 10 of vol02 prepends a
  // "two distinct subjects, X and Y" anchor in front of everything when
  // slots 0 and 1 are distinct — that's structural, not the narrative.)
  it('puts the Russian action verb at the very front of the narrative (post-anchors)', () => {
    const p = buildPrompt(
      story(['сонная лама', 'с проклятым тостером', 'в библиотеке', 'в субботу', 'катались на лыжах', null, null]),
      'ru',
    );
    // The action appears before the subject within the narrative — `lastIndexOf`
    // on the subject skips the anchor's lowercased copy and lands on the
    // narrative copy.
    expect(p.indexOf('катались на лыжах')).toBeLessThan(p.lastIndexOf('сонная лама'));
    // …and before any of the where/when slots (those only appear once,
    // in the narrative).
    expect(p.indexOf('катались на лыжах')).toBeLessThan(p.indexOf('в библиотеке'));
    expect(p.indexOf('катались на лыжах')).toBeLessThan(p.indexOf('в субботу'));
    // The colon delimiter is present (caption-style framing).
    expect(p).toContain('катались на лыжах:');
  });

  it('English template still puts the action AFTER the subject (item 18 layout)', () => {
    const p = buildPrompt(
      story(['a sleepy llama', 'with a haunted toaster', 'in a library', 'on Saturday', 'skiing', null, null]),
      'en',
    );
    // English path is unchanged by item 2 of vol 02.
    expect(p.indexOf('a sleepy llama')).toBeLessThan(p.indexOf('skiing'));
    expect(p).not.toContain('skiing:');
  });

  // Item 2 of BUGS_AND_IMPROVEMENTS_02.md — option B. When the Russian
  // action slot contains a recognisable visual-action substring, an
  // English keyword hint is prepended to the narrative so Flux's CLIP
  // encoder has an English anchor that the encoder weights more
  // strongly than Cyrillic content.
  describe('Russian-action English-keyword hint (vol02 item 2, option B)', () => {
    it('prepends "skiing on snow" for "катались на лыжах"', () => {
      const p = buildPrompt(
        story(['сонная лама', 'с проклятым тостером', 'в библиотеке', 'в субботу', 'катались на лыжах', null, null]),
        'ru',
      );
      // The hint sits between the item-10 anchor and the Russian narrative.
      expect(p).toContain('skiing on snow');
      expect(p.indexOf('skiing on snow')).toBeLessThan(p.indexOf('катались на лыжах'));
      // The Russian narrative still follows the hint.
      expect(p).toContain('катались на лыжах');
    });

    it('prepends "in a car" for "ехали на машине"', () => {
      const p = buildPrompt(
        story(['сонная лама', 'с проклятым тостером', 'на даче', 'утром', 'ехали на машине', null, null]),
        'ru',
      );
      expect(p).toContain('in a car');
      expect(p.indexOf('in a car')).toBeLessThan(p.indexOf('ехали на машине'));
      expect(p).toContain('ехали на машине');
    });

    it('combines multiple matches into one comma-joined hint', () => {
      const p = buildPrompt(
        story(['кенгуру', 'с пингвином', 'в библиотеке', 'в субботу', 'катались на лыжах и танцевали', null, null]),
        'ru',
      );
      // Multiple lexicon stems match — "лыж" (skiing), "танц" (dancing),
      // and "катал" (riding). All three hints appear, comma-separated,
      // before the Russian narrative. Order follows lexicon order
      // (Set preserves insertion order), but we don't pin the exact
      // sequence here — just verify all three hints are present and
      // sit before the narrative.
      const idxNarrative = p.indexOf('катались на лыжах');
      expect(idxNarrative).toBeGreaterThan(0);
      for (const hint of ['skiing on snow', 'dancing', 'riding']) {
        const idxHint = p.indexOf(hint);
        expect(idxHint).toBeGreaterThan(-1);
        expect(idxHint).toBeLessThan(idxNarrative);
      }
    });

    it('adds no hint when the Russian action has no recognised substring', () => {
      const p = buildPrompt(
        story(['кенгуру', 'с пингвином', 'в библиотеке', 'в субботу', 'размышляли о вечности', null, null]),
        'ru',
      );
      // No hint inserted — the narrative (which follows the item-10 anchor)
      // starts with the action verb from the ru template ("{4}: {0} {1}, ...").
      expect(p).not.toContain('skiing');
      expect(p).toContain('размышляли о вечности:');
      // Item-10 RU anchor sits at the front; the narrative starts right after it.
      expect(p.startsWith('1 кенгуру слева, 1 пингвином справа, ')).toBe(true);
      const anchorEnd = '1 кенгуру слева, 1 пингвином справа, '.length;
      expect(p.slice(anchorEnd).startsWith('размышляли о вечности:')).toBe(true);
    });

    it('does NOT apply hints to English prompts', () => {
      const p = buildPrompt(
        story(['a cat', 'with a dog', 'in a library', 'on Saturday', 'were skiing on snow', null, null]),
        'en',
      );
      // The English path uses the EN template (subject-first) and no
      // hint module. The phrase "skiing on snow" would normally be a
      // hint trigger via the "лыж" stem, but English bypasses the
      // lexicon entirely. The English answer happens to contain the
      // literal English phrase, so we check via narrative order
      // (subject first, not a leading "skiing on snow, " hint).
      expect(p.startsWith('skiing on snow, ')).toBe(false);
      expect(p.indexOf('a cat')).toBeLessThan(p.indexOf('skiing on snow'));
    });

    it('hint sits between "two of them, " (item 19) and the narrative', () => {
      const p = buildPrompt(
        story(['кот', 'кот', 'в библиотеке', 'в субботу', 'катались на лыжах', null, null]),
        'ru',
      );
      // Order: "two of them, skiing on snow, катались на лыжах: кот и кот ..."
      expect(p.startsWith('two of them, skiing on snow, ')).toBe(true);
      expect(p).toContain('кот и кот');
    });
  });

  it('no longer contains the negative-prompt fragment "no text"', () => {
    const p = buildPrompt(story(['a', 'b', 'c', 'd', 'e', 'f', 'g']), 'en');
    expect(p).not.toContain('no text');
    expect(p).not.toContain('no words');
  });

  // Item 19 of BUGS_AND_IMPROVEMENTS_01.md — when "Who?" and "With whom?"
  // refer to the same subject ("mouse with mouse"), prepend an explicit
  // count anchor so Flux renders two distinct subjects instead of
  // collapsing them visually.
  describe('duplicate-subject detection (item 19)', () => {
    it('prepends "two of them, " on an exact duplicate', () => {
      const p = buildPrompt(
        story(['mouse', 'mouse', 'in a library', 'on Saturday', 'skiing', null, null]),
        'en',
      );
      expect(p.startsWith('two of them, ')).toBe(true);
    });

    it('strips a leading "with"/"with a" before comparing', () => {
      const p = buildPrompt(
        story(['a mouse', 'with a mouse', 'in a library', 'on Saturday', 'skiing', null, null]),
        'en',
      );
      expect(p.startsWith('two of them, ')).toBe(true);
    });

    it('matches Russian duplicates across declension (мышь / с мышью)', () => {
      const p = buildPrompt(
        story(['мышь', 'с мышью', 'в библиотеке', 'в субботу', 'катались', null, null]),
        'ru',
      );
      expect(p.startsWith('two of them, ')).toBe(true);
    });

    it('matches when adjectives differ but the head noun is the same', () => {
      const p = buildPrompt(
        story([
          'a tiny mouse',
          'with a giant mouse',
          'in a library',
          'on Saturday',
          'skiing',
          null,
          null,
        ]),
        'en',
      );
      expect(p.startsWith('two of them, ')).toBe(true);
    });

    it('does NOT fire when subjects are clearly different', () => {
      const p = buildPrompt(
        story(['a mouse', 'with a cat', 'in a library', 'on Saturday', 'skiing', null, null]),
        'en',
      );
      expect(p.startsWith('two of them')).toBe(false);
    });

    it('does NOT fire on the null-fallback pair (avoids self-collision on "something surprising")', () => {
      const p = buildPrompt(story([null, null, null, null, null, null, null]), 'en');
      expect(p.startsWith('two of them')).toBe(false);
    });

    it('does NOT fire when only one slot is null', () => {
      const p = buildPrompt(
        story([null, 'with a mouse', 'in a library', 'on Saturday', 'skiing', null, null]),
        'en',
      );
      expect(p.startsWith('two of them')).toBe(false);
    });

    it('does NOT fire on incidentally-overlapping short head tokens (<4 chars)', () => {
      // "cat" / "cat" still triggers — exact match runs before the
      // stem check — which is the correct behaviour. But a token like
      // "of" would be below the stem threshold; this test pins that
      // the stem path isn't lenient enough to collide on short common
      // words.
      const p = buildPrompt(
        story([
          'a wizard of light',
          'with a goblin of darkness',
          'in a library',
          'on Saturday',
          'fighting',
          null,
          null,
        ]),
        'en',
      );
      // Last tokens are "light" / "darkness" — stems "ligh" / "dark"
      // do not match.
      expect(p.startsWith('two of them')).toBe(false);
    });
  });

  // Item 10 of BUGS_AND_IMPROVEMENTS_02.md — Flux/CLIP merges adjacent
  // nouns ("a cat with a dog" → one cat-dog chimera). Prepend an
  // explicit anchor that numerically and lexically separates them.
  // Mutually exclusive with item 19's same-subject "two of them" anchor.
  //
  // Language-aware (refined per user feedback):
  //   EN → "two distinct subjects, X and Y, "
  //   RU → "1 X слева, 1 Y справа, " (spatial separator, digit numeric to
  //         sidestep grammatical gender of player nouns)
  describe('distinct-subjects anchor (item 10 of vol02)', () => {
    it('prepends the EN anchor for two different EN bare nouns', () => {
      const p = buildPrompt(
        story(['cat', 'dog', 'in a library', 'on Saturday', 'skiing', null, null]),
        'en',
      );
      expect(p.startsWith('two distinct subjects, cat and dog, ')).toBe(true);
      // The narrative still includes both subjects — repetition is intentional.
      expect(p).toContain('cat');
      expect(p).toContain('dog');
    });

    it('strips a leading "with" / article before listing the EN subjects', () => {
      const p = buildPrompt(
        story(['a cat', 'with a dog', 'in a library', 'on Saturday', 'skiing', null, null]),
        'en',
      );
      expect(p.startsWith('two distinct subjects, cat and dog, ')).toBe(true);
    });

    it('prepends the RU anchor with spatial separators for two different RU bare nouns', () => {
      const p = buildPrompt(
        story(['кот', 'собака', 'в библиотеке', 'в субботу', 'катались', null, null]),
        'ru',
      );
      // Russian rooms get a Russian anchor: numeric (1) + spatial (слева/справа).
      expect(p.startsWith('1 кот слева, 1 собака справа, ')).toBe(true);
      // The narrative still uses the Russian forms ("кот и собака").
      expect(p).toContain('кот и собака');
      // The English EN anchor must NOT leak into RU prompts.
      expect(p).not.toContain('two distinct subjects');
    });

    it('strips a leading "с" / "со" before listing the RU subjects (case kept as-is)', () => {
      const p = buildPrompt(
        story(['кот', 'с собакой', 'в библиотеке', 'в субботу', 'катались', null, null]),
        'ru',
      );
      // Player's instrumental case ("собакой") stays as-is inside the anchor;
      // Flux recognises the noun root for the visual concept regardless of case.
      expect(p.startsWith('1 кот слева, 1 собакой справа, ')).toBe(true);
    });

    it('does NOT fire the distinct anchor on a duplicate pair (item 19 wins)', () => {
      const p = buildPrompt(
        story(['mouse', 'mouse', 'in a library', 'on Saturday', 'skiing', null, null]),
        'en',
      );
      expect(p.startsWith('two of them, ')).toBe(true);
      expect(p).not.toContain('two distinct subjects');
    });

    it('does NOT fire the RU distinct anchor on a duplicate RU pair', () => {
      const p = buildPrompt(
        story(['кот', 'кот', 'в библиотеке', 'в субботу', 'катались', null, null]),
        'ru',
      );
      expect(p.startsWith('two of them, ')).toBe(true);
      expect(p).not.toMatch(/^1 .* слева,/);
    });

    it('does NOT fire when slot 0 or slot 1 is null', () => {
      const p1 = buildPrompt(
        story([null, 'with a dog', 'in a library', 'on Saturday', 'skiing', null, null]),
        'en',
      );
      const p2 = buildPrompt(
        story(['a cat', null, 'in a library', 'on Saturday', 'skiing', null, null]),
        'en',
      );
      expect(p1).not.toContain('two distinct subjects');
      expect(p2).not.toContain('two distinct subjects');
    });

    it('composes with the item-2-B Russian action hint — RU anchor first, then hint, then narrative', () => {
      const p = buildPrompt(
        story(['кот', 'собака', 'в библиотеке', 'в субботу', 'катались на лыжах', null, null]),
        'ru',
      );
      // Order: RU distinct-subjects anchor → English action hint → Russian narrative
      const idxAnchor = p.indexOf('1 кот слева, 1 собака справа, ');
      const idxHint = p.indexOf('skiing on snow');
      const idxNarrative = p.indexOf('катались на лыжах');
      expect(idxAnchor).toBe(0);
      expect(idxHint).toBeGreaterThan(idxAnchor);
      expect(idxNarrative).toBeGreaterThan(idxHint);
    });
  });

  // Item 12 of BUGS_AND_IMPROVEMENTS_02.md — the EN image template
  // "{0} {1} {4}, ..." has no connector between slots 0 and 1, so a
  // bare-noun slot 1 used to produce "cat dog skiing" which CLIP parses
  // as a compound noun (cat-dog chimera). The fix mirrors the Russian
  // "и" prefix from item 23: prepend "and " to slot 1 in the image
  // prompt only (the prose template hardcodes "and"), unless slot 1
  // already begins with a connector ("with"/"and").
  describe('English slot-1 "and" prefix (item 12 of vol02)', () => {
    it('prepends "and" to slot 1 when slot 1 is a bare noun', () => {
      const p = buildPrompt(
        story(['cat', 'dog', 'in a library', 'on Saturday', 'skiing', null, null]),
        'en',
      );
      expect(p).toContain('cat and dog skiing');
      expect(p).not.toMatch(/cat dog skiing/);
    });

    it('does NOT prepend "and" when slot 1 already starts with "with"', () => {
      const p = buildPrompt(
        story(['a cat', 'with a dog', 'in a library', 'on Saturday', 'skiing', null, null]),
        'en',
      );
      expect(p).toContain('a cat with a dog skiing');
      expect(p).not.toContain('cat and with a dog');
    });

    it('does NOT prepend "and" when slot 1 already starts with "and"', () => {
      const p = buildPrompt(
        story(['a cat', 'and a dog', 'in a library', 'on Saturday', 'skiing', null, null]),
        'en',
      );
      expect(p).toContain('a cat and a dog skiing');
      expect(p).not.toContain('and and a dog');
    });

    it('does NOT apply the EN "and" prefix to Russian prompts', () => {
      const p = buildPrompt(
        story(['кот', 'лошадь', 'в библиотеке', 'в субботу', 'катались', null, null]),
        'ru',
      );
      // Russian still uses its own "и" prefix from item 23, not the EN "and".
      expect(p).toContain('кот и лошадь');
      expect(p).not.toContain(' and ');
    });
  });

  // Item 23 of BUGS_AND_IMPROVEMENTS_01.md — the Russian slot-1 "и"
  // prefix is applied to the image prompt as well, so the prose and
  // the image prompt agree on "кот и лошадь" vs "кот лошадь".
  describe('Russian slot-1 "и" prefix (item 23)', () => {
    it('prepends "и" to slot 1 when slot 1 is a bare noun', () => {
      const p = buildPrompt(
        story(['кот', 'лошадь', 'в библиотеке', 'в субботу', 'катались', null, null]),
        'ru',
      );
      expect(p).toContain('кот и лошадь');
      expect(p).not.toMatch(/^кот лошадь/);
    });

    it('does NOT prepend "и" when slot 1 already starts with "с"', () => {
      const p = buildPrompt(
        story(['кот', 'с лошадью', 'в библиотеке', 'в субботу', 'катались', null, null]),
        'ru',
      );
      expect(p).toContain('кот с лошадью');
      expect(p).not.toContain('и с лошадью');
    });

    it('does NOT prepend "и" when slot 1 already starts with "со"', () => {
      const p = buildPrompt(
        story(['я', 'со своей бабушкой', 'в библиотеке', 'в субботу', 'гуляли', null, null]),
        'ru',
      );
      expect(p).toContain('я со своей бабушкой');
      expect(p).not.toContain('и со своей');
    });

    it('does NOT apply the Russian "и" prefix to English prompts', () => {
      const p = buildPrompt(
        story(['a cat', 'a horse', 'in a library', 'on Saturday', 'skiing', null, null]),
        'en',
      );
      expect(p).not.toContain(' и ');
    });

    it('composes with item 19s "two of them" anchor on identical bare-noun pair', () => {
      // Both transforms fire: duplicate detection prepends "two of
      // them, ", AND slot 1 gets the "и" connective. The result
      // surfaces both signals to the model.
      const p = buildPrompt(
        story(['кот', 'кот', 'в библиотеке', 'в субботу', 'катались', null, null]),
        'ru',
      );
      expect(p.startsWith('two of them, ')).toBe(true);
      expect(p).toContain('кот и кот');
    });
  });
});

============================================================================ */
