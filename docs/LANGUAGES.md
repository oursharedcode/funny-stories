# Languages & image-prompt translation

## Adding a new language

The project is multilingual from v1. The registry, type, i18n loaders, and filter dispatch are all data-driven, so adding another language is a small, well-bounded set of edits. To add (say) Polish:

1. **`shared/languages.ts`** — append one row to the `LANGUAGES` array (`{ code: 'pl', name: 'Polski', flag: '🇵🇱' }`). The `Language` union type is derived from this array, so this edit also widens the type — every `Record<Language, …>` site in the codebase will become a compile error until the rest of the steps are done. **Run `npm run typecheck` now and let the compiler list the remaining required edits for you.**
2. **`client/src/i18n/pl.json`** — copy `en.json`, translate every key. The `endScreen.supportServer` key must say "this server", not "the developer" — see [spec §18](./FUNNY_STORIES_SPEC_v4.md#18-things-not-to-do). The Vite glob picks it up automatically; no bootstrap edit needed.
3. **`server/src/i18n/pl.json`** — questions array + prose template + image-prompt template. **Do not port the English slot order.** Word order is language-specific (the Russian template already swaps slots 2 and 3 for natural Russian). Write the template the way a native speaker would. The server `readdirSync` picks it up automatically; no bootstrap edit needed.
4. **`server/src/filter/standins.ts`** — stand-ins for each of the 7 question indices, in the new language. English and Russian ship 10 per slot (locked from spec §6); a new language ships ~5 per slot as a machine-translated stub, marked `needs-pl-review` for later native-speaker tightening. These also serve as bot auto-fills.
5. **`server/src/i18n/index.ts`** — if your language needs morphology fixes like English's slot-5 `for` prefix or Russian's slot-1 `и` prefix, extend the `renderProse` switch. Languages without these needs touch nothing here.
6. **`server/src/filter/<code>.ts` + register it in `MATCHERS`** in `server/src/filter/index.ts` — native-language profanity matcher for the new language. This is what keeps the **player-facing prose** clean: the prose stays in the room's language and is never translated (see image-prompt translation below), so only a same-language matcher can swap profane answers for stand-ins. Native matchers currently ship for English, Russian, French, German, Mandarin (`zh`, via `bad-words-next`'s `ch` dictionary) and Spanish (`es-419` + `es-es`, one shared `es` dictionary); Indonesian, Italian, Japanese, Korean and Portuguese have none yet because `bad-words-next` ships no dictionary for them. Without a native matcher, the language falls back to the cross-language OR over the registered matchers, which only catches profanity that happens to be written in *those* languages — native-language profanity in the prose slips through. If `bad-words-next` ships a dictionary for your language, mirror `server/src/filter/ru.ts` (one import + one `check` wrapper); otherwise you need a bundled word list. The **picture** is covered separately: answers are translated to English for the image prompt, and `buildPrompt` runs an English check on the translated slots that protects the image regardless of this matcher (defense-in-depth). Recommended for any language you intend to run publicly; technically skippable for an early machine-translated stub, but the prose gap is real until it lands.

When `npm run typecheck` and `npm test` both pass, you're done. See [CONTRIBUTING.md](./CONTRIBUTING.md#translations) for the review workflow.

---

## Image-prompt translation

The image model (Flux Schnell on Cloudflare Workers AI) is anchored on an English-trained CLIP text encoder, so non-English answers in the picture prompt bind poorly to visual concepts — verbs and prepositional phrases especially tend to be ignored. To work around this, the server translates the seven slot answers to English **before** assembling the image prompt. The player-facing prose stays in the room's language; only the picture prompt is translated.

- **Provider: [MyMemory](https://mymemory.translated.net).** Free, no signup, no credit card, no API key. Anonymous quota is 5000 words/day per IP. Set `MYMEMORY_EMAIL=you@example.com` in `.env` to raise the quota to 10000 words/day (the email is sent as the `de=` attribution parameter — no registration with MyMemory required).
- **No source-language auto-detect.** Each room has an explicit language; that code is passed to MyMemory directly.
- **English skips translation entirely.** The check `if (sourceLanguage === 'en') return texts;` short-circuits before any HTTP call.
- **Caching.** In-memory LRU map (2000 entries per process) so repeated answers across rounds are free.
- **Graceful degradation.** Per-slot 4 s timeout; on any failure (rate limit, network, unknown language) the original answer is used and the prompt is still well-formed.
- **Moderation tie-in.** Because every non-English answer funnels through this English translation step before reaching the image model, `buildPrompt` runs a single English-side profanity check on the translated slots, guarding the **picture** for all 12 languages without a native matcher per language (a hit is swapped for an English stand-in, ahead of the CSAM/hard-block guards). The prose is guarded separately by the per-language answer matcher above, since the prose is never translated. See [MODERATION.md](./MODERATION.md).

### Local test page

A dev-only page at `http://localhost:5173/?test=image` (only available while `npm run dev` is running) renders the assembled `imagePrompt` for two hard-coded stories — one Russian, one English — without calling the Worker. A button per story generates one picture (consumes one Neuron from the daily cap). Use it to inspect translation output before burning quota on full game playthroughs.
