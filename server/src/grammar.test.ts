// SPDX-License-Identifier: AGPL-3.0-only

// polishRussianProse is the offline, dependency-free punctuation pass applied
// to Russian story prose before it reaches the reveal screen and the
// downloadable image/video. These tests pin the two things that matter: it
// adds the high-confidence commas (and capitalisation + terminal period), and
// it stays conservative — it never rewrites a player's word and never inserts
// the ambiguous commas that would risk reading worse than none.

import { describe, expect, it } from 'vitest';
import { polishRussianProse } from './grammar.js';

describe('polishRussianProse — clause commas', () => {
  it('inserts a comma before adversative "но"', () => {
    expect(polishRussianProse('я хотел спать но кот мешал')).toBe('Я хотел спать, но кот мешал.');
  });

  it('inserts a comma before "чтобы"', () => {
    expect(polishRussianProse('мы копали яму чтобы спрятать клад')).toBe(
      'Мы копали яму, чтобы спрятать клад.',
    );
  });

  it('inserts a comma before "потому что" (only as a pair)', () => {
    expect(polishRussianProse('он убежал потому что испугался')).toBe(
      'Он убежал, потому что испугался.',
    );
  });

  it('inserts a comma before a relative "который" form', () => {
    expect(polishRussianProse('кот бежал за мышью которую видел')).toBe(
      'Кот бежал за мышью, которую видел.',
    );
  });

  it('inserts a comma before contrastive "а"', () => {
    expect(polishRussianProse('кот спал а собака бегала')).toBe('Кот спал, а собака бегала.');
  });
});

describe('polishRussianProse — conservative (no wrong commas)', () => {
  it('does not touch the ambiguous "что"', () => {
    expect(polishRussianProse('я знаю что он тут')).toBe('Я знаю что он тут.');
  });

  it('does not put a comma between "даже" and "если"', () => {
    expect(polishRussianProse('приходи даже если поздно')).toBe('Приходи даже если поздно.');
  });

  it('does not double an existing comma', () => {
    expect(polishRussianProse('кот спал, но проснулся')).toBe('Кот спал, но проснулся.');
  });

  it('does not add a comma when the trigger opens a sentence', () => {
    expect(polishRussianProse('он ушёл. Однако вернулся')).toBe('Он ушёл. Однако вернулся.');
  });
});

describe('polishRussianProse — capitalisation, period, spacing', () => {
  it('capitalises the opening word and adds a terminal period', () => {
    expect(polishRussianProse('мышь спала')).toBe('Мышь спала.');
  });

  it('keeps an existing terminal mark', () => {
    expect(polishRussianProse('кот сбежал!')).toBe('Кот сбежал!');
  });

  it('collapses the double space an empty answer slot leaves behind', () => {
    expect(polishRussianProse('кот  бежал')).toBe('Кот бежал.');
  });
});
