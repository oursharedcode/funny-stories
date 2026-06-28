# Decision journal (Журнал решений)

Every project is a chain of forks, and what's interesting is less the result than
*which way the author turned and what they paid for it*. This file records the
foundational forks of **Funny Stories** in one place, each in the same shape:

- **Context** — what the choice was between.
- **Decision** — which way it went.
- **Trade-off** — what that cost, accepted on purpose.
- **Status** — and where the detail lives.

This is an architecture-decision record, not a changelog. The
[CHANGELOG](../CHANGELOG.md) answers *"what changed in this release?"*; this file
answers *"why is the design this way, and what did it cost?"* A decision that is
later reversed stays here with its status updated, so the reasoning isn't lost.
The public narration of these forks is the Habr article "Девять развилок проекта"
— this file is its canonical source.

> **Companion documents.** [`FUNNY_STORIES_SPEC_v4.md`](./FUNNY_STORIES_SPEC_v4.md)
> (binding build spec — wins on any conflict), [`MODERATION.md`](./MODERATION.md),
> [`LANGUAGES.md`](./LANGUAGES.md), [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md),
> [`DEPLOYMENT.md`](./DEPLOYMENT.md).

---

## Fork 0 — Two years, or one month?

- **Context.** Learn TypeScript, React, Socket.IO, Node, and Fastify the long
  way, or build the game with an AI coding assistant.
- **Decision.** VS Code with Claude Code. The skills are learned on the way out,
  not as a prerequisite.
- **Trade-off.** A monthly subscription, and the standing "just another AI game"
  scepticism. Accepted: the alternative was the game not existing.
- **Status.** Shipped. Foundational; not revisited.

## Fork 1 — Database, or memory?

- **Context.** Store room state in a database or in process memory.
- **Decision.** An in-memory `Map` (`server/src/rooms.ts`). No database, no
  driver, no migrations.
- **Trade-off.** A room does not survive a server restart. Accepted: starting a
  fresh room takes ~10 seconds, a whole game lives for minutes, and there is
  nothing worth persisting — in exchange for zero migrations and zero drivers.
- **Status.** Shipped. See [spec §7 (room lifecycle)](./FUNNY_STORIES_SPEC_v4.md).

## Fork 2 — Reconnect, or bot?

- **Context.** Restore a dropped player's connection, or replace them with a bot.
- **Decision.** Bot, no app-level reconnect. Socket.IO's built-in
  connection-state recovery covers a short blip (`RECOVERY_WINDOW_MS = 60_000` in
  `server/src/index.ts`): background the phone for ~60 seconds and you return.
  Gone longer and a bot takes your slot — it even keeps generating its picture.
- **Trade-off.** A player who drops for good (dead battery) cannot rejoin *that*
  room. Accepted: the rotation stays intact. Removing a player from the array
  would break the rotation formula `storyIndex(P, R, N) = (P - R + N) mod N`
  (`server/src/game.ts`); a bot holds the slot so the formula keeps working. On
  botification the host role is promoted to the first human, and an all-bot room
  is deleted immediately.
- **Status.** Shipped. See [spec §7](./FUNNY_STORIES_SPEC_v4.md) and `removePlayer`.

```ts
// Returns the room the player was in (with mutations applied) or null when
// they weren't in any room.
export function removePlayer(socketId: string): RemoveResult | null {
  // …
  // Host promotion if host botified.
  if (room.hostId === socketId) {
    const next = room.players.find((p) => !p.isBot);
    if (next) room.hostId = next.id;
  }
  // All-bots room: delete immediately (spec §7).
  if (room.players.every((p) => p.isBot)) {
    if (room.roundTimer) clearTimeout(room.roundTimer as NodeJS.Timeout);
    rooms.delete(room.code);
    return { room, deleted: true, becameBot: true };
  }
  return { room, deleted: false, becameBot: true };
}
```

## Fork 3 — Own hosting, or open source?

- **Context.** Run the game as a single service I operate, or release the code so
  anyone self-hosts.
- **Decision.** GitHub, AGPL-3.0. The repository *is* the product.
- **Trade-off.** There is no single place where everyone plays, and no control
  over third-party deployments. Accepted: in exchange there is no bill in my name
  and no complaints about someone else's pictures — the user has full control.
- **Status.** Shipped. See [`MODERATION.md`](./MODERATION.md) and the root
  `LICENSE`.

## Fork 4 — Who owns the picture?

- **Context.** Filter the Workers AI *output* myself, or place responsibility on
  the operator who deployed the instance.
- **Decision.** Clean the *input* only (profanity filter across all 12 languages,
  plus CSAM and hard-block guards on the assembled prompt); the *output* is the
  responsibility of whoever ran the deploy. An in-game source footer says so.
- **Trade-off.** No guarantee on the generation result. Accepted as the honest
  price of *not* being a central operator: your Workers AI, your Neurons, your
  risk.
