# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Three new languages: Ukrainian, Hebrew, Tamil (12 → 15).** Each ships the
  full per-language set: registry entry, client UI translation, server story
  templates with language-appropriate word order (Ukrainian mirrors the Russian
  time-before-place order; Tamil is verb-final, so the action slot closes the
  sentence), stand-in pools, a native profanity matcher (Ukrainian via the
  bundled `bad-words-next` `ua` dictionary; Hebrew and Tamil as hand-built
  conservative datasets — Tamil re-composes to NFC and matches stems through
  agglutinative suffixes), CSAM indicator terms, and a MyMemory translation
  mapping. All three are machine-translated stubs marked `needs-<code>-review`
  for native-speaker tightening. Hebrew is the first right-to-left language:
  the client now syncs the document direction to the active UI language, so
  the layout mirrors automatically when Hebrew is selected.

- **Game rules on the home screen, localised for every language.** The host and
  joiner start screens now show a short read-only "game rules" blurb next to the
  language picker, translated into all 12 supported languages and following the
  selected language live. The picker itself now uses bundled PNG flag images
  (with two-letter labels) instead of emoji flags, which don't render on Windows
  and some other devices.
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
- **Native share buttons in the room gallery.** Each download button in the
  gallery now has a "Share" button beside it that opens the device's native
  share sheet (Web Share API) with the composited still image or the 5-second
  video attached, so players can post straight to a chat app instead of
  downloading first. The buttons appear only where the browser can share files
  (mobile and Chromium-based desktop); elsewhere the download buttons stand
  alone, and a share the platform declines falls back to a download.

### Changed

- **CSAM guard now fails closed on translation failure.** Picture prompts are
  translated to English before the CSAM/profanity guards run, so a single
  English check covers every language. Previously a failed translation fell
  open: the untranslated, source-language answer reached the guard and, beyond
  EN/RU, was unscreened. Translation now retries once and, if it still fails,
  the picture is refused (`buildPrompt` → `translationFailed` →
  `generateStoryPicture` blocks) rather than sent unscreened. See
  [docs/MODERATION.md](docs/MODERATION.md).
- **Home-screen rules box and language picker polish.** The "game rules" box and
  the language list now keep their scrollbar visible at all times instead of only
  while scrolling — which on mobile hid that they scroll — and the rules box
  gains a centred "Game rules" heading, localised in every language.
- **Gallery video button relabelled "Download 5s video".** The button always
  downloaded the clip; the label now says so, leaving the adjacent Share button
  as the one that actually shares.

### Fixed

- **Home-screen scrollbars now show on mobile.** The always-visible scrollbars on
  the rules box and language picker relied on native scrollbar styling that
  Android (Samsung Internet, Chrome) and iOS ignore, so they stayed hidden there;
  they are now drawn as a custom thumb that renders on every browser.

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
