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
// original is kept for that slot AND the `untranslated` flag is set, so the
// prompt is always well-formed but the caller learns a non-English answer
// could not be screened. Each failing slot is retried once before giving up.
// The caller (buildPrompt → generateStoryPicture) fails closed on
// `untranslated`: a non-English answer that reaches the English CSAM guard
// untranslated would slip past it, so generation is refused instead.
//
// Caching: in-memory Map keyed by `<sourceLang>|<text>` avoids paying for
// the same answer twice. LRU-ish eviction at CACHE_LIMIT.

import type { Language } from './types.js';

const CACHE_LIMIT = 2000;
const TIMEOUT_MS = 4000;
// One extra attempt after the first failure. A transient blip (timeout, a
// single 5xx, a momentary rate-limit) often clears on retry, which keeps the
// fail-closed block below from firing on legitimate answers.
const TRANSLATE_RETRIES = 1;
const RETRY_DELAY_MS = 300;
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

// Attempts one slot, retrying once on failure. Returns the translated string,
// or null when every attempt failed (caller keeps the original and flags it).
async function translateWithRetry(
  text: string,
  sourceCode: string,
): Promise<string | null> {
  for (let attempt = 0; attempt <= TRANSLATE_RETRIES; attempt++) {
    try {
      return await translateOne(text, sourceCode);
    } catch {
      if (attempt < TRANSLATE_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
  return null;
}

export interface TranslationResult {
  // One output per input, in order. Failing/empty slots keep their original.
  texts: (string | null)[];
  // True when at least one non-empty slot could not be translated (after the
  // retry) — i.e. a non-English answer reaches the prompt unscreened. The
  // caller fails closed on this. Always false for an English room (answers are
  // already English and covered by the English CSAM/profanity checks directly).
  untranslated: boolean;
}

// Translates `texts` to English. Null/empty inputs are passed through
// untouched. On a per-item failure the original is kept and `untranslated` is
// set so the caller can refuse to ship an unscreened prompt to the model.
export async function translateToEnglish(
  texts: (string | null)[],
  sourceLanguage: Language,
): Promise<TranslationResult> {
  if (sourceLanguage === 'en') return { texts, untranslated: false };
  const sourceCode = toMyMemorySource(sourceLanguage);
  // No MyMemory mapping for this language: we cannot translate, so we cannot
  // screen it. Fail closed (untranslated) rather than ship it unverified. All
  // 12 shipped languages are mapped, so this only trips if a new language code
  // is added without a mapping — a loud, immediate signal to add one.
  if (!sourceCode) return { texts, untranslated: true };

  const cachePrefix = `${sourceCode}|`;
  const out: (string | null)[] = texts.map((t) => t);
  let untranslated = false;

  await Promise.all(
    texts.map(async (text, i) => {
      if (text == null || text.trim() === '') return;
      const hit = cacheGet(cachePrefix + text);
      if (hit !== undefined) {
        out[i] = hit;
        return;
      }
      const translated = await translateWithRetry(text, sourceCode);
      if (translated === null) {
        // Original kept (out[i] already holds it); flag it as unscreened.
        untranslated = true;
        return;
      }
      out[i] = translated;
      cacheSet(cachePrefix + text, translated);
    }),
  );
  return { texts: out, untranslated };
}
