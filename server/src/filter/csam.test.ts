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

  // Fallback per-language coverage (spec §6) — the picture prompt is normally
  // translated to English before this guard, but these lists back up the cases
  // translation can't clean (untranslated passthrough, mixed-language text).
  it('returns true when both categories co-occur (French)', () => {
    expect(containsCsamCombination('un enfant, nudité, dans une bibliothèque')).toBe(true);
    expect(containsCsamCombination('fillette, érotique, sur un bus')).toBe(true);
  });

  it('returns true when both categories co-occur (German)', () => {
    expect(containsCsamCombination('nacktes mädchen in einer bibliothek')).toBe(true);
    expect(containsCsamCombination('minderjährig, erotik, auf dem dach')).toBe(true);
  });

  it('returns true when both categories co-occur (Spanish)', () => {
    expect(containsCsamCombination('niño desnudo en una biblioteca')).toBe(true);
    expect(containsCsamCombination('colegiala, tetas, en un autobús')).toBe(true);
  });

  it('returns true when both categories co-occur (Italian)', () => {
    expect(containsCsamCombination('bambino nudo in biblioteca')).toBe(true);
    expect(containsCsamCombination('minorenne, sesso, sul tetto')).toBe(true);
  });

  it('returns true when both categories co-occur (Portuguese)', () => {
    expect(containsCsamCombination('criança, nudez, numa biblioteca')).toBe(true);
    expect(containsCsamCombination('menino, foder, no telhado')).toBe(true);
  });

  it('returns true when both categories co-occur (Indonesian)', () => {
    expect(containsCsamCombination('anak telanjang di perpustakaan')).toBe(true);
    expect(containsCsamCombination('gadis, payudara, di bus')).toBe(true);
  });

  it('returns true when both categories co-occur (Chinese)', () => {
    expect(containsCsamCombination('儿童裸体在图书馆')).toBe(true);
    expect(containsCsamCombination('女孩，色情，在公交车上')).toBe(true);
  });

  it('returns true when both categories co-occur (Japanese)', () => {
    expect(containsCsamCombination('女の子 エロ 図書館で')).toBe(true);
    expect(containsCsamCombination('幼児、全裸、バスで')).toBe(true);
  });

  it('returns true when both categories co-occur (Korean)', () => {
    expect(containsCsamCombination('소녀 나체 도서관에서')).toBe(true);
    expect(containsCsamCombination('미성년 포르노 옥상에서')).toBe(true);
  });

  it('returns true when both categories co-occur (Ukrainian)', () => {
    expect(containsCsamCombination('гола дитина в бібліотеці')).toBe(true);
    expect(containsCsamCombination('дівчинка, порно, на даху')).toBe(true);
  });

  it('returns true when both categories co-occur (Hebrew)', () => {
    expect(containsCsamCombination('ילד עירום בספרייה')).toBe(true);
    expect(containsCsamCombination('נערה, פורנו, על הגג')).toBe(true);
  });

  it('returns true when both categories co-occur (Tamil)', () => {
    expect(containsCsamCombination('நிர்வாண குழந்தை நூலகத்தில்')).toBe(true);
    expect(containsCsamCombination('சிறுமி, ஆபாச, பேருந்தில்')).toBe(true);
  });

  it('returns false for single-category prompts in other languages', () => {
    // Minor-only.
    expect(containsCsamCombination('un enfant avec un canard, dans une bibliothèque')).toBe(false);
    expect(containsCsamCombination('niño con un pato en una biblioteca')).toBe(false);
    expect(containsCsamCombination('儿童和一只鸭子在图书馆')).toBe(false);
    // Sexual-only.
    expect(containsCsamCombination('un chapeau érotique sur un canard')).toBe(false);
    expect(containsCsamCombination('色情的鸭子在图书馆')).toBe(false);
  });

  it('returns false for single-category prompts in the newest languages (uk/he/ta)', () => {
    // Minor-only.
    expect(containsCsamCombination('дитина з качкою в бібліотеці')).toBe(false);
    expect(containsCsamCombination('ילד עם ברווז בספרייה')).toBe(false);
    expect(containsCsamCombination('குழந்தை ஒரு வாத்துடன் நூலகத்தில்')).toBe(false);
    // Sexual-only.
    expect(containsCsamCombination('гола качка в бібліотеці')).toBe(false);
    expect(containsCsamCombination('ברווז עירום בספרייה')).toBe(false);
    expect(containsCsamCombination('நிர்வாண வாத்து நூலகத்தில்')).toBe(false);
  });

  it('does not trip on the existing stand-ins (smoke check)', () => {
    // The verbatim §6 stand-in pools should never trip the heuristic, since
    // they contain no sexual indicators by construction.
    expect(containsCsamCombination('three children in a trench coat')).toBe(false);
    expect(containsCsamCombination('трое детей в одном плаще')).toBe(false);
  });
});
