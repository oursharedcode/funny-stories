// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { containsHardBlock } from './hardBlocks.js';

// Unconditional list, spec §6. A single hit is enough — unlike CSAM's
// combinatorial guard, no second-category match is required.
describe('containsHardBlock — spec §6', () => {
  it('returns false for an empty prompt', () => {
    expect(containsHardBlock('')).toBe(false);
  });

  it('returns false for a clean party-game prompt', () => {
    expect(
      containsHardBlock(
        'a sleepy llama, with a haunted toaster, inside a cheese factory',
      ),
    ).toBe(false);
  });

  it('blocks English sexual-violence terms', () => {
    expect(containsHardBlock('a duck rape on Tuesday')).toBe(true);
    expect(containsHardBlock('the molester appeared in the library')).toBe(true);
  });

  it('blocks Russian sexual-violence stems (any inflection)', () => {
    expect(containsHardBlock('утка изнасиловала тостер')).toBe(true);
    expect(containsHardBlock('пингвин насиловал кофеварку')).toBe(true);
  });

  it('blocks targeted-violence verbs', () => {
    expect(containsHardBlock('a plot to assassinate the duck president')).toBe(true);
    expect(containsHardBlock('the chicken was beheaded by a kettle')).toBe(true);
  });

  it('blocks CSAM standalone terms regardless of CSAM combinatorial', () => {
    expect(containsHardBlock('a paedophile on a bicycle')).toBe(true);
    expect(containsHardBlock('the pedo was caught immediately')).toBe(true);
    expect(containsHardBlock('педофил в библиотеке')).toBe(true);
  });

  it('blocks bestiality unconditionally', () => {
    expect(containsHardBlock('a scene depicting bestiality')).toBe(true);
    expect(containsHardBlock('скотоложство на даче')).toBe(true);
  });

  it('blocks "child porn" phrases', () => {
    expect(containsHardBlock('this is child porn')).toBe(true);
    expect(containsHardBlock('child pornography')).toBe(true);
    expect(containsHardBlock('детское порно')).toBe(true);
  });

  it('does NOT trip on common words containing a substring of a blocked one', () => {
    // \b boundary protects English; Russian stems are chosen to avoid
    // collision. These should all be clean.
    expect(containsHardBlock('a rapid pedometer')).toBe(false);
    expect(containsHardBlock('the rapport was great')).toBe(false);
    expect(containsHardBlock('pediatric specialist on call')).toBe(false);
    expect(containsHardBlock('a violent storm was brewing')).toBe(false); // "violent" ≠ "насилов"
    expect(containsHardBlock('ненасильственный протест')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(containsHardBlock('A DUCK RAPE')).toBe(true);
    expect(containsHardBlock('ПЕДОФИЛ В ЛИФТЕ')).toBe(true);
  });

  it('does not trip on the existing stand-ins (smoke check)', () => {
    expect(containsHardBlock('three children in a trench coat')).toBe(false);
    expect(containsHardBlock('трое детей в одном плаще')).toBe(false);
  });
});
