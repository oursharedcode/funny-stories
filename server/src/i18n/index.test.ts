// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { renderProse } from './index.js';

// Item 20 of BUGS_AND_IMPROVEMENTS_01.md — English-only post-processing on
// slot 5 ("What for?"). Bare player nouns get a "for " prefix at render
// time; answers that already start with a connective are left alone so
// the existing stand-in pool doesn't produce "for to impress a pigeon".
// Russian is untouched.
describe('renderProse — slot-5 "for" prefix (item 20)', () => {
  function answers(slot5: string | null): readonly string[] {
    return ['mouse', 'kangaroo', 'on a balcony', 'in winter', 'skiing', slot5 ?? '', 'shopping'];
  }

  it('inserts "for" before a bare-noun slot-5 answer', () => {
    const p = renderProse('en', answers('money'));
    expect(p).toContain('skiing for money');
  });

  it('inserts "for" before a multi-word noun phrase', () => {
    const p = renderProse('en', answers('big dollars'));
    expect(p).toContain('skiing for big dollars');
  });

  it('leaves slot 5 alone when it already starts with "for"', () => {
    const p = renderProse('en', answers('for science (unverified)'));
    expect(p).toContain('skiing for science (unverified)');
    expect(p).not.toContain('for for');
  });

  it('leaves slot 5 alone when it already starts with "to"', () => {
    const p = renderProse('en', answers('to impress a pigeon'));
    expect(p).toContain('skiing to impress a pigeon');
    expect(p).not.toContain('for to');
  });

  it('leaves slot 5 alone when it already starts with "because"', () => {
    const p = renderProse('en', answers('because the warranty said not to'));
    expect(p).toContain('skiing because the warranty said not to');
    expect(p).not.toContain('for because');
  });

  it('leaves slot 5 alone when it already starts with "in exchange"', () => {
    const p = renderProse('en', answers('in exchange for a single grape'));
    expect(p).toContain('skiing in exchange for a single grape');
    expect(p).not.toContain('for in exchange');
  });

  it('leaves slot 5 alone when it already starts with "out of"', () => {
    const p = renderProse('en', answers('out of spite'));
    expect(p).toContain('skiing out of spite');
    expect(p).not.toContain('for out of');
  });

  it('handles an empty slot 5 without crashing or producing "for "', () => {
    const p = renderProse('en', answers(null));
    expect(p).not.toContain('for  ');
    expect(p).not.toContain('for .');
  });

  it('matches the user-reported bug-report examples', () => {
    // Before-change: "Mouse and kangaroo were on balcony winter. They
    // skiing money. In the end, answer." After-change should insert
    // "for" between "skiing" and "money".
    const p = renderProse('en', [
      'mouse', 'kangaroo', 'on a balcony', 'in winter', 'skiing', 'money', 'answer',
    ]);
    expect(p).toBe(
      'mouse and kangaroo were on a balcony in winter. They skiing for money. In the end, answer.',
    );
  });

  it('does not apply the "for" prefix to Russian (spec §9 leaves RU alone for slot 5)', () => {
    // Russian "Зачем?" answers naturally come with the connective, and
    // the Russian template has its own word order. The EN slot-5
    // "for" injection must be EN-only.
    const p = renderProse('ru', [
      'мышь', 'с кенгуру', 'на балконе', 'зимой', 'катались на лыжах',
      'чтобы поспать', 'ответ',
    ]);
    expect(p).not.toContain('for');
    expect(p).toContain('чтобы поспать');
  });
});

// Item 23 of BUGS_AND_IMPROVEMENTS_01.md — Russian-only post-processing
// on slot 1 ("С кем?") and slot 6 ("Чем всё закончилось?"). Bare-noun
// player answers get "и " / "это закончилось " prepended at render
// time. Stand-ins that already start with the right connective, and
// slot-6 answers that look like full clauses, are left alone. English
// is bypassed entirely.
describe('renderProse — Russian slot-1 "и" and slot-6 "это закончилось" prefixes (item 23)', () => {
  function ru(slot0: string, slot1: string, slot6: string): readonly string[] {
    return [slot0, slot1, 'на балконе', 'зимой', 'катались на лыжах', 'чтобы поспать', slot6];
  }

  it('matches the user-reported bug-report example end-to-end', () => {
    const p = renderProse('ru', [
      'кот', 'кот', 'на трубе', 'в жаркое лето', 'пили воду', 'чтобы поспать', 'путешествием',
    ]);
    expect(p).toBe(
      'кот и кот в жаркое лето на трубе пили воду чтобы поспать. В итоге это закончилось путешествием.',
    );
  });

  it('prepends "и" before a bare-noun slot-1 answer', () => {
    const p = renderProse('ru', ru('мышь', 'кенгуру', 'отдыхом'));
    expect(p).toContain('мышь и кенгуру');
  });

  it('leaves slot 1 alone when it already starts with "с"', () => {
    const p = renderProse('ru', ru('мышь', 'с кенгуру', 'отдыхом'));
    expect(p).toContain('мышь с кенгуру');
    expect(p).not.toContain('и с кенгуру');
  });

  it('leaves slot 1 alone when it already starts with "со"', () => {
    const p = renderProse('ru', ru('я', 'со своей бабушкой', 'отдыхом'));
    expect(p).toContain('я со своей бабушкой');
    expect(p).not.toContain('и со своей');
  });

  it('leaves slot 1 alone when it already starts with "и"', () => {
    const p = renderProse('ru', ru('я', 'и моя бабушка', 'отдыхом'));
    expect(p).toContain('я и моя бабушка');
    expect(p).not.toContain('и и моя');
  });

  it('prepends "это закончилось" before a single-word slot-6 answer', () => {
    const p = renderProse('ru', ru('мышь', 'с кенгуру', 'путешествием'));
    expect(p).toContain('В итоге это закончилось путешествием');
  });

  it('prepends "это закончилось" before a two-word slot-6 answer', () => {
    const p = renderProse('ru', ru('мышь', 'с кенгуру', 'большим путешествием'));
    expect(p).toContain('В итоге это закончилось большим путешествием');
  });

  it('leaves slot 6 alone when it is a multi-word clause (>2 words)', () => {
    const p = renderProse('ru', ru('мышь', 'с кенгуру', 'утка подала официальную жалобу'));
    expect(p).toContain('В итоге утка подала официальную жалобу');
    expect(p).not.toContain('это закончилось утка');
  });

  it('does NOT apply either Russian transform to English', () => {
    // English path uses the existing slot-5 "for" insertion only; slot
    // 1 and slot 6 are passed through verbatim.
    const p = renderProse('en', ['mouse', 'kangaroo', 'on a balcony', 'in winter', 'skiing', 'money', 'a journey']);
    expect(p).not.toContain('и');
    expect(p).not.toContain('закончилось');
    expect(p).toContain('mouse and kangaroo');
    expect(p).toContain('They skiing for money');
  });
});
