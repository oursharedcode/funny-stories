// SPDX-License-Identifier: AGPL-3.0-only

import { describe, it, expect } from 'vitest';
import { containsCsamCombination } from './csam.js';

// Combinatorial heuristic, spec §6 — both a minor-indicator AND a
// sexual-indicator must appear before the guard fires. Either alone is fine.
describe('containsCsamCombination — spec §6', () => {
  it('returns false for an empty prompt', () => {
    expect(containsCsamCombination('')).toBe(false);
  });

  it('returns false for a plain party-game prompt', () => {
    expect(
      containsCsamCombination(
        'three kids in a trench coat, with a haunted toaster, inside a cheese factory',
      ),
    ).toBe(false);
  });

  it('returns false when only a minor-indicator is present', () => {
    expect(containsCsamCombination('a child, with a duck, in a library')).toBe(false);
    expect(containsCsamCombination('ребёнок, с уткой, в библиотеке')).toBe(false);
  });

  it('returns false when only a sexual-indicator is present', () => {
    expect(containsCsamCombination('a sexy hat, with a duck, in a library')).toBe(false);
    expect(containsCsamCombination('голая утка в библиотеке')).toBe(false);
  });

  it('returns true when both categories co-occur (English)', () => {
    expect(containsCsamCombination('a naked child in a library')).toBe(true);
    expect(containsCsamCombination('schoolgirl, nude, on a bus')).toBe(true);
  });

  it('returns true when both categories co-occur (Russian)', () => {
    expect(containsCsamCombination('голый ребёнок в библиотеке')).toBe(true);
    expect(containsCsamCombination('девочка, эротика, на крыше')).toBe(true);
  });

  it('returns true across mixed-language prompts', () => {
    expect(containsCsamCombination('a child, голая, in a library')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(containsCsamCombination('A NAKED CHILD')).toBe(true);
    expect(containsCsamCombination('ГОЛЫЙ РЕБЁНОК')).toBe(true);
  });

  it('handles ё/е equivalence (NFKD + diacritic strip)', () => {
    expect(containsCsamCombination('голая ребенок')).toBe(true);
    expect(containsCsamCombination('голая ребёнок')).toBe(true);
  });

  it('catches the lolita/shota fandom markers paired with sexual content', () => {
    expect(containsCsamCombination('lolita, erotic, on a bus')).toBe(true);
    expect(containsCsamCombination('shotacon, nude, in a library')).toBe(true);
  });

  it('does not trip on the existing stand-ins (smoke check)', () => {
    // The verbatim §6 stand-in pools should never trip the heuristic, since
    // they contain no sexual indicators by construction.
    expect(containsCsamCombination('three children in a trench coat')).toBe(false);
    expect(containsCsamCombination('трое детей в одном плаще')).toBe(false);
  });
});
