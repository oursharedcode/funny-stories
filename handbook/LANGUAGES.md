# Languages & image-prompt translation

## Adding a new language

The project is multilingual from v1. The registry, type, i18n loaders, and filter dispatch are all data-driven, so adding another language is a small, well-bounded set of edits. To add (say) German:

1. **`shared/languages.ts`** — append one row to the `LANGUAGES` array (`{ code: 'de', name: 'Deutsch', flag: '🇩🇪' }`). The `Language` union type is derived from this array, so this edit also widens the type — every `Record<Language, …>` site in the codebase will become a compile error until the rest of the steps are done. **Run `npm run typecheck` now and let the compiler list the remaining required edits for you.**
2. **`client/src/i18n/de.json`** — copy `en.json`, translate every key. The `endScreen.supportServer` key must say "this server", not "the developer" — see [spec §18](../docs/FUNNY_STORIES_SPEC_v4.md#18-things-not-to-do). The Vite glob picks it up automatically; no bootstrap edit needed.
3. **`server/src/i18n/de.json`** — questions array + prose template + image-prompt template. **Do not port the English slot order.** Word order is language-specific (the Russian template already swaps slots 2 and 3 for natural Russian). Write the template the way a native speaker would. The server `readdirSync` picks it up automatically; no bootstrap edit needed.
4. **`server/src/filter/standins.ts`** — 10 stand-ins for each of the 7 question indices, in the new language. These also serve as bot auto-fills.
5. **`server/src/i18n/index.ts`** — if your language needs morphology fixes like English's slot-5 `for` prefix or Russian's slot-1 `и` prefix, extend the `renderProse` switch. Languages without these needs touch nothing here.
6. **(Optional) `server/src/filter/<code>.ts` + register it in `MATCHERS`** in `server/src/filter/index.ts` — native-language profanity matcher. Without it, the OR-all semantic still catches English and Russian profanity in mixed-language answers, so it's safe to skip until a native-speaker review.

When `npm run typecheck` and `npm test` both pass, you're done. See [CONTRIBUTING.md](../CONTRIBUTING.md#translations) for the review workflow.

---

## Image-prompt translation

The image model (Flux Schnell on Cloudflare Workers AI) is anchored on an English-trained CLIP text encoder, so non-English answers in the picture prompt bind poorly to visual concepts — verbs and prepositional phrases especially tend to be ignored. To work around this, the server translates the seven slot answers to English **before** assembling the image prompt. The player-facing prose stays in the room's language; only the picture prompt is translated.

- **Provider: [MyMemory](https://mymemory.translated.net).** Free, no signup, no credit card, no API key. Anonymous quota is 5000 words/day per IP. Set `MYMEMORY_EMAIL=you@example.com` in `.env` to raise the quota to 10000 words/day (the email is sent as the `de=` attribution parameter — no registration with MyMemory required).
- **No source-language auto-detect.** Each room has an explicit language; that code is passed to MyMemory directly.
- **English skips translation entirely.** The check `if (sourceLanguage === 'en') return texts;` short-circuits before any HTTP call.
- **Caching.** In-memory LRU map (2000 entries per process) so repeated answers across rounds are free.
- **Graceful degradation.** Per-slot 4 s timeout; on any failure (rate limit, network, unknown language) the original answer is used and the prompt is still well-formed.

### Local test page

A dev-only page at `http://localhost:5173/?test=image` (only available while `npm run dev` is running) renders the assembled `imagePrompt` for two hard-coded stories — one Russian, one English — without calling the Worker. A button per story generates one picture (consumes one Neuron from the daily cap). Use it to inspect translation output before burning quota on full game playthroughs.
