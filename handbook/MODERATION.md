# Content moderation and operator responsibility

Funny Stories generates user-prompted AI images. **The operator of a deployed instance — not the upstream author — is responsible for the content their players generate**, in keeping with the AGPL self-hosting model and the in-game source footer that points back to this repo. Run a public instance only if you are willing to take that responsibility for your players' answers and the resulting cartoons.

## What ships by default

These layers are on in every build and require no configuration:

- **Profanity filter** (`server/src/filter/`) — English (`obscenity`) + Russian (`bad-words-next` plus a bundled word list). Matched answers are silently replaced with stand-ins; players are not told. See [spec §6](../docs/FUNNY_STORIES_SPEC_v4.md#6-profanity-filter-serversrcfilter).
- **CSAM-pattern guard** (`server/src/filter/csam.ts`) — a combinatorial heuristic on the assembled image prompt. Refuses generation when both a minor-indicator and a sexual-indicator co-occur. Runs before the daily-cap reservation, so blocked prompts cost nothing.
- **Hard-block list** (`server/src/filter/hardBlocks.ts`) — a short list of unambiguous terms with no party-game use (sexual-violence verbs, child-sexual-abuse standalone terms, bestiality, targeted-violence verbs). Single-hit blocks generation.
- **Style suffix** (`server/src/prompt.ts`) — locks every cartoon to a goofy hand-drawn look. Steers Flux Schnell away from photorealism and away from drawings that could be confused with photos of real people.
- **In-game source footer** (`client/src/components/SourceFooter.tsx`) — on the Home and End screens, a small notice that player answers and AI pictures are the responsibility of the *operator* of this server, not of the upstream project.

## What you, the operator, are responsible for

The defaults above are good-faith hygiene, not a moderation product. They will miss obfuscated prompts and produce occasional false positives. If you run a public instance, you should at minimum:

- **Decide whether you need additional layers.** Cloudflare offers [AI Gateway](https://developers.cloudflare.com/ai-gateway/) with classifier-based moderation, and Workers AI itself ships some safety filtering; both are worth turning on for a public deployment. Post-generation image classifiers (e.g. NSFW detection) are a sensible next step if your audience is broader than a friend group.
- **Know your jurisdiction.** AI-generated content rules (EU AI Act, US state laws, RU 149-FZ, etc.) attach to whoever *operates* the service — that's you, not the upstream repo. The CSAM exception is absolute everywhere; the defaults block the obvious cases but jurisdictional reporting obligations are entirely yours.
- **Set `DEPLOYER_DONATE_URL` correctly or leave it unset.** End-user donations going through your operator donate link are donations to *you*, not to the upstream — by design (see [spec §18, §20](../docs/FUNNY_STORIES_SPEC_v4.md#18-things-not-to-do)).

## Known visual artefacts

Flux Schnell occasionally renders **nonsense hand-lettered marks** in the corners of generated cartoons — squiggles that look like a painter's signature but are not. Diffusion models trained on signed paintings hallucinate signature-shaped glyphs they have no way of forming correctly; what appears is random letterforms, not the signature of any real artist or any copyrighted mark.

This is a **known and accepted artefact** as of v0.1.0 (see [spec §22](../docs/FUNNY_STORIES_SPEC_v4.md#22-style-suffix-lock) and [`BUGS_AND_IMPROVEMENTS_02.md`](../docs/BUGS_AND_IMPROVEMENTS_02.md) item 1). Mitigations are tracked in the backlog but deliberately not enabled in v1 — players generally laugh at the squiggle rather than complain. The naive fix ("no text" in the style suffix) was tried in earlier versions and rolled back because CLIP-conditioned models reinforce naming.

**Intellectual-property position.** The hallucinated signature-shaped marks are not a learned reproduction of any real artist's signature, are not associated with any specific real artist, and are not intended as an impersonation or a copyrighted mark. They do not by themselves create an IP conflict distinct from the broader generative-AI questions every operator of an image-generation product already navigates. The operator/deployer remains responsible for the deployed content as a whole — see above and the in-game source footer ([spec §27](../docs/FUNNY_STORIES_SPEC_v4.md)).
