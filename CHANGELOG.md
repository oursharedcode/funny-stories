# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Native profanity matchers for all 12 languages.** Italian, Indonesian,
  Japanese, Korean, and Portuguese previously had no native prose matcher
  (`bad-words-next` ships no dictionary for them), so own-language profanity in
  the final story prose was only caught if it happened to match another
  language's dictionary. Each now has a conservative starter-stub dataset fed to
  `bad-words-next` (JA/KO re-compose to NFC so the upstream NFKD normalisation
  doesn't break kana/Hangul matching). Stubs are marked `needs-<code>-review`
  for native-speaker tightening.
- **CSAM indicator lists for all 12 languages.** The combinatorial CSAM guard
  previously carried minor-/sexual-indicator terms only in EN and RU; it now
  has conservative per-language lists for FR, DE, ES, IT, PT, ID, ZH, JA, and
  KO as well. This backs up the translate-then-check path for text the
  translator passes through untranslated or mixed-language input.

### Changed

- **CSAM guard now fails closed on translation failure.** Picture prompts are
  translated to English before the CSAM/profanity guards run, so a single
  English check covers every language. Previously a failed translation fell
  open: the untranslated, source-language answer reached the guard and, beyond
  EN/RU, was unscreened. Translation now retries once and, if it still fails,
  the picture is refused (`buildPrompt` → `translationFailed` →
  `generateStoryPicture` blocks) rather than sent unscreened. See
  [docs/MODERATION.md](docs/MODERATION.md).

## [0.1.0] - 2026-06-06

First public release of **Funny Stories** — a party game where 3–7 friends, on
their phones, each answer 7 silly questions about a shared story they can't see,
then watch an AI cartoon (plus a short video) of the result. No accounts, no
database, no analytics, and self-hostable for free on Cloudflare Workers AI.

### Added

- **Core gameplay.** Create a room, share a 6-character code or QR, and play
  seven rotating rounds (*Who? And who else? Where? When? What did they do? What
  for? What happened in the end?*) so no player sees the others' answers in their
  own story.
- **AI reveal.** Each finished story is turned into a goofy AI cartoon and a
  short video via Cloudflare Workers AI image generation.
- **Multilingual support** from day one, including Chinese (Mandarin), with
  translated image-prompt handling and multilingual profanity matchers.
- **Self-hosting paths.** One-click deploy buttons for the Cloudflare image
  Worker and the Render game server, plus a single-stage `Dockerfile` and
  `docker-compose.yml` for container hosting.
- **Privacy by design.** No accounts, no database, no telemetry; a shared
  `WORKER_SECRET` gates the image Worker.
- **Project hygiene.** AGPL-3.0 license, CI workflow (typecheck, lint, test),
  and `README`, `CODE_OF_CONDUCT`, `SECURITY`, and `docs/` documentation.

### Changed

- Aligned all workspace versions (`root`, `client`, `server`, `shared`,
  `cloudflare`) to `0.1.0`.

[Unreleased]: https://github.com/oursharedcode/funny-stories/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/oursharedcode/funny-stories/releases/tag/v0.1.0
