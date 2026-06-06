# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.0]: https://github.com/oursharedcode/funny-stories/releases/tag/v0.1.0
