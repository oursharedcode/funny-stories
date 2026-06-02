# Development

## Quick start (local dev)

Requires **Node 20+** and **npm**.

```bash
git clone https://github.com/oursharedcode/funny-stories.git
cd funny-stories
npm install
cp .env.example .env       # edit the two Cloudflare Worker vars (see DEPLOYMENT.md)
npm run dev
```

Open two browser tabs at `http://localhost:5173`. Create a room in one, join from the other, play.

> **Image generation requires a deployed Cloudflare Worker.** The game otherwise runs locally without one, but `Generate picture` will fail. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the 5-minute setup. The Worker is on Cloudflare's free tier — ~15–30 images/day before the AI neuron budget caps out.

## Toolchain

| Tool | Choice | Notes |
|---|---|---|
| Package manager | **npm** | Workspaces: `client`, `server`, `shared`. `cloudflare/` is separate (own deploy). |
| Test runner | **Vitest** | One config per workspace; root script runs all. |
| Lint | **ESLint** + `@typescript-eslint` (strict) | Same config across workspaces. |
| Format | **Prettier** (default config, 100-char line width) | `npm run format` from root. |
| Type checker | **`tsc --noEmit`** | Per-workspace `tsconfig.json` extending `tsconfig.base.json`. |
| CI | **GitHub Actions** | One workflow: typecheck + lint + test on push and PR. No deploy automation in v1. |

## npm scripts (root)

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

## Project layout

See [`FUNNY_STORIES_SPEC_v4.md` §3](./FUNNY_STORIES_SPEC_v4.md) for the canonical file tree. Short version:

- `client/` — React + Vite PWA.
- `server/` — Fastify + Socket.IO + in-memory room state. No DB, no Redis.
- `shared/` — socket event payload types, used by both.
- `cloudflare/` — Workers AI image-generation worker, deployed separately.

## Tests of note

- `server/src/game.test.ts` — exhaustive coverage of the rotation formula `storyIndex(P, R, N) = (P - R + N) mod N` from spec §4. **Written before the UI** in build step 4.
- `server/src/filter/index.test.ts` — profanity filter normalisation, English matches, Russian matches, stand-in selection.
- `server/src/prompt.test.ts` — prompt builder length cap, style suffix integrity, mixed-language answer handling.

## What this project is not

- Not a database project. **Don't add an ORM, a DB driver, or Redis.** See spec §18.
- Not a reconnect project. **Disconnect = bot.** This is a feature, not a limitation.
- Not a translation project. **Don't auto-translate player answers** — they go verbatim into the AI prompt. The room's prose template *structure* differs between languages; never port one to the other slot-for-slot.

## Documentation hierarchy

- **[`docs/FUNNY_STORIES_SPEC_v4.md`](./FUNNY_STORIES_SPEC_v4.md)** — what the app does (binding).
- **[`docs/DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)** — how it looks and moves.
- **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — how to work on it.

## Known limitations

- **One server process per deployment.** Room state is in-memory. If you need to run multiple instances, you need Redis pub/sub first — not in v1.
- **No reconnect.** Disconnect = bot for the rest of the game. Intentional.
- **No persistence.** When the process restarts, all rooms end. Intentional. There is nothing to back up.
- **Cloudflare free tier caps image generation.** Roughly 15–30 images/day per Worker. Adequate for personal use and small friend groups.
- **Accessibility is partial.** Focus rings, contrast, and reduced-motion are honoured. Screen-reader narration of game state and keyboard-only flow are not implemented. See [`DESIGN_SYSTEM.md` §8](./DESIGN_SYSTEM.md).
- **Mobile portrait only.** Tablets and desktops work but get the phone layout, centred.
