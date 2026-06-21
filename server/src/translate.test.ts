// SPDX-License-Identifier: AGPL-3.0-only

// Translation is the load-bearing first step of picture-prompt moderation: the
// CSAM/profanity guards only read English, so a non-English answer that fails
// to translate must be flagged (`untranslated`) and fail closed downstream.
// These tests pin the retry-then-flag contract with a mocked fetch — no
// network. See docs/MODERATION.md and prompt.ts buildPrompt.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translateToEnglish } from './translate.js';

const okResponse = (translatedText: string) =>
  ({
    ok: true,
    json: async () => ({ responseStatus: 200, responseData: { translatedText } }),
  }) as unknown as Response;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('translateToEnglish — fail-closed signalling (CSAM coverage)', () => {
  it('short-circuits an English room without touching the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await translateToEnglish(['a cat', null], 'en');

    expect(res).toEqual({ texts: ['a cat', null], untranslated: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('translates non-empty slots and reports untranslated:false on success', async () => {
    const fetchMock = vi.fn(async () => okResponse('cat'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await translateToEnglish(['кот-unique-a', null, ''], 'ru');

    expect(res.untranslated).toBe(false);
    expect(res.texts[0]).toBe('cat');
    expect(res.texts[1]).toBeNull();
    expect(res.texts[2]).toBe('');
  });

  it('retries a failing slot once, then keeps the original and flags untranslated', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network down');
    });
    vi.stubGlobal('fetch', fetchMock);

    const original = 'непереводимое-unique-b';
    const res = await translateToEnglish([original], 'ru');

    expect(res.untranslated).toBe(true);
    expect(res.texts[0]).toBe(original); // original kept, unscreened
    expect(fetchMock).toHaveBeenCalledTimes(2); // first attempt + one retry
  });

  it('flags untranslated when MyMemory returns a non-200 responseStatus', async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({ responseStatus: 403, responseData: {} }),
        }) as unknown as Response,
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await translateToEnglish(['другое-unique-c'], 'ru');

    expect(res.untranslated).toBe(true);
    expect(res.texts[0]).toBe('другое-unique-c');
  });
});