- **Status.** Shipped. See [`MODERATION.md`](./MODERATION.md) (operator
  responsibility) and `client/src/components/SourceFooter.tsx`.

## Fork 5 — A spend ceiling, or trust Workers AI?

- **Context.** Rely on Cloudflare's own Workers AI limits, or count generations
  in our own code.
- **Decision.** A self-contained daily counter (`server/src/image.ts`). The free
  tier is ~10,000 Neurons/day; Flux Schnell at 4 steps costs ~300–600 Neurons per
  image, i.e. ~15–30 images/day before the free ceiling. The host start screen
  therefore shows "Up to 25 images/day. Resets daily at 00:00 UTC." The 25 is not
  the free limit — it's a deliberately conservative value confirmed by testing in
  May–June 2026. A persistent cross-restart count via Cloudflare KV is an optional
  extra (a few more clicks at deploy time — see [`DEPLOYMENT.md`](./DEPLOYMENT.md),
  *persistent image counter*).
- **Trade-off (of the counter variant).** Extra logic, and a button that
  occasionally goes dark for a day. Accepted for predictability: Cloudflare gives
  no warning when the free Neurons run out, and on the paid tier it bills with no
  ceiling — so the counter is the one independent guarantee.
- **Status.** Shipped. See [spec §11, §17](./FUNNY_STORIES_SPEC_v4.md).

```ts
// Returns false when the daily ceiling is already reached. On success the
// slot is reserved (counter incremented) BEFORE the Worker call is awaited,
// so concurrent requests from different rooms cannot overshoot the cap.
// Attempts are counted, not successes — a failed generation may still have
// consumed Neurons, and refunding failures would let an abuser dodge the cap.
// The cap check uses max(local, worker) so a cold-started process with a
// pre-existing KV count above the limit correctly refuses new reservations.
export function reserveImageSlot(): boolean {
  rolloverIfNewDay();
  if (imagesGeneratedToday() >= maxImagesPerDay()) return false;
  imagesToday++;
  return true;
}

export function imagesGeneratedToday(): number {
  return Math.max(imagesToday, workerCount);
}
```

## Fork 6 — Graphics: rich, or universal?

- **Context.** Lottie, Rive, or video, versus SVG and CSS for compatibility.
- **Decision.** SVG, CSS, and Framer Motion only.
- **Trade-off.** Some effects are given up. Accepted for a tiny bundle, graceful
  degradation, and live animations even on old Android — the timer twitches, the
  monkey jumps, the final picture wobbles. (Video is still open: searching for a
  free text-to-video API.)
- **Status.** Shipped. See [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md).

## Fork 7 — Sound, or silence?

- **Context.** Add sound in the first version, or defer it.
- **Decision.** Silence in v0.1.
- **Trade-off.** The game is mute. Accepted to avoid fighting browser autoplay
  policies, which clip it anyway. Sound is a separate story for a later version.
- **Status.** Deferred (not reversed). Revisit post-v0.1.

## Fork 8 — Auto-translate, or verbatim answers?

- **Context.** Translate players' answers on the fly, or leave them as written.
- **Decision.** Answers go into the final story **verbatim** — the player's exact
  wording *is* the joke, and translating it kills the joke. The **picture prompt**
  is a different matter: tests showed Workers AI renders better from English, so
  the seven slot answers are translated to English before the prompt is assembled
  (via [MyMemory](https://mymemory.translated.net) — free, no signup, no API key;
  anonymous quota 5000 words/day per IP). See [`LANGUAGES.md`](./LANGUAGES.md).
- **Trade-off.** Mixed languages can appear within one story. Accepted: that's the
  cost of keeping the joke intact.
- **Note (prompt craft).** Flux's CLIP text encoder is trained primarily on
  English captions, so the locked style suffix is English-only — translating it
  made the model default to a generic painterly look. And do **not** use negation:
  diffusion models handle it poorly, and naming the unwanted thing ("don't draw X")
  only reinforces it.
- **Status.** Shipped. See `STYLE_SUFFIX` in `server/src/prompt.ts`.

```ts
// Locked style suffix — appended to every image prompt so the Worker AI
// model renders in a consistent goofy-cartoon look. English-only: Flux's
// CLIP text encoder is trained primarily on English captions, so the
// stylistic anchors (`goofy cartoon`, `googly eyes`, `hand-drawn doodle`)
// only land when written in English. Translating them caused the model to
// default to a generic painterly look.
export const STYLE_SUFFIX =
  ', in a goofy cartoon style, googly eyes, exaggerated expressions, ' +
  'bright colors, hand-drawn doodle illustration';
```

---

Nine forks, nine deliberate turns, and the game is ready. The code is on GitHub
under AGPL-3.0; deploy in a few minutes via the one-click buttons in
[`DEPLOYMENT.md`](./DEPLOYMENT.md).
