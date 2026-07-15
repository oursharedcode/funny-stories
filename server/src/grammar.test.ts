// SPDX-License-Identifier: AGPL-3.0-only

// polishRussianProse turns assembled Russian story prose into proper Russian
// for the reveal screen and the downloadable image/video: LanguageTool
// commas/punctuation, a capitalised opening, and a terminal period. These
// tests pin that contract with a mocked fetch — no network — and, crucially,
// the verbatim-answer invariant: a suggestion that would rewrite a word (and
// so both edit a player's answer and break the pink highlight) must be
// rejected, while a pure punctuation/case change is applied.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { polishRussianProse } from './grammar.js';

interface LtMatch {
  offset: number;
  length: number;
  replacements: { value: string }[];
}

const ltResponse = (matches: LtMatch[]) =>
  ({ ok: true, json: async () => ({ matches }) }) as unknown as Response;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('polishRussianProse', () => {
  it('applies a comma suggestion and capitalises + terminates the sentence', async () => {
    const input = 'я хотел спать но кот мешал';
    // LanguageTool flags "спать" (offset 8, length 5) and suggests "спать,".
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ltResponse([{ offset: 8, length: 5, replacements: [{ value: 'спать,' }] }])),
    );

    const out = await polishRussianProse(input);

    expect(out).toBe('Я хотел спать, но кот мешал.');
  });

  it('rejects a word-rewriting suggestion (verbatim-answer invariant)', async () => {
    const input = 'кот бежал';
    // A spelling "correction" that changes letters — must be ignored so the
    // player's answer stays verbatim and its highlight still matches.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ltResponse([{ offset: 0, length: 3, replacements: [{ value: 'пёс' }] }])),
    );

    const out = await polishRussianProse(input);

    expect(out).toBe('Кот бежал.'); // rewrite skipped; only tidy applied
  });

  it('fails open when LanguageTool is unreachable — still tidies deterministically', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    const out = await polishRussianProse('мышь спала');

    expect(out).toBe('Мышь спала.');
  });

  it('does not double up an existing terminal period', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ltResponse([])));

    const out = await polishRussianProse('Кот бежал.');

    expect(out).toBe('Кот бежал.');
  });

  it('collapses the double space an empty answer slot leaves behind', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ltResponse([])));

    const out = await polishRussianProse('кот  бежал');

    expect(out).toBe('Кот бежал.');
  });

  it('caches by input — a second call does not hit the network again', async () => {
    const fetchMock = vi.fn(async () => ltResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await polishRussianProse('уникальный кот номер один');
    await polishRussianProse('уникальный кот номер один');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
