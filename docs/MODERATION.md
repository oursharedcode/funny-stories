# Content moderation and operator responsibility

Funny Stories generates user-prompted AI images. **The operator of a deployed instance — not the upstream author — is responsible for the content their players generate**, in keeping with the AGPL self-hosting model and the in-game source footer that points back to this repo. Run a public instance only if you are willing to take that responsibility for your players' answers and the resulting cartoons.

## What ships by default

These layers are on in every build and require no configuration:

- **Profanity filter** (`server/src/filter/`) — runs on every submitted answer in the room's language before it is stored; a hit is silently replaced with a same-language stand-in (players are not told). Native matchers ship for English (`obscenity`) and, via `bad-words-next` dictionaries, Russian, French, German, Mandarin Chinese (the library's `ch` dictionary), and Spanish (one `es` dictionary serving both `es-419` and `es-es`) — 7 of the 12 language codes. Stand-in pools exist for all 12 languages. Because the final story prose stays in the room's language and is **never translated**, a same-language matcher is the only thing that can clean the prose — the remaining languages (Indonesian, Italian, Japanese, Korean, Portuguese), for which `bad-words-next` ships no dictionary, fall back to the cross-language OR over every registered matcher and are a known prose-coverage gap until a native word list is added. The picture prompt is covered by a second layer: it is translated to English before generation ([LANGUAGES.md](./LANGUAGES.md#image-prompt-translation)), and `buildPrompt` then runs an English check (`obscenity`) on the translated slots — a hit is swapped for an English stand-in before the prompt reaches the image model. This catches profanity from any source language regardless of native-matcher coverage (defense-in-depth), and runs ahead of the CSAM/hard-block guards. See [spec §6](./FUNNY_STORIES_SPEC_v4.md#6-profanity-filter-serversrcfilter).
- **CSAM-pattern guard** (`server/src/filter/csam.ts`) — a combinatorial heuristic on the assembled image prompt. Refuses generation when both a minor-indicator and a sexual-indicator co-occur. Runs before the daily-cap reservation, so blocked prompts cost nothing.
- **Hard-block list** (`server/src/filter/hardBlocks.ts`) — a short list of unambiguous terms with no party-game use (sexual-violence verbs, child-sexual-abuse standalone terms, bestiality, targeted-violence verbs). Single-hit blocks generation.
- **Style suffix** (`server/src/prompt.ts`) — locks every cartoon to a goofy hand-drawn look. Steers Flux Schnell away from photorealism and away from drawings that could be confused with photos of real people.
- **In-game source footer** (`client/src/components/SourceFooter.tsx`) — on the Home and End screens, a small notice that player answers and AI pictures are the responsibility of the *operator* of this server, not of the upstream project.

## What you, the operator, are responsible for

The defaults above are good-faith hygiene, not a moderation product. They will miss obfuscated prompts and produce occasional false positives. If you run a public instance, you should at minimum:

- **Decide whether you need additional layers.** Cloudflare offers [AI Gateway](https://developers.cloudflare.com/ai-gateway/) with classifier-based moderation, and Workers AI itself ships some safety filtering; both are worth turning on for a public deployment. Post-generation image classifiers (e.g. NSFW detection) are a sensible next step if your audience is broader than a friend group.
- **Know your jurisdiction.** AI-generated content rules (EU AI Act, US state laws, RU 149-FZ, etc.) attach to whoever *operates* the service — that's you, not the upstream repo. The CSAM exception is absolute everywhere; the defaults block the obvious cases but jurisdictional reporting obligations are entirely yours.
- **Set `DEPLOYER_DONATE_URL` correctly or leave it unset.** End-user donations going through your operator donate link are donations to *you*, not to the upstream — by design (see [spec §18, §20](./FUNNY_STORIES_SPEC_v4.md#18-things-not-to-do)).

## Known visual artefacts

Flux Schnell occasionally renders **nonsense hand-lettered marks** in the corners of generated cartoons — squiggles that look like a painter's signature but are not. Diffusion models trained on signed paintings hallucinate signature-shaped glyphs they have no way of forming correctly; what appears is random letterforms, not the signature of any real artist or any copyrighted mark.

This is a **known and accepted artefact** as of v0.1.0 (see [spec §22](./FUNNY_STORIES_SPEC_v4.md#22-style-suffix-lock)). Mitigations are tracked in the backlog but deliberately not enabled in v1 — players generally laugh at the squiggle rather than complain. The naive fix ("no text" in the style suffix) was tried in earlier versions and rolled back because CLIP-conditioned models reinforce naming.

**Intellectual-property position.** The hallucinated signature-shaped marks are not a learned reproduction of any real artist's signature, are not associated with any specific real artist, and are not intended as an impersonation or a copyrighted mark. They do not by themselves create an IP conflict distinct from the broader generative-AI questions every operator of an image-generation product already navigates. The operator/deployer remains responsible for the deployed content as a whole — see above and the in-game source footer ([spec §27](./FUNNY_STORIES_SPEC_v4.md)).
