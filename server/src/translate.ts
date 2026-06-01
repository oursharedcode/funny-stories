// SPDX-License-Identifier: AGPL-3.0-only

// Translates per-slot answer strings to English before the image prompt is
// assembled. Flux's CLIP text encoder is English-trained, so non-English
// answers don't bind to visual concepts; pre-translating gives the model an
// English noun/verb to anchor on. Player-facing prose stays in the room's
// language — only the picture prompt is translated.
//
// Provider: MyMemory (https://mymemory.translated.net) — public, free,
// **no signup, no credit card, no API key**. Anonymous quota is 5000
// words/day per IP (10000 with an email passed as `de=` parameter, optional
// via MYMEMORY_EMAIL env var). One GET per slot, in parallel.
//
// On any failure (network down, rate-limited, unknown language) the
// originals are returned so the prompt is always well-formed.
//
// Caching: in-memory Map keyed by `<sourceLang>|<text>` avoids paying for
// the same answer twice. LRU-ish eviction at CACHE_LIMIT.

import type { Language } from './types.js';

const CACHE_LIMIT = 2000;
const TIMEOUT_MS = 4000;
const ENDPOINT = 'https://api.mymemory.translated.net/get';

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

// Map our internal language codes to MyMemory source codes (ISO 639-1,
// with region for pt-br / es variants).
function toMyMemorySource(language: Language): string | null {
  const map: Partial<Record<Language, string>> = {
    en: 'en',
    fr: 'fr',
    de: 'de',
    ru: 'ru',
    id: 'id',
    it: 'it',
    zh: 'zh-CN',
    ja: 'ja',
    ko: 'ko',
    'pt-br': 'pt-BR',
    'es-419': 'es',
    'es-es': 'es',
  };
  return map[language] ?? null;
}

async function translateOne(text: string, sourceCode: string): Promise<string> {
  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceCode}|en`,
  });
  const email = process.env.MYMEMORY_EMAIL;
  if (email) params.set('de', email);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
    const data = (await res.json()) as {
      responseStatus?: number;
      responseData?: { translatedText?: string };
    };
    if (data.responseStatus !== 200) {
      throw new Error(`MyMemory status ${data.responseStatus}`);
    }
    const out = data.responseData?.translatedText;
    if (!out || out.trim() === '') throw new Error('empty translation');
    return out;
  } finally {
    clearTimeout(timer);
  }
}

// Translates `texts` to English. Returns one output per input, in order.
// Null/empty inputs are passed through untouched. On any per-item failure
// the original is kept — the caller's prompt is still well-formed.
export async function translateToEnglish(
  texts: (string | null)[],
  sourceLanguage: Language,
): Promise<(string | null)[]> {
  if (sourceLanguage === 'en') return texts;
  const sourceCode = toMyMemorySource(sourceLanguage);
  if (!sourceCode) return texts;

  const cachePrefix = `${sourceCode}|`;
  const out: (string | null)[] = texts.map((t) => t);

  await Promise.all(
    texts.map(async (text, i) => {
      if (text == null || text.trim() === '') return;
      const hit = cacheGet(cachePrefix + text);
      if (hit !== undefined) {
        out[i] = hit;
        return;
      }
      try {
        const translated = await translateOne(text, sourceCode);
        out[i] = translated;
        cacheSet(cachePrefix + text, translated);
      } catch {
        // Keep original on per-item failure.
      }
    }),
  );
  return out;
}
