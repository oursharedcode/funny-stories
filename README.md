# Funny Stories

A party game where 3–7 friends, on their phones, answer 7 silly questions about a shared story they can't see — then watch an AI cartoon goof of the result. Two languages, English and Russian, from day one. No accounts, no database, no analytics. Self-hostable for free on Render or your own Docker host.

[![Build](https://img.shields.io/github/actions/workflow/status/oursharedcode/funny-stories/ci.yml?branch=master)](https://github.com/oursharedcode/funny-stories/actions)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](./LICENSE)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/oursharedcode?label=sponsor)](https://github.com/sponsors/oursharedcode)
[![Stars](https://img.shields.io/github/stars/oursharedcode/funny-stories?style=social)](https://github.com/oursharedcode/funny-stories/stargazers)

> **Support the project:** if Funny Stories made a road trip survivable, consider [sponsoring on GitHub](https://github.com/sponsors/oursharedcode). This is the only donation channel for the upstream author. *Operators running their own deployment* can optionally show a "Support this server" button to their players — see [Deployment](#deployment).

---

## What it looks like

![Funny Stories — round screen on a phone](./docs/screenshots/round.png)
![Funny Stories — reveal screen with cartoon](./docs/screenshots/reveal.png)

*(Screenshots added in build step 14. Until then, this section is a placeholder.)*

---

## How it plays

1. One person taps **Create room**, picks English or Russian, gets a 6-character code and a QR.
2. Friends scan the QR or paste the link, pick a nickname, land in the lobby.
3. Host taps **Start**. Everyone gets one of seven questions: *Who? With whom? Where? When? What did they do? What for? What was at the end?*
4. After each round the story rotates. You never see other answers in your story.
5. After seven rounds, your phone shows the story you contributed to as prose. Tap **Generate picture**. A goofy cartoon arrives.
6. Host can start one more game with the same friends, or end on a picture of monkeys on a bus.

If someone disconnects mid-game, the game continues — they become a bot, the round timer auto-fills their answers from a list of pre-baked stand-ins. No reconnect, no abandoned rooms.

---

## Quick start (local dev)

Requires **Node 20+** and **npm**.

```bash
git clone https://github.com/oursharedcode/funny-stories.git
cd funny-stories
npm install
cp .env.example .env       # edit the two Cloudflare Worker vars (see below)
npm run dev
```

Open two browser tabs at `http://localhost:5173`. Create a room in one, join from the other, play.

> **Image generation requires a deployed Cloudflare Worker.** The game otherwise runs locally without one, but `Generate picture` will fail. See [Deploying the Cloudflare Worker](#deploying-the-cloudflare-worker) for the 5-minute setup. The Worker is on Cloudflare's free tier — ~15–30 images/day before the AI neuron budget caps out.

---

## Development

### Toolchain

| Tool | Choice | Notes |
|---|---|---|
| Package manager | **npm** | Workspaces: `client`, `server`, `shared`. `cloudflare/` is separate (own deploy). |
| Test runner | **Vitest** | One config per workspace; root script runs all. |
| Lint | **ESLint** + `@typescript-eslint` (strict) | Same config across workspaces. |
| Format | **Prettier** (default config, 100-char line width) | `npm run format` from root. |
| Type checker | **`tsc --noEmit`** | Per-workspace `tsconfig.json` extending `tsconfig.base.json`. |
| CI | **GitHub Actions** | One workflow: typecheck + lint + test on push and PR. No deploy automation in v1. |

### npm scripts (root)

```bash
npm run dev          # vite dev server + tsx watch on server, in parallel
npm run build        # client → client/dist, server → server/dist
npm run start        # production: node server/dist/index.js
npm run test         # vitest run, all workspaces
npm run test:watch   # vitest, all workspaces
npm run lint         # eslint, all workspaces
npm run format       # prettier --write
npm run typecheck    # tsc --noEmit, all workspaces
```

### Project layout

See [`FUNNY_STORIES_SPEC_v4.md` §3](./docs/FUNNY_STORIES_SPEC_v4.md) for the canonical file tree. Short version:

- `client/` — React + Vite PWA.
- `server/` — Fastify + Socket.IO + in-memory room state. No DB, no Redis.
- `shared/` — socket event payload types, used by both.
- `cloudflare/` — Workers AI image-generation worker, deployed separately.

### Tests of note

- `server/src/game.test.ts` — exhaustive coverage of the rotation formula `storyIndex(P, R, N) = (P - R + N) mod N` from spec §4. **Written before the UI** in build step 4.
- `server/src/filter/index.test.ts` — profanity filter normalisation, English matches, Russian matches, stand-in selection.
- `server/src/prompt.test.ts` — prompt builder length cap, style suffix integrity, mixed-language answer handling.

### What this project is not

- Not a database project. **Don't add an ORM, a DB driver, or Redis.** See spec §18.
- Not a reconnect project. **Disconnect = bot.** This is a feature, not a limitation.
- Not a translation project. **Don't auto-translate player answers** — they go verbatim into the AI prompt. The room's prose template *structure* differs between EN and RU; never port one to the other slot-for-slot.

Documentation hierarchy:
- **[`docs/FUNNY_STORIES_SPEC_v4.md`](./docs/FUNNY_STORIES_SPEC_v4.md)** — what the app does (binding).
- **[`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md)** — how it looks and moves.
- **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — how to work on it.
- **This README** — how to run and deploy it.

---

## Deployment

Two supported paths. Pick one. Both need the Cloudflare Worker for image generation.

### Option A — Render (recommended for a hosted instance)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/oursharedcode/funny-stories)

1. Click the button above, or push this repo to your own Render account.
2. In the Render dashboard, set the following environment variables on the service:

   | Variable | Required | Description |
   |---|---|---|
   | `CLOUDFLARE_WORKER_URL` | yes | `https://funny-stories-image.<your-account>.workers.dev`, from [the Worker step below](#deploying-the-cloudflare-worker). |
   | `CLOUDFLARE_WORKER_SECRET` | yes | The same secret you set on the Worker (`wrangler secret put WORKER_SECRET`). |
   | `DEPLOYER_DONATE_URL` | no | If set, the end screen shows a small **Support this server** button linking here. **Donations go to *you*, the operator** — not to the upstream author. Leave unset for no button. |
   | `MAX_ROOMS` | no | Concurrent room ceiling. Default 500. Safe to leave unset on the free plan. |
   | `MAX_IMAGES_PER_DAY` | no | Daily Cloudflare AI image ceiling per process (resets 00:00 UTC). Default 25. |
   | `NODE_VERSION` | yes | `20` (already in `render.yaml`). |
   | `NODE_ENV` | yes | `production` (already in `render.yaml`). |

3. Render auto-builds on push to `main`. First deploy takes ~3 minutes.
4. Visit your `.onrender.com` URL on a real phone and run the [acceptance test](./docs/FUNNY_STORIES_SPEC_v4.md#19-acceptance-test).

**Known limitations on the Render free plan:** single instance, ~512 MB RAM, no horizontal scaling. The game is deliberately built for this — room state is in-memory, so adding instances breaks rooms across them. If you outgrow one instance, the right next step is Redis pub/sub, not load balancers; see [spec §18](./docs/FUNNY_STORIES_SPEC_v4.md). The free plan also spins the service down after a stretch of inactivity, so the first visit after an idle period waits a few seconds for a cold start — and because rooms are in-memory, a spin-down ends any rooms that were still open. The host's *"Images today"* counter ([spec §26](./docs/FUNNY_STORIES_SPEC_v4.md)) is also in-memory and resets on every spin-down; persistence across cold starts would need Cloudflare KV (not implemented in v1).

### Option B — Docker (self-hosted)

For people running their own VPS, homelab, or Kubernetes. The image is small and stateless.

```bash
# Build
docker build -t funny-stories:latest .

# Run
docker run -d \
  --name funny-stories \
  -p 3000:3000 \
  -e CLOUDFLARE_WORKER_URL="https://funny-stories-image.<your-account>.workers.dev" \
  -e CLOUDFLARE_WORKER_SECRET="<the secret>" \
  -e DEPLOYER_DONATE_URL="" \
  -e MAX_ROOMS="500" \
  -e NODE_ENV="production" \
  funny-stories:latest
```

Or with Docker Compose — `docker-compose.yml` is checked in at the repo root:

```bash
cp .env.example .env   # fill in CLOUDFLARE_WORKER_URL and CLOUDFLARE_WORKER_SECRET
docker compose up -d
```

**Reverse-proxy notes.**

- Terminate TLS at your proxy (Caddy, nginx, Traefik). The container listens HTTP on port 3000.
- WebSockets must pass through. For nginx: `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`. For Caddy: `reverse_proxy` already handles this. For Traefik: ensure your router accepts the `Upgrade: websocket` header.
- The rate limiter reads `x-forwarded-for`. Make sure your proxy sets it correctly, or operators behind multiple hops will all share one bucket.

**No volumes needed.** The game writes nothing to disk. The container can be killed and restarted at any time; in-flight games will end (their players become bots, as expected by design).

### Deploying the Cloudflare Worker

The Worker handles AI image generation. It's separate from the Node service and stays on Cloudflare's free tier.

```bash
npm install -g wrangler
wrangler login
cd cloudflare
wrangler deploy
wrangler secret put WORKER_SECRET   # paste a strong random string
```

Note the deployed URL (`https://funny-stories-image.<your-account>.workers.dev`). Set:

- The Worker's `WORKER_SECRET` (above)
- The Node service's `CLOUDFLARE_WORKER_URL` and `CLOUDFLARE_WORKER_SECRET` (same secret value, both sides)

If the secrets don't match, the Worker returns 403 and `Generate picture` shows a friendly error on every phone. That's the right behaviour — it's what protects the free-tier neuron budget from public scraping.

### Accepting donations from *your* players

If you run a public instance and want a small "Support this server" button on the end screen, set `DEPLOYER_DONATE_URL` to your own donation page (Buy Me a Coffee, Ko-fi, GitHub Sponsors, Patreon, YuMoney, anything). The button only appears when this variable is set. **Donations go to you, the operator, not to the upstream author** — this is by design and is a [structural property of the AGPL distribution path](./docs/FUNNY_STORIES_SPEC_v4.md#18-things-not-to-do). The upstream author is supported only through the [GitHub Sponsors link at the top of this README](#funny-stories).

---

## Adding a new language

Currently English and Russian ship in v1. The registry, type, i18n loaders, and filter dispatch are all data-driven, so adding a third language is a small, well-bounded set of edits. To add (say) German:

1. **`shared/languages.ts`** — append one row to the `LANGUAGES` array (`{ code: 'de', name: 'Deutsch', flag: '🇩🇪' }`). The `Language` union type is derived from this array, so this edit also widens the type — every `Record<Language, …>` site in the codebase will become a compile error until the rest of the steps are done. **Run `npm run typecheck` now and let the compiler list the remaining required edits for you.**
2. **`client/src/i18n/de.json`** — copy `en.json`, translate every key. The `endScreen.supportServer` key must say "this server", not "the developer" — see [spec §18](./docs/FUNNY_STORIES_SPEC_v4.md#18-things-not-to-do). The Vite glob picks it up automatically; no bootstrap edit needed.
3. **`server/src/i18n/de.json`** — questions array + prose template + image-prompt template. **Do not port the English slot order.** Word order is language-specific (the Russian template already swaps slots 2 and 3 for natural Russian). Write the template the way a native speaker would. The server `readdirSync` picks it up automatically; no bootstrap edit needed.
4. **`server/src/filter/standins.ts`** — 10 stand-ins for each of the 7 question indices, in the new language. These also serve as bot auto-fills.
5. **`server/src/i18n/index.ts`** — if your language needs morphology fixes like English's slot-5 `for` prefix or Russian's slot-1 `и` prefix, extend the `renderProse` switch. Languages without these needs touch nothing here.
6. **(Optional) `server/src/filter/<code>.ts` + register it in `MATCHERS`** in `server/src/filter/index.ts` — native-language profanity matcher. Without it, the OR-all semantic still catches English and Russian profanity in mixed-language answers, so it's safe to skip until a native-speaker review.

When `npm run typecheck` and `npm test` both pass, you're done. See [CONTRIBUTING.md](./CONTRIBUTING.md#translations) for the review workflow.

---

## Stamping your logo on pictures

To brand the cartoons your instance generates, replace
`client/public/deployer-logo.png` with your own **25×25 pixel PNG** and
rebuild. It appears as a small (25×25) semi-transparent stamp in the
bottom-right corner of every generated picture — on the reveal screen
and in the room gallery.

The bundled default is a 25×25 downscale of the app icon, so a fresh
deployment already carries a small visible stamp out of the box. If you
want **no stamp at all**, either delete `client/public/deployer-logo.png`
or replace it with a 25×25 fully transparent PNG.

The stamp is rendered at native 25×25 pixels (no CSS upscaling), so your
pixel-level branding survives intact. The size is locked at 25×25 — a
larger source PNG will be downscaled by the browser. If you want a
different size, change both `client/public/deployer-logo.png` and the
`width`/`height` attributes in
[`client/src/components/LogoStamp.tsx`](./client/src/components/LogoStamp.tsx)
in lockstep.

The stamp is a display overlay; it is not baked into the image pixels.

---

## Content moderation and operator responsibility

Funny Stories generates user-prompted AI images. **The operator of a deployed
instance — not the upstream author — is responsible for the content their
players generate**, in keeping with the AGPL self-hosting model and the
in-game source footer that points back to this repo. Run a public instance
only if you are willing to take that responsibility for your players' answers
and the resulting cartoons.

### What ships by default

These layers are on in every build and require no configuration:

- **Profanity filter** (`server/src/filter/`) — English (`obscenity`) +
  Russian (`bad-words-next` plus a bundled word list). Matched answers are
  silently replaced with stand-ins; players are not told. See
  [spec §6](./docs/FUNNY_STORIES_SPEC_v4.md#6-profanity-filter-serversrcfilter).
- **CSAM-pattern guard** (`server/src/filter/csam.ts`) — a combinatorial
  heuristic on the assembled image prompt. Refuses generation when both a
  minor-indicator and a sexual-indicator co-occur. Runs before the
  daily-cap reservation, so blocked prompts cost nothing.
- **Hard-block list** (`server/src/filter/hardBlocks.ts`) — a short list
  of unambiguous terms with no party-game use (sexual-violence verbs,
  child-sexual-abuse standalone terms, bestiality, targeted-violence
  verbs). Single-hit blocks generation.
- **Style suffix** (`server/src/prompt.ts`) — locks every cartoon to a
  goofy hand-drawn look. Steers Flux Schnell away from photorealism and
  away from drawings that could be confused with photos of real people.
- **In-game source footer** (`client/src/components/SourceFooter.tsx`) —
  on the Home and End screens, a small notice that player answers and AI
  pictures are the responsibility of the *operator* of this server, not
  of the upstream project.

### What you, the operator, are responsible for

The defaults above are good-faith hygiene, not a moderation product. They
will miss obfuscated prompts and produce occasional false positives. If you
run a public instance, you should at minimum:

- **Decide whether you need additional layers.** Cloudflare offers
  [AI Gateway](https://developers.cloudflare.com/ai-gateway/) with
  classifier-based moderation, and Workers AI itself ships some safety
  filtering; both are worth turning on for a public deployment.
  Post-generation image classifiers (e.g. NSFW detection) are a sensible
  next step if your audience is broader than a friend group.
- **Know your jurisdiction.** AI-generated content rules (EU AI Act, US
  state laws, RU 149-FZ, etc.) attach to whoever *operates* the service —
  that's you, not the upstream repo. The CSAM exception is absolute
  everywhere; the defaults block the obvious cases but jurisdictional
  reporting obligations are entirely yours.
- **Set `DEPLOYER_DONATE_URL` correctly or leave it unset.** End-user
  donations going through your operator donate link are donations to
  *you*, not to the upstream — by design (see
  [spec §18, §20](./docs/FUNNY_STORIES_SPEC_v4.md#18-things-not-to-do)).

### If you fork or rebrand this repo

The in-game footer points at this upstream repo by default. If you ship a
substantively modified fork, change the constant in
[`client/src/sourceUrl.ts`](./client/src/sourceUrl.ts) so your players land
on your fork instead — AGPL §13 expects the *running* deployment's source
to be reachable from the running deployment, not the unmodified upstream.

### A note on README screenshots

If you build your own README around a fork: **do not put real political
figures, real children, or real celebrities into your gallery
screenshots**. They become the GitHub social-card preview and the
Twitter/Mastodon link card whether you want them to or not. The
upstream README follows the same rule and you should too.

### Known visual artefacts

Flux Schnell occasionally renders **nonsense hand-lettered marks** in the
corners of generated cartoons — squiggles that look like a painter's
signature but are not. Diffusion models trained on signed paintings
hallucinate signature-shaped glyphs they have no way of forming
correctly; what appears is random letterforms, not the signature of any
real artist or any copyrighted mark.

This is a **known and accepted artefact** as of v0.1.0 (see
[spec §22](./docs/FUNNY_STORIES_SPEC_v4.md#22-style-suffix-lock) and
[`BUGS_AND_IMPROVEMENTS_02.md`](./docs/BUGS_AND_IMPROVEMENTS_02.md) item
1). Mitigations are tracked in the backlog but deliberately not enabled
in v1 — players generally laugh at the squiggle rather than complain.
The naive fix ("no text" in the style suffix) was tried in earlier
versions and rolled back because CLIP-conditioned models reinforce
naming.

**Intellectual-property position.** The hallucinated signature-shaped
marks are not a learned reproduction of any real artist's signature,
are not associated with any specific real artist, and are not intended
as an impersonation or a copyrighted mark. They do not by themselves
create an IP conflict distinct from the broader generative-AI questions
every operator of an image-generation product already navigates. The
operator/deployer remains responsible for the deployed content as a
whole — see the section above and the in-game source footer
([spec §27](./docs/FUNNY_STORIES_SPEC_v4.md)).

---

## Known limitations

- **One server process per deployment.** Room state is in-memory. If you need to run multiple instances, you need Redis pub/sub first — not in v1.
- **No reconnect.** Disconnect = bot for the rest of the game. Intentional.
- **No persistence.** When the process restarts, all rooms end. Intentional. There is nothing to back up.
- **Cloudflare free tier caps image generation.** Roughly 15–30 images/day per Worker. Adequate for personal use and small friend groups.
- **Accessibility is partial.** Focus rings, contrast, and reduced-motion are honoured. Screen-reader narration of game state and keyboard-only flow are not implemented. See [`DESIGN_SYSTEM.md` §8](./docs/DESIGN_SYSTEM.md).
- **Mobile portrait only.** Tablets and desktops work but get the phone layout, centered.

---

## License

[AGPL-3.0](./LICENSE). If you deploy a modified version on a network service, you must offer the source of your modifications to the users of that service. This is the point of the license — the project is small enough that the only way to keep it honest is to keep it open.

If you want to use the code under different terms, open an issue and we can talk.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Short version: tests pass, lint clean, one feature per PR, Russian strings get the `needs-ru-review` label.
