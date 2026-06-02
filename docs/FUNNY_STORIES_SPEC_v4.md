# Funny Stories — Build Spec for Claude Code (v4)

<!-- VERSIONING BLOCK — DO NOT REMOVE. Update on every substantive change. -->

| | |
|---|---|
| **Document version** | `4.34.1` |
| **Last updated** | 2026-05-25 |
| **Document ID** | `FUNNY_STORIES_SPEC_v4` |

**How to check whether your local copy is current.** Open the canonical version in the project, compare the version number above with your downloaded copy. If they differ, scroll to the **Changelog** at the bottom of the canonical version to see what changed between your version and the current one. Versions follow [semantic versioning](https://semver.org/) adapted for build specs:

- **Major** (`X.0.0`) — breaking architectural change; previous build assumptions partly invalidated; re-read in full before continuing implementation.
- **Minor** (`4.X.0`) — new section, additive feature, or clarified requirement that affects downstream code; read the changelog entry and the affected section.
- **Patch** (`4.0.X`) — typos, phrasing, broken links, comment-level fixes; safe to skip.

> **Note on spec amendments.** No active amendments in v4. The donation-routing amendment that overrode §16, §17, and §19 in v3 has been folded into the main spec as of v4.0.0 (see Changelog at the bottom of this document). If a future `SPEC_AMENDMENT_*.md` companion file is introduced, treat it as authoritative over the section(s) it names — until the amendment is folded into a new minor or major version of this spec.

> Clean rewrite incorporating all architectural decisions made across v1, v2, and v3.
> Key changes from v3.1.0: donation-routing amendment folded into the body of the spec
> (§14, §16, §18, §20, §23); `SPEC_AMENDMENT_donation_routing.md` retired and deleted;
> stale section references corrected (v3's body referenced §17 and §19 in places where
> the v3 renumbering put the relevant text in §18 and §20). No behavioural changes from
> the merged v3.1.0 state — v4 is a single-source-of-truth cut.

---

## Architecture overview

```
┌─────────────────────────┐         WebSocket          ┌──────────────────────┐
│  Player phones (PWA)    │ ◄──────────────────────── │  Render web service  │
│  React + Socket.IO      │                            │  Node 20 + Fastify   │
│  Vite + Tailwind        │ ──── reveal:requestPicture ►  Socket.IO           │
└─────────────────────────┘                            │  In-memory room state│
                                                        └──────────┬───────────┘
                                                                   │ GET /generate?prompt=…
                                                                   │ + X-Secret header
                                                        ┌──────────▼───────────┐
                                                        │  Cloudflare Worker   │
                                                        │  Workers AI          │
                                                        │  Flux Schnell        │
                                                        └──────────────────────┘
```

- **No database.** Room state lives in a `Map<roomCode, Room>` on the Node process.
- **No translation.** Workers AI handles Russian and English prompts natively.
- **Bounded reconnect.** A short connection-state-recovery grace window (§7) tolerates brief drops — a phone backgrounding the browser. Beyond it, disconnect during a game = bot replacement. `socket.id` is the only player identifier.
- **No client-side AI calls.** All image generation is server→Worker→server→client.
- **One Render service.** No Docker sidecar, no Redis.

---

## 1. What the game is

A party game for **3 to 7 players** played on phones via a web browser (PWA). One player creates a room and shares a link / QR code. Each player answers 7 silly questions about a shared story without seeing others' answers. Stories rotate between players each round. At the end, every player sees their assigned complete story as readable prose, then generates a goofy AI cartoon from it.

### The 7 questions (in order)

1. Who?
2. And who else?
3. Where?
4. When?
5. What did they do?
6. What for?
7. What happened in the end?

### Round structure

- **Rounds 1–7 (writing rounds):** Each player sees one question, a text box, a "Submit" button, and a 60-second timer bar. They cannot see any other answers in their story. Submitting (or the timer expiring) rotates the story to the next player.
- **Round 8 (reveal):** Each player receives their assigned story as rendered prose. They click "Generate picture" → server calls Workers AI → image arrives via socket → image fades in below the prose.

### Story rotation

Stories form an array of length N (= number of players). On round R (0-indexed), player at index P is assigned story index `(P - R + N) mod N`. Each player has exactly one story per round. With fewer than 7 players, some players answer multiple questions for the same story — this is intentional and part of the game.

### End of game

After round 8, the **host** sees **"One more game"** and **"Finish game"**. Other players see a **"Ready"** toggle. "One more game" is enabled only when the host clicks it **and** all non-bot players are ready **and** at least 3 non-bot players remain (if fewer remain due to disconnections, "One more game" is disabled and a message explains why). "Finish game" sends everyone to a **"Game is over"** screen showing the pre-bundled monkeys-on-a-bus image.

---

## 2. Tech stack (locked — do not substitute)

### Frontend (PWA)

| Package | Purpose |
| :--- | :--- |
| TypeScript + React 18 + Vite | App framework |
| vite-plugin-pwa | Manifest + service worker |
| Tailwind CSS | Styling |
| Framer Motion | Round transitions (spring physics) |
| react-i18next + i18next | English + Russian UI strings |
| socket.io-client | Real-time communication |
| qrcode.react | QR code in lobby |
| nanoid | Client-side room code display IDs where needed |

### Backend

| Package | Purpose |
| :--- | :--- |
| Node.js 20 + TypeScript | Runtime |
| Fastify + @fastify/static + @fastify/cors | HTTP server + PWA serving + CORS |
| Socket.IO | Real-time room state |
| nanoid | Room codes |
| obscenity | English profanity filter |
| bad-words-next | Russian profanity filter |

No translation library. No ORM. No database driver. No job queue.

### Image generation

**Cloudflare Workers AI** — `@cf/black-forest-labs/flux-1-schnell` — wrapped in a thin Cloudflare Worker script (see §15). The Render server calls this Worker via HTTPS with a shared secret header. The Worker returns raw PNG bytes. The server converts to a base64 data URL and delivers it to the requesting player via `reveal:pictureReady`. The client never calls any AI endpoint directly.

Free tier limits: ~10,000 neurons/day on Cloudflare. Flux Schnell at 4 steps costs ~300–600 neurons/image → **roughly 15–30 images per day** before the free cap. Document in README.

### Hosting

- **Render** — single web service, starter plan ($7/month).
- **Cloudflare** — single Worker, free plan.

---

## 3. File / folder layout

```
funny-stories/
├── client/
│   ├── public/
│   │   ├── manifest.webmanifest
│   │   ├── icon-192.png
│   │   ├── icon-512.png
│   │   └── monkeys-on-bus.png        # pre-generated, checked in
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                   # routes by game phase
│   │   ├── socket.ts                 # socket.io-client singleton
│   │   ├── i18n/
│   │   │   ├── index.ts
│   │   │   ├── en.json
│   │   │   └── ru.json
│   │   ├── screens/
│   │   │   ├── HomeScreen.tsx        # create or join + nickname
│   │   │   ├── LobbyScreen.tsx       # player list, QR, copy-link, start
│   │   │   ├── RoundScreen.tsx       # question + textarea + timer bar
│   │   │   ├── WaitingScreen.tsx     # submitted, waiting for others
│   │   │   ├── RevealScreen.tsx      # prose + generate picture button
│   │   │   └── EndScreen.tsx         # monkeys-on-bus + ready/restart/finish
│   │   ├── components/
│   │   │   ├── TimerBar.tsx
│   │   │   ├── QRCode.tsx
│   │   │   └── PlayerList.tsx
│   │   └── styles/
│   │       └── index.css             # Tailwind base + Fredoka font
│   ├── index.html
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── server/
│   ├── src/
│   │   ├── index.ts                  # Fastify + Socket.IO bootstrap
│   │   ├── rooms.ts                  # room store + lifecycle helpers
│   │   ├── game.ts                   # rotation logic + round advance + bot fill
│   │   ├── prompt.ts                 # story answers → image prompt string
│   │   ├── image.ts                  # Cloudflare Worker call + retry
│   │   ├── filter/
│   │   │   ├── index.ts              # orchestrator: normalize → en → ru → standin
│   │   │   ├── en.ts                 # obscenity matcher
│   │   │   ├── ru.ts                 # bad-words-next matcher + ru word list
│   │   │   └── standins.ts           # localized replacement lists
│   │   ├── i18n/
│   │   │   ├── en.json               # questions + prose template
│   │   │   └── ru.json
│   │   └── types.ts
│   ├── tsconfig.json
│   └── package.json
├── cloudflare/
│   ├── worker.js                     # Cloudflare Worker script
│   └── wrangler.toml                 # Wrangler deploy config
├── shared/
│   └── events.ts                     # socket event payload types
├── render.yaml
├── package.json                      # npm workspaces root
├── tsconfig.base.json
└── README.md
```

npm workspaces: `client`, `server`, `shared`. The `cloudflare/` directory is **not** a workspace — it is deployed independently.

---

## 4. Server data model (`server/src/types.ts`)

```typescript
type RoomPhase = 'lobby' | 'playing' | 'reveal' | 'ended';
type Language  = 'en' | 'ru';

interface Player {
  id: string;        // socket.id — rotates on each connection, no stable identity
  nickname: string;
  isBot: boolean;    // true when this slot's real player disconnected mid-game
}

interface Story {
  answers: (string | null)[];  // length 7, index = question number (0–6)
  pictureUrl: string | null;   // base64 data URL; set once, never overwritten
}

interface Room {
  code: string;                    // 6-char nanoid, uppercase, no ambiguous chars
  hostId: string;                  // socket.id of current host
  language: Language;
  players: Player[];               // locked at game:start; order drives rotation
  phase: RoomPhase;
  currentRound: number;            // 0–6 = writing rounds; 7 = reveal
  stories: Story[];                // stories[i] belongs to players[i] at round 0
  submittedThisRound: Set<string>; // socket.ids that have submitted this round
  roundDeadline: number | null;    // epoch ms
  roundTimer: NodeJS.Timeout | null;
  readyForRestart: Set<string>;    // socket.ids ready for "one more game" (§5)
}
```

### Rotation formula

`storyIndex(playerIndex P, round R, playerCount N) = (P - R + N) mod N`

Verify with N=3, R=0: P0→S0, P1→S1, P2→S2. R=1: P0→S2, P1→S0, P2→S1. Each player touches a different story each round.

### Bot slots

When a player disconnects mid-game their `Player` entry stays in `players[]` with `isBot = true`. This preserves rotation integrity — removing the slot would shift all indices and corrupt the story assignments for everyone else.

### "One more game" reset

On `game:restart`:
1. Remove all bot entries from `players[]`.
2. If fewer than 3 real players remain, the host's "One more game" button is already disabled — this is a client-side guard, but also validate server-side and return an error if violated.
3. Rebuild `stories[]` as fresh `Story` objects (`answers: [null×7], pictureUrl: null`) with length = remaining `players.length`.
4. Reset `phase`, `currentRound`, `submittedThisRound`, `roundDeadline`, `roundTimer`.
5. Assign a new `hostId` if the current host was among the removed bots (promote first non-bot).

---

## 5. Socket events (`shared/events.ts`)

### Client → Server

| Event | Payload | Notes |
| :--- | :--- | :--- |
| `room:create` | `{ nickname, language }` | Ack: `{ roomCode, socketId }` |
| `room:join` | `{ roomCode, nickname }` | Ack: `{ socketId, players, language, hostId }` or `{ error }` |
| `room:leave` | — | Lobby only; ignored during a game |
| `game:start` | — | Host only; ≥3 players required; locks the room |
| `round:submit` | `{ answer: string }` | Empty string allowed; treated as auto-fill |
| `reveal:requestPicture` | — | Triggers server→Worker AI call for this player's story |
| `reveal:retryPicture` | — | Same as `reveal:requestPicture`; exists as a separate named event for clarity |
| `game:ready` | `{ ready: boolean }` | Toggle for "one more game" |
| `game:restart` | — | Host only; all non-bot players must be ready |
| `game:end` | — | Host only; unconditional |
| `gallery:share` | — | Host only; broadcasts the room gallery to every player (§24) |
| `stats:get` | — | Ack: `{ openRooms, imagesGeneratedToday, imagesLimit }`. One-shot fetch of server stats for the Home screen (§13, §15, §26) |

### Server → Client

| Event | Payload | Notes |
| :--- | :--- | :--- |
| `lobby:update` | `{ players: Player[], hostId: string, donateUrl: string \| null }` | On any roster or host change. `donateUrl` is the deployer's `DEPLOYER_DONATE_URL` env var value, or `null` when unset (see §18 and §20). |
| `round:start` | `{ roundNumber: number, question: string, deadline: number }` | Per-player; `question` is in the room's language; `deadline` is epoch ms |
| `round:waiting` | `{ submitted: number, total: number }` | Sent to this player after they submit while others are still writing |
| `reveal:start` | `{ answers: string[], prose: string }` | Per-player, private. `answers` = this player's 7 answers (for highlighting). `prose` = rendered story in room language. No `pictureUrl` — that arrives separately. |
| `reveal:pictureReady` | `{ pictureUrl: string }` | Base64 data URL; sent after Workers AI returns |
| `reveal:pictureError` | `{ message: string }` | Sent if all retries fail; client shows retry button |
| `game:restartReady` | `{ readyIds: string[] }` | Updates as players toggle ready |
| `game:over` | — | Terminal broadcast sent after the host's `game:end`. Marks the game finally over; also navigates any client still on the reveal screen to the end screen. |
| `gallery:ready` | `{ entries: GalleryEntry[] }` | The shared room gallery (§24). Broadcast to every player after the host's `gallery:share`, and re-sent when a late-arriving picture refreshes it. `GalleryEntry = { nickname, isBot, answers, prose, pictureUrl }`. |
| `player:lost` | `{ nickname: string }` | Host only. Sent when a player is botified after the §7 grace window elapses; drives the host notice (§8, §12). |
| `stats:update` | `{ openRooms, imagesGeneratedToday, imagesLimit }` | Live broadcast of the server-stats payload. Fired whenever either counter changes (room created / destroyed, image slot reserved). Same shape as the `stats:get` ack. Broadcast to every connected socket; only the Home screen's Create mode subscribes (§26). |
| `error` | `{ code: string, message: string }` | `ROOM_NOT_FOUND`, `ROOM_LOCKED`, `ROOM_FULL`, `NOT_HOST`, `NOT_ENOUGH_PLAYERS`, `INVALID_NICKNAME`, `RATE_LIMITED`, `SERVER_BUSY` |

**Note on `socketId` in acks:** `socket.id` is already available on the client as `socket.id`, but returning it explicitly in the ack confirms the connection is established and the server-side ID is known before any further events are emitted.

---

## 6. Profanity filter (`server/src/filter/`)

Runs on every `round:submit` answer before it is stored. The player is never told their answer was replaced.

### Pipeline

1. **Normalize:** lowercase, strip diacritics (`é→e`), collapse leet separators (`s.h.i.t → shit`, `sh!t → shit`).
2. **English check:** `obscenity` `RegExpMatcher` with the default English dataset.
3. **Russian check:** `bad-words-next` with the bundled Russian word list in `filter/ru.ts`.
4. **On any hit:** replace the entire answer with a random stand-in for the current question index, drawn from the room's language list in `standins.ts`.

### Stand-in shape

```typescript
// One flat string per stand-in. No `en` field — Workers AI is multilingual,
// so a Russian stand-in goes into the prompt as-is.
const standins: Record<Language, Record<number, string[]>> = {
  en: {
    0: ["a sleepy llama", "the librarian's evil twin", "a confused penguin",
        "an overconfident raccoon", "a time-traveling accountant",
        "the world's smallest dragon", "a haunted vending machine",
        "a retired superhero named Gerald", "a suspicious houseplant",
        "three children in a trench coat"],
    1: ["with a haunted toaster", "with three angry geese",
        "with a philosophical goldfish", "with someone who wouldn't stop humming",
        "with a cardboard cutout of a celebrity", "with an invisible best friend",
        "with a goat named Professor Cheese", "with a very lost tourist",
        "with a robot who only speaks in riddles", "with their imaginary accountant"],
    2: ["inside a cheese factory", "at the bottom of the ocean",
        "in a library that only holds cookbooks", "on top of a moving bus",
        "inside a giant sock drawer", "at a very sad birthday party",
        "in the world's smallest elevator", "behind the sofa",
        "at a conference for people named Dave", "inside a cloud"],
    3: ["during a minor earthquake", "at the exact moment of a solar eclipse",
        "right after breakfast but before second breakfast",
        "during someone else's wedding", "on a Tuesday that felt like a Wednesday",
        "when all the clocks stopped", "at 3am for no good reason",
        "during the annual hat festival", "when the internet went down",
        "at the precise moment a seagull made a decision"],
    4: ["invented a new type of sadness", "attempted to bake an emotion",
        "tried to explain jazz to a brick wall",
        "reorganized the clouds by size",
        "started a strongly worded letter and never finished it",
        "accidentally became a local legend",
        "forgot how stairs work",
        "challenged a mirror to a staring contest",
        "declared war on Mondays", "tried to refund a rainbow"],
    5: ["for reasons that made sense at the time",
        "to impress a pigeon", "because the warranty said not to",
        "in exchange for a single grape",
        "because someone dared them and they never back down",
        "to prove a point nobody asked about",
        "for science (unverified)", "out of spite",
        "because the horoscope was very specific",
        "to settle a bet with themselves"],
    6: ["everyone had strong feelings about pasta",
        "a duck filed a formal complaint",
        "nothing made sense but everyone felt fine about it",
        "the receipts were lost and that was probably for the best",
        "several pigeons received certificates",
        "the mayor sent a fruit basket",
        "a sequel was immediately greenlit",
        "it was declared a public holiday in three countries",
        "the cloud that had been watching finally looked away",
        "everyone agreed never to speak of it again"]
  },
  ru: {
    0: ["сонная лама", "злой близнец библиотекаря", "растерянный пингвин",
        "самоуверенный енот", "бухгалтер-путешественник во времени",
        "самый маленький дракон в мире", "проклятый автомат с едой",
        "пенсионер-супергерой по имени Гена", "подозрительный комнатный цветок",
        "трое детей в одном плаще"],
    1: ["с проклятым тостером", "с тремя злобными гусями",
        "с философской золотой рыбкой", "с тем, кто не переставал мычать",
        "с картонной копией знаменитости", "с невидимым лучшим другом",
        "с козой по имени Профессор Сыр", "с очень заблудившимся туристом",
        "с роботом, говорящим только загадками", "со своим воображаемым бухгалтером"],
    2: ["внутри сырного завода", "на дне океана",
        "в библиотеке, где только кулинарные книги", "на крыше движущегося автобуса",
        "в ящике с носками", "на очень грустном дне рождения",
        "в самом маленьком лифте в мире", "за диваном",
        "на конференции людей по имени Игорь", "внутри облака"],
    3: ["во время небольшого землетрясения", "в момент солнечного затмения",
        "сразу после завтрака, но до второго завтрака",
        "на чужой свадьбе", "во вторник, похожий на среду",
        "когда все часы остановились", "в три часа ночи без причины",
        "во время ежегодного фестиваля шляп",
        "когда пропал интернет",
        "в момент, когда чайка приняла важное решение"],
    4: ["придумал новый вид грусти", "попытался испечь эмоцию",
        "объяснял джаз кирпичной стене",
        "сортировал облака по размеру",
        "начал серьёзное письмо и не закончил",
        "случайно стал местной легендой",
        "забыл как работают лестницы",
        "вступил в конкурс по гляделкам с зеркалом",
        "объявил войну понедельникам",
        "попытался вернуть радугу в магазин"],
    5: ["по причинам, которые тогда казались разумными",
        "чтобы впечатлить голубя", "потому что гарантия запрещала",
        "в обмен на одну виноградину",
        "потому что поспорили и они никогда не отступают",
        "чтобы доказать никому не нужную точку зрения",
        "во имя науки (не подтверждено)", "из вредности",
        "потому что гороскоп был очень конкретен",
        "чтобы урегулировать спор с самим собой"],
    6: ["у всех были сильные чувства по поводу пасты",
        "утка подала официальную жалобу",
        "ничего не имело смысла, но всем было хорошо",
        "чеки потерялись и это было к лучшему",
        "несколько голубей получили сертификаты",
        "мэр прислал фруктовую корзину",
        "сиквел немедленно получил зелёный свет",
        "это объявили праздником в трёх странах",
        "облако, которое наблюдало, наконец отвернулось",
        "все согласились никогда больше не говорить об этом"]
  }
};
```

### CSAM-pattern guard

In addition to the per-answer profanity replacement above, the server runs
a **combinatorial CSAM-pattern guard** on the fully-assembled image prompt
just before the Cloudflare Worker call (`server/src/filter/csam.ts`,
called from `handlePictureRequest` in `game.ts`). The guard refuses the
generation when the prompt contains **both** a minor-indicator token
*and* a sexual-indicator token; either category alone is harmless in a
party game ("three kids in a trench coat", "a sexy hat") and does not
fire.

When the guard fires:

- The image is not generated; no request is made to the Cloudflare
  Worker.
- **No daily-image-cap slot is consumed** — the guard runs before
  `reserveImageSlot()` (§11, §17), so a flood of blocked prompts cannot
  exhaust the Cloudflare Neuron budget for legitimate rooms.
- The requesting player receives the same generic
  `reveal:pictureError { message: 'Generation failed. Try again.' }` as
  any other failure path. The error is deliberately indistinguishable
  from a transient Cloudflare failure: telling the player exactly why
  the prompt was refused would let them binary-search the heuristic.

This is **not** a curated CSAM blocklist (Thorn's Safer is a commercial
product; NCMEC's term holdings are restricted to law-enforcement
partners — neither publishes a freely-usable wordlist). It is a
deliberately conservative combinatorial heuristic in the spirit of what
open-source content-handling projects ship: small minor-indicator and
sexual-indicator lists in both EN and RU, substring-matched against the
lower-cased prompt. False positives ("a sexy hat for the kid's
birthday") and false negatives (obfuscated inputs) are both possible
and accepted; the guard is calibrated to err toward over-blocking
because the user impact of a false positive is "try again with
different words."

The indicator lists live in `server/src/filter/csam.ts` and their
behaviour is pinned by `server/src/filter/csam.test.ts`. Changes to the
lists require updating both files in the same edit.

### Hard-block list

Alongside the combinatorial CSAM guard, the server runs an
**unconditional hard-block list** (`server/src/filter/hardBlocks.ts`)
against the same assembled prompt. Unlike the CSAM guard, a single hit
is enough — the list contains only terms whose presence in an image
prompt has no plausible silly-story use (sexual-violence verbs,
child-sexual-abuse standalone terms, bestiality, targeted-violence
verbs like "assassinate" and "behead"). The bar for inclusion is
deliberately high: "kill", "shoot", "murder", and similar broad-use
words are **not** on the list, because they have legitimate party-game
uses.

Both guards run at the same call site — `handlePictureRequest` short-
circuits on either, before `reserveImageSlot()`, with the same generic
`reveal:pictureError` shape. The two guards are conceptually distinct
defences: the CSAM guard catches deliberate combinations across two
otherwise-innocent categories, the hard-block list catches unambiguous
single tokens. Together they form the two pre-Worker prompt-safety
layers shipped by default. Operators are free to add further layers
(post-generation classifiers, Cloudflare AI Gateway moderation, etc.)
in their own deploys (see also the project's distribution-model analysis).

---

## 7. Connection / disconnection rules

`socket.id` is the only player identifier. No `localStorage` is used for player identity.

### Disconnect grace window

A dropped socket is **not** acted on immediately. Socket.IO **connection-state recovery** is enabled (`connectionStateRecovery`): a client whose connection drops — most often a phone backgrounding the browser — keeps its `socket.id` and rejoins its rooms, with missed events replayed, if it returns within a bounded window (~60 s). On `disconnect` the server starts a grace timer of the same length instead of removing the player; if the socket recovers, the timer is cancelled and nothing else changes — other clients see no roster churn, and the room is neither frozen nor deleted. Only when the window elapses **without** a return are the phase rules below applied.

An explicit `room:leave` is an intentional action and is **not** graced — it removes the player immediately.

This is a *bounded tolerance window*, not a general reconnect: a client gone longer than the window, or whose page is fully discarded by the browser (losing its in-memory recovery state), still falls through to bot replacement. There are no accounts, no persistent identity token, and no `localStorage`.

### Lobby phase (after the grace window)

- Player disconnects, or emits `room:leave` → remove from `players[]`, broadcast `lobby:update`. (`room:leave` takes effect immediately; a disconnect waits out the grace window first.)
- Host disconnects → promote the next player in array order, broadcast `lobby:update`.
- Room empties → delete.

### Game phase (after `game:start`, after the grace window)

- Player disconnects → set `player.isBot = true`. Do **not** remove from `players[]`.
- The bot is treated as auto-submitted for the current round immediately (no need to wait for the deadline for their slot specifically, but the round still waits for all human players or the deadline).
- If the disconnected player was the host → promote the next non-bot player to host, broadcast `lobby:update`.
- If all players are now bots → delete the room.
- When a player is botified by this path, the server emits `player:lost` to the host, who sees a dismissible notice with an "ignore / create a new room" choice (§8, §12).

### Reveal phase (after the grace window)

- Player disconnects → their story and picture request are abandoned silently. No action on other clients.

### "One more game" guard

Before executing `game:restart`, the server counts non-bot players. If fewer than 3, return `{ error: 'NOT_ENOUGH_PLAYERS' }`. The client disables the "One more game" button when `game:restartReady` updates indicate fewer than 3 non-bot ready players.

---

## 8. Mobile-first UI

- **Single column**, max-width 480px, centered on wider screens.
- **Tap targets ≥ 44px** on all interactive elements.
- **Textarea** occupies the upper half of the viewport so the software keyboard doesn't obscure the Submit button. Auto-focus on every `round:start`. Empty submission is allowed and treated as a timeout (auto-fill).
- **Timer bar:** thin strip at the very top of the screen. Drains over 60 seconds. Color: green → amber (last 20s) → red (last 10s). No numeric countdown — it raises anxiety in a party game.
- **Font:** `Fredoka` (Google Fonts) for headings, system sans-serif for body.
- **Motion:** Framer Motion with spring physics for round transitions (slide + fade) — spring values per `DESIGN_SYSTEM.md` §4 (the `snappy` preset). Linear easing is explicitly wrong here — spring feel is the game's personality.
- **Background:** light pastel (#fef3c7 or similar warm cream) with a handful of static wiggly SVG doodle lines as a subtle texture. Do not animate the background.
- **Home screen:** two modes, selected on load by the presence of a `?room=<CODE>` URL parameter. **Create mode** (no `?room=`) shows the wordmark, the language selector (§9), a nickname field, a single "Create room" button, and a small host-stats block (open rooms; AI images today / cap — §26) — this is the host's screen. **Join mode** (`?room=<CODE>` present) shows the wordmark, a read-only "joining room `<CODE>`" line, a nickname field, and a single "Join room" button; it does **not** show the language selector (a joining player inherits the room language) or any editable room-code field. There is no manual room-code entry box on either mode — the only ways to join a room are the invite link and the QR code, both of which carry `?room=<CODE>`. If a join attempt returns `ROOM_NOT_FOUND` (a stale or recycled link), Join mode shows a clear "this room no longer exists" message and a "Create a new room" button that returns to Create mode.
- **Lobby screen:** large room code at top, QR code below, "Copy link" button, player list with nicknames and a coloured dot (green = connected, grey = bot). Host sees a "Start Game" button — disabled with tooltip "Need at least 3 players" until threshold met.
- **Round screen:** question text large and friendly, textarea below, Submit button pinned to bottom of upper half, timer bar at very top.
- **Waiting screen:** a simple message with animated ellipsis and `submitted / total` count.
- **Reveal screen:** story prose in a large readable serif (Georgia or similar). The 7 player-supplied phrases are wrapped in `<span class="font-bold text-pink-600">`. Picture generation starts **automatically** when the screen opens — there is no "Generate Picture" button. While generating, the screen shows only the prose; if generation runs longer than **3 seconds**, a funny wait control (the waiting mascot + "Summoning chaos…") appears, so a fast result never flashes a spinner. On `reveal:pictureReady`: image fades in with a Framer Motion spring scale. On `reveal:pictureError`: friendly message + "Try again" button. A self-paced "Continue" button takes the player to the end screen — the reveal is private per-player (`reveal:start` is per-player), so each player advances on their own (see §17). Generation continues server-side even if the player presses Continue first, so the picture is still captured for the room gallery (§24).
- **End screen:** `monkeys-on-bus.png` fills the upper half. "Game is over" caption. Host sees "One more game" (disabled if <3 non-bot players remain, with explanation) and "Finish Game". Others see a "Ready" toggle + "Waiting for host…" once toggled on. The host also sees a "Share the room's pictures" button; once pressed, every player sees the **room gallery** embedded on this screen — every story and its picture, browsable one at a time (§24).
- **Source footer:** the Home screen and End screen end with a small footer linking to the upstream project on GitHub and a one-line note that player content and AI pictures are the operator's responsibility (§27).
- **Bot indicator:** in `PlayerList`, bot slots show the nickname with a small "🤖" label and reduced opacity. Visible during the game phase only.
- **Host notice (player lost):** when a player is botified after the §7 grace window, the host — and only the host — sees a dismissible banner *"<name> exited"* with two buttons: "Ignore, continue the game" (dismiss the banner; the bot plays on) and "Create a new room" (ends the game for everyone via `game:end`, then the host lands on a fresh Create-mode Home screen). The banner is **non-blocking** — the game continues underneath it for every player (§12).

---

## 9. i18n

### Structure

- `client/src/i18n/en.json` and `ru.json` — all UI strings.
- `server/src/i18n/en.json` and `ru.json` — questions array and prose template only.

### Server i18n shape

```json
{
  "questions": [
    "Who?", "And who else?", "Where?", "When?",
    "What did they do?", "What for?", "What happened in the end?"
  ],
  "prose": "{0} and {1} were {2} {3}. They {4} {5}. In the end, {6}."
}
```

### Prose templates (locked)

**English (`en.json`):**

```
"{0} and {1} were {2} {3}. They {4} {5}. In the end, {6}."
```

**Russian (`ru.json`):**

```
"{0} {1} {3} {2} {4} {5}. В итоге {6}."
```

Slot mapping (identical in both languages): `{0}=who`, `{1}=with whom`, `{2}=where`, `{3}=when`, `{4}=what did they do`, `{5}=what for`, `{6}=what was at the end`.

The Russian template is **not** a slot-for-slot port of the English one: slot 3 (when) precedes slot 2 (where) to respect Russian word order, and the connective "В итоге" replaces "In the end,". Do not "fix" this back to slot order during translation review.

### English-only slot-5 "for" prefix

`renderProse('en', …)` applies one piece of English-specific
post-processing before substitution: if slot 5 ("What for?") does not
already begin with a connective (`for`, `to`, `because`, `so that`, `in
order`, `in exchange`, `out of`, `since`), a literal `"for "` is
prepended to the answer. So a bare-noun player answer like *"money"*
renders as *"They skiing **for** money."*, while a stand-in like *"to
impress a pigeon"* is left alone (no *"for to impress"*).

The regex of leading connectives is paired with the EN slot-5
stand-in pool — adding a new stand-in whose leading word is not in
the list requires extending the regex in lockstep. Behaviour pinned
by `server/src/i18n/index.test.ts`.

### Russian-only slot-1 "и" and slot-6 "это закончилось" prefixes

`renderProse('ru', …)` applies two Russian-specific post-processing
steps before substitution. Item 23 of the triage backlog
has the analysis.

- **Slot 1 ("С кем?").** If the answer does not already begin with
  `с`, `со`, or `и`, a literal `"и "` is prepended. So a bare player
  noun like *"кенгуру"* renders as *"мышь **и** кенгуру …"*, while a
  stand-in like *"с проклятым тостером"* is left alone. The detection
  helper `ruSlot1NeedsAndPrefix` is **exported** from
  `server/src/i18n/index.ts` and also imported by
  `server/src/prompt.ts` so the prose and the image-prompt narrative
  both apply the same transform — otherwise *"кот и лошадь"* in the
  prose would correspond to ambiguous *"кот лошадь"* in the image
  prompt.
- **Slot 6 ("Чем всё закончилось?").** A word-count heuristic: if the
  answer is **two words or fewer** it is treated as a bare-noun
  player answer (likely instrumental case, e.g. *"путешествием"*) and
  a literal `"это закончилось "` is prepended. The existing 10 RU
  slot-6 stand-ins are all 4+ words and read naturally after *"В
  итоге"*; they are never touched. So *"В итоге путешествием."*
  becomes *"В итоге **это закончилось** путешествием."*, while *"В
  итоге утка подала официальную жалобу."* is unchanged.

The English path (above) and the Russian path are mutually
exclusive — `renderProse` selects exactly one based on `language`.
Behaviour pinned by `server/src/i18n/index.test.ts`.

### Client UI string catalogue

The implementer drafts both `en.json` and `ru.json` UI string contents in one pass during step 5 and step 12, and flags the Russian strings for human review in the PR description. Required key namespaces:

- `home.*` — title, subtitle, nickname placeholder, create / join buttons, joining-room label, stale-link ("room no longer exists") message, "create a new room" button, open-room counter label, images-today line, language toggle labels. (No room-code placeholder — Join mode has no editable code field; see §8.)
- `lobby.*` — room code label, copy link button + success toast, QR caption, waiting copy, start game button, start-disabled tooltip, host badge.
- `round.*` — submit button, textarea placeholder, character counter format (`{count} / 70`).
- `waiting.*` — submitted-waiting copy, `{submitted} / {total}` format, animated ellipsis.
- `reveal.*` — retry button, wait-control caption (`Summoning chaos…`), error message, picture alt text, continue button. (No "generate picture" key — picture generation is automatic; see §8 and §11.)
- `end.*` — "Game is over" headline, one more game button, finish game button, ready toggle, ready-waiting copy, `endScreen.supportServer` (per the deployer-donation rule defined in §14, §18, and §20).
- `gallery.*` — share-pictures button, gallery heading, per-story byline, no-picture placeholder, picture alt text, story counter, prev / next labels, download buttons (see §24).
- `playerLost.*` — "<name> exited" label, ignore button, create-a-new-room button (see §12).
- `footer.*` — GitHub-link label and content-responsibility notice (see §27).
- `errors.*` — one key per error code from §5 plus the new codes added in §17: `INVALID_NICKNAME`, `RATE_LIMITED`, `SERVER_BUSY`.
- `validation.*` — nickname-too-short, nickname-too-long, nickname-empty.

### Language switcher

On `HomeScreen`, the language selector sets the room language and is shown **only in Create mode** (§8) — it is the host's choice. It is a **flagged list**: one row per language showing the language's flag emoji and its native name ("English", "Русский"), rendered from the `client/src/languages.ts` registry (`{ code, name, flag }` per language). That registry is the single source for the language list — the selector and the `?lang=` URL check both derive from it. Join mode does not show the selector: a joining player inherits the room's language automatically (the `room:join` ack carries the room `language`). Optionally, the invite link may carry the room language as `?room=<CODE>&lang=<code>` so the join screen renders in the room's language before the join completes; the flow is correct without it.

---

## 10. Image prompt builder (`server/src/prompt.ts`)

```typescript
function buildPrompt(story: Story, language: Language): string {
  const a = story.answers.map(ans => ans ?? 'something surprising');
  // Fill the per-language imagePrompt template (server/src/i18n/<lang>.json)
  // — a natural sentence using slots 0-4 only. Slots 5 and 6 stay in the
  // prose but are excluded from the image prompt.
  const narrative = IMAGE_PROMPT_TEMPLATES[language].replace(
    /\{([0-6])\}/g,
    (_, digit) => a[Number(digit)] ?? '',
  );
  const style = ', in a goofy cartoon style, googly eyes, exaggerated expressions, ' +
                'bright colors, hand-drawn doodle illustration';
  const prompt = narrative + style;
  return prompt.length > 500 ? narrative.slice(0, 500 - style.length) + style : prompt;
}
```

The per-language `imagePrompt` templates (locked):

```
en: "{0} {1} {4}, {2}, {3}"
ru: "{4}: {0} {1}, {2}, {3}"
```

The two templates **deliberately differ**. English keeps the
subject-then-action sentence order from item 18 — Flux's text encoder
handles that English form well. Russian instead front-loads the action
verb with a caption-style colon delimiter (item 2 of
the triage backlog): Cyrillic tokenises larger under CLIP's
BPE encoder (~2–3× more tokens for the same meaning) and the encoder
weights Russian tokens less strongly than English ones, so a Russian
action verb at mid-prompt position gets silently truncated or
under-weighted. Front-loading puts it where positional attention is
strongest and truncation hits last. The colon mimics the *"subject:
scene-details"* caption pattern that's heavily represented in Flux's
training data.

### Russian-only English-keyword hint (option B)

The template reorder above (option A, v4.27.0) was empirically
insufficient — real-room testing showed Russian action verbs still
went missing from most generated pictures. The deeper problem is the
English/Russian attention asymmetry in CLIP itself, which reordering
doesn't bridge. `server/src/promptHints.ts` adds a second layer:

- A small lexicon (~50 entries) maps Russian visual-action
  substrings to short English keyword strings. Stems are 4+
  characters and chosen to minimise collisions with unrelated words
  (e.g. *"лыж"* → *"skiing on snow"*; *"машин"* → *"in a car"*;
  *"плава"* → *"swimming in water"*; *"танц"* → *"dancing"*).
- When the slot-4 (action) value contains any lexicon substring,
  `ruActionHint` returns a comma-joined string of the matching
  English keywords (de-duplicated, lexicon order). `buildPrompt`
  prepends that string to the assembled narrative, in front of the
  optional "two of them, " duplicate-subject anchor's
  *next-to-narrative* position. The Russian content is **untouched**
  in both the prompt and the prose — the hint only adds an English
  visual anchor that CLIP weights more strongly than the Cyrillic.
- False positives at this layer cost a slightly bloated prompt; the
  Russian content is still there for the model to fall back on. The
  bias is toward over-matching. Lexicon entries are easy to add or
  remove; the contract is "substring matches → hint added", nothing
  more.
- Resolution order in the final prompt: `[two of them,] [english
  hint,] [russian narrative][english style suffix]`.

This is option B of item 2 in the triage backlog. If
empirical testing still shows missing action verbs after both A and
B, the next escalation is option C — Worker-side translation of the
narrative via `@cf/meta/m2m100-1.2b`. C is intentionally not yet
implemented; B is meant to be reverted as a single commit if it
doesn't move the needle, keeping A in place.

Notes:

- Answers are used verbatim — no translation, no language detection.
- The narrative is a per-language template, not a list of comma-
  separated noun phrases. Flux is trained on natural language and on
  image captions; the templated forms read to its text encoder as
  descriptions rather than fragments. **The English and Russian
  templates differ on purpose** — see the locked-templates block above
  for the rationale. Languages added later may need their own
  template; do not assume the English layout transplants cleanly.
- The template uses **slots 0–4 only**. Slots 5 ("what for") and 6 ("what
  was at the end") often produce abstract content that does not translate
  into pixels ("because the warranty said not to") — they remain in the
  player-facing prose (§9) but not in the image prompt, freeing ~20 CLIP
  tokens for the visual slots that matter. The picture and the prose
  intentionally diverge slightly.
- The **action slot (4) is placed ahead of the where/when slots**, so it
  sits earlier in the prompt where the text encoder weights tokens most
  strongly.
- The style suffix is always English — it anchors Flux's visual output
  regardless of answer language. It deliberately does **not** include any
  negative-form phrases ("no text", "no words"): CLIP-conditioned models
  interpret negation poorly, and naming the unwanted concept tends to
  reinforce it (see §22).
- Cap total length at 500 characters. Truncate `narrative` only, never
  the style suffix.
- Called server-side when `reveal:requestPicture` is received; the room's
  language is passed in.

### Duplicate-subject anchor

When slot 0 ("Who?") and slot 1 ("With whom?") plausibly refer to the
same subject — *mouse / with a mouse*, *a tiny mouse / with a giant
mouse*, *мышь / с мышью* — `buildPrompt` prepends a literal English
`"two of them, "` to the assembled narrative before the style suffix.
This is a count anchor for the diffusion model: without it, Flux tends
to render a single subject when the prompt repeats it (the encoder's
attention layers collapse the duplication). The prefix is English in
all languages — Flux's training data is English-heavy and a clear
counting directive works as a steering signal regardless of the rest
of the prompt's language.

Detection is intentionally cheap and conservative
(`server/src/prompt.ts` — `looksLikeSameSubject`): both slots are
lower-cased, leading "with" / "с" / "со" plus any article are stripped,
and the result is accepted as a duplicate on either an exact string
match or a head-noun stem match (last token, first 4 characters — wide
enough to absorb Russian declension, narrow enough to skip short
function words). The null-fallback pair ("something surprising" /
"something surprising") does not trigger the anchor — the check runs
on the raw `story.answers` values, not the post-fallback array.

False positives at this layer cost an extra "two of them, " prefix on a
prompt that didn't need it (harmless); false negatives leave the
visual collapse untreated. The bias is toward catching duplicates.

---

## 11. Image generation (`server/src/image.ts`)

```typescript
const MAX_RETRIES = 2;
const TIMEOUT_MS  = 15_000;

async function generateImage(prompt: string): Promise<string> {
  const workerUrl = process.env.CLOUDFLARE_WORKER_URL!;
  const secret    = process.env.CLOUDFLARE_WORKER_SECRET!;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await Promise.race([
        fetch(`${workerUrl}/generate?prompt=${encodeURIComponent(prompt)}`, {
          headers: { 'X-Secret': secret },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
        ),
      ]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = await res.arrayBuffer();
      const b64    = Buffer.from(buffer).toString('base64');
      // Derive the media type from the Worker's response — Flux Schnell
      // returns JPEG (see §15), older models PNG. Do not hard-code it.
      const contentType = res.headers.get('content-type') ?? 'image/png';
      return `data:${contentType};base64,${b64}`;
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('unreachable');
}
```

### Socket handler

```typescript
socket.on('reveal:requestPicture', async () => {
  const story = getStoryForPlayer(room, socket.id);
  if (!story) return;

  if (story.pictureUrl) {
    // Already generated (double-click or retry after success).
    socket.emit('reveal:pictureReady', { pictureUrl: story.pictureUrl });
    return;
  }

  try {
    const pictureUrl = await generateImage(buildPrompt(story));
    story.pictureUrl = pictureUrl;  // write-once cache
    socket.emit('reveal:pictureReady', { pictureUrl });
  } catch {
    socket.emit('reveal:pictureError', { message: 'Generation failed. Try again.' });
  }
});

// reveal:retryPicture is identical — handled by the same function
socket.on('reveal:retryPicture', /* same handler */);
```

`story.pictureUrl` is write-once. Once set, the same data URL is returned for any subsequent requests (including the retry path). This satisfies the no-regeneration requirement.

**Auto-triggered, and retained for the gallery.** As of the room-gallery feature (§24), the client emits `reveal:requestPicture` automatically when the reveal screen opens — there is no "Generate Picture" button (§8). The cached `story.pictureUrl` is also what the room gallery serves to every player, so a generation that finishes after the player has already left the reveal screen is still captured. When the gallery has already been shared, completing a picture re-broadcasts `gallery:ready` so the gallery self-heals.

### Server-side generation for bot-owned stories

Bots have no client and therefore never emit `reveal:requestPicture`. Without an extra trigger their stories would stay picture-less and the room gallery (§24) would show a visible gap next to the bot's prose. To close that gap (the triage backlog item 3), `game.ts` exports `generateBotStoryPictures(room, io)`, called from two places:

- **End of `enterRevealPhase`** — for players who were already bots before reveal started (joined-as-bot edge cases and disconnects past the §7 grace window during the writing phase).
- **`finalizePlayerRemoval` in `index.ts`** — when a player botifies *during* reveal, after the §7 grace window expires. Their story already exists with bot-filled answers; this call ensures it also gets a picture.

The function iterates `room.players` in order, skipping non-bot slots and bot slots whose story already has a `pictureUrl` (the write-once cache makes it idempotent). Each bot story goes through the same core pipeline as a human request: build prompt → safety guards → daily-cap reservation → Worker call → store on `story.pictureUrl`. Bots and humans share the same daily cap; the bot loop runs **sequentially** rather than in parallel so a multi-bot room can't burn the last few slots in a single tick at the expense of any human still waiting. If the cap returns `false`, the loop exits immediately. If a bot picture lands and the gallery has already been shared, `gallery:ready` is re-broadcast just as it is on the human path.

No socket events are emitted for bot-owned outcomes — there is no client to receive them. The picture surfaces purely through the gallery payload (`buildGallery`).

### Daily image cap

`server/src/image.ts` enforces a process-global daily ceiling on image
generation to protect the Cloudflare Workers AI free tier (see §15).
Cloudflare gives no notification when the free
Neuron budget is exhausted, and on the Workers Paid plan overage is billed
automatically with no built-in spend cap — so the only provider-independent
guarantee is an app-level counter.

```typescript
const MAX_IMAGES_PER_DAY = Number(process.env.MAX_IMAGES_PER_DAY ?? 25);

let imagesToday = 0;
let dayKey = utcDayKey(); // e.g. "2026-05-20"

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Returns false when the daily ceiling is already reached. On success the
// slot is reserved (counter incremented) BEFORE the Worker call is awaited,
// so concurrent requests from different rooms cannot overshoot the cap.
function reserveImageSlot(): boolean {
  const today = utcDayKey();
  if (today !== dayKey) {
    dayKey = today;
    imagesToday = 0; // reset at 00:00 UTC
  }
  if (imagesToday >= MAX_IMAGES_PER_DAY) return false;
  imagesToday++;
  return true;
}
```

Rules:

- **Server-wide, not per-room.** `imagesToday` is a single module-level
  variable shared by every room. The Cloudflare Neuron budget is account-wide,
  so a per-room cap would multiply (`rooms × cap`) and cap nothing.
- **Reserve before the `await`.** `reserveImageSlot()` increments the counter
  before `generateImage()` calls the Worker, so several concurrent
  `reveal:requestPicture` events cannot all pass the check and overshoot.
- **Count attempts, not successes.** A failed Worker call may still have
  consumed Neurons, and refunding failures would let an abuser dodge the
  counter. The slot is not returned on failure.
- **Reset at 00:00 UTC.** The counter resets when the UTC day changes,
  matching Cloudflare's free-tier daily reset.
- **Cap hit → no Worker call.** When `reserveImageSlot()` returns `false`,
  `reveal:requestPicture` / `reveal:retryPicture` skip the Worker entirely and
  emit `reveal:pictureError` with a friendly "daily limit reached, try again
  tomorrow" message.
- **Persisted to Cloudflare Workers KV by the Worker.** The Render
  server's `imagesToday` is in-memory and resets on each cold start (the
  free tier spins down after ~15 min idle). To stop the host's
  "Images today" counter from lying to "0 / 25" after a spin-down, the
  Cloudflare Worker (`cloudflare/worker.js`) bumps a KV key
  `count:YYYY-MM-DD` after every successful `flux-1-schnell` call. A
  new `GET /stats` Worker endpoint returns `{ date, count }` from KV.
  The Render server (`server/src/image.ts`) calls this endpoint
  eagerly at startup and lazily on `stats:get` (~30 s TTL), then
  surfaces `max(local, worker)` from `imagesGeneratedToday()`. The
  local counter remains authoritative for `reserveImageSlot()` so the
  reservation is race-free within a process. The cap check uses the
  same `max(local, worker)`, so a cold-started process whose KV count
  is already at the limit correctly refuses new reservations on the
  first request. KV has no atomic increment, so two concurrent
  generations could under-count by 1 in a rare race — the local
  counter still tracks the bump, so `max(local, worker)` stays
  monotonic and player-visible. Vol02 follow-up to
  the triage backlog item 22 (option B of that analysis).
  See [Cloudflare KV setup](#cloudflare-kv-setup-stats_kv) below.

The handler checks `story.pictureUrl` first (a cached picture costs nothing
and is returned without consuming a slot), then `reserveImageSlot()`.

### Cloudflare KV setup (`STATS_KV`)

One-time, per deployment. The KV namespace persists the daily image
counter across Render restarts.

```
cd cloudflare
wrangler kv namespace create STATS_KV
wrangler kv namespace create STATS_KV --preview
```

Each command prints an `id = "…"` line. Paste the production ID and
the preview ID into the matching placeholders in
`cloudflare/wrangler.toml`. Then `wrangler deploy`. The Worker's
`/generate` and `/stats` endpoints both use the same `WORKER_SECRET`
header check; no additional secret is required.

Free tier covers our usage by ~100×: writes ~25/day vs 1 000/day
per-key limit; reads ~300/day vs 100 000/day limit. KV values carry a
48 h `expirationTtl` so yesterday's key is garbage-collected
automatically.

### Cap-reached UX (lobby banner + reveal caption)

Both the host and players are told when the cap is exhausted, with an
approximate hours-until-reset count (item 4 of the triage backlog).
Two surfaces:

- **Lobby banner.** Every client in the lobby subscribes to the live
  `stats:update` broadcast (§26). When `imagesGeneratedToday >= imagesLimit`,
  a yellow-amber banner appears above the Start button explaining that
  picture generation is unavailable for ~N hours and that the game can
  still be played (players will see story text in place of cartoons).
  The host gets an extra line: "Tap Start Game when ready, or wait until
  the daily cartoon allowance resets." The Start button is **not**
  disabled — the host chooses whether to play picture-less or wait.
- **Reveal caption.** The `reveal:pictureError` payload now carries an
  optional `code: 'CAP_REACHED' | 'GENERIC'` discriminator alongside the
  legacy `message` string. The server emits `code: 'CAP_REACHED'` from
  the cap branch of `handlePictureRequest`; clients that read `code`
  switch to the i18n'd "The cartoon oven is full. New cartoons in ~N
  hours." caption. Clients that don't read `code` (forward-compat) fall
  back to the English `message` as before.

Hours-until-reset is computed client-side via `hoursUntilUtcMidnight()`
in `client/src/capReset.ts`: `Math.ceil((nextUtcMidnight - now) / 3_600_000)`,
floor-clamped to 1 so a near-midnight value never displays as "0 hours".
The minimum we ever show is "1 hour"; the UI hedges with "~N hours" so
the approximation is honest. Computed locally rather than sent from the
server to avoid an extra payload field for a value the client can derive
from UTC arithmetic alone.

The legacy English `message` stays on the wire as a forward-compat
fallback so older clients still show something sensible. The Russian
caption is `client/src/i18n/ru.json#reveal.capReached`; English is
`client/src/i18n/en.json#reveal.capReached`. Both use the same
`{{hours}}` placeholder.

---

## 12. Pre-bundled finale image

`monkeys-on-bus.png` is a **design-time asset, not a runtime artefact**. It is produced once by the designer (or implementer) and committed to the repository under `client/public/monkeys-on-bus.png`. It ships with every deployment. The Cloudflare Worker is **not** called for this image at any point — not at build, not at deploy, not at runtime.

Acceptable production methods (any one):

- Hand-drawn SVG exported to PNG.
- A one-off generation via any image tool the designer prefers, saved as a regular PNG.
- A locally-run curl against the deployed Worker during development, *if* the designer chooses this — but the resulting file is then treated as a normal committed asset, not as a build artefact.

Dimensions: 1024×1024 or 1024×768, PNG, optimised (≤ 200 KB). The end screen loads it as a static asset.

---

## 13. PWA setup

- `vite-plugin-pwa` with `registerType: 'autoUpdate'`.
- Manifest: `name: "Funny Stories"`, `short_name: "FunnyStories"`, `display: "standalone"`, `theme_color: "#fef3c7"`, `orientation: "portrait"`.
- Service worker precaches the **hashed asset bundle** (JS, CSS, images, manifest) and the Google Fonts files. It does **not** precache `index.html`, socket events, or base64 image data URLs (they are ephemeral, delivered over the socket).
- Add `<meta name="apple-mobile-web-app-capable" content="yes">` for iOS standalone mode.

### Stale-cache strategy

A naive precache of `index.html` plus `registerType: 'autoUpdate'` is a
trap: the SW silently updates in the background, but the currently-loaded
page stays on the *old* shell until the user manually refreshes — which
most won't. Two layered measures keep the deployed app fresh:

1. **NetworkFirst navigation rule** (`client/vite.config.ts`). Every
   navigation request (`request.mode === 'navigate'`) goes to the
   network first with a 3-second timeout; the cached shell is the
   fallback. So a fresh visit after a deploy lands directly on the new
   build. The HTML is intentionally excluded from `globPatterns` so
   the precache does not serve a stale copy first.
2. **Auto-reload on SW takeover**
   (`client/src/swReload.ts`, installed from `main.tsx`). When the new
   service worker activates while the page is loaded, the controller
   change fires a one-shot `window.location.reload()`. The refresh
   guard prevents the initial `controllerchange` (first-ever SW claim)
   from looping.

Together: the network-first rule covers "user opens the app after a
deploy"; the reload listener covers "user has the tab open through a
deploy." Both are required — without the listener, a long-lived host
session would not pick up a deploy until they navigated away and back.

Operators running with a particularly poor network may notice a 3-second
first-paint pause in degraded mode; this is the deliberate tradeoff for
guaranteed freshness, and is acceptable because the game requires a
working websocket connection to play anyway.

---

## 14. Render deployment

`render.yaml`:

```yaml
services:
  - type: web
    name: funny-stories
    runtime: node
    plan: starter
    buildCommand: npm install --include=dev && npm run build
    startCommand: npm run start
    envVars:
      - key: NODE_VERSION
        value: "20"
      - key: NODE_ENV
        value: production
      - key: CLOUDFLARE_WORKER_URL
        sync: false   # set in Render dashboard after deploying the Worker
      - key: CLOUDFLARE_WORKER_SECRET
        sync: false   # set in both Render dashboard and Cloudflare Worker env
      - key: DEPLOYER_DONATE_URL
        sync: false   # optional; set in Render dashboard if you want a "Support this server" button on the end screen
      - key: MAX_ROOMS
        sync: false   # optional; default 500 if unset
      - key: MAX_IMAGES_PER_DAY
        sync: false   # optional; default 25 if unset — daily Cloudflare AI image ceiling (§11, §17)
```

Root `package.json` scripts:

- `build`: `vite build` (client → `client/dist/`) then `tsc -p server/tsconfig.json` (server → `server/dist/`).
- `start`: `node server/dist/index.js`.

Server listens on `process.env.PORT || 3000`. Fastify and Socket.IO share one HTTP server instance.

---

## 15. Cloudflare Worker

The Worker lives in `cloudflare/` and is deployed separately from the Render service.

### `cloudflare/worker.js`

```javascript
export default {
  async fetch(request, env) {
    // Shared-secret check — prevents public abuse of the free tier.
    const secret = request.headers.get('X-Secret');
    if (!secret || secret !== env.WORKER_SECRET) {
      return new Response('Forbidden', { status: 403 });
    }

    const url    = new URL(request.url);
    const prompt = url.searchParams.get('prompt');
    if (!prompt) return new Response('Missing prompt', { status: 400 });

    let result;
    try {
      result = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
        prompt,
        steps: 4,   // minimum; lowest neuron cost on the free tier — never raise
      });
    } catch (err) {
      return new Response(`AI error: ${err}`, { status: 502 });
    }

    // Flux Schnell returns { image: "<base64>" }. Decode to raw bytes so the
    // Render server can arrayBuffer() it directly. Older Workers AI image
    // models returned a raw byte stream — handle that as a fallback.
    if (result && typeof result === 'object' && typeof result.image === 'string') {
      const bytes = Uint8Array.from(atob(result.image), (c) => c.charCodeAt(0));
      return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg' } });
    }
    return new Response(result, { headers: { 'Content-Type': 'image/png' } });
  }
};
```

### `cloudflare/wrangler.toml`

```toml
name            = "funny-stories-image"
main            = "worker.js"
compatibility_date = "2025-01-01"

[ai]
binding = "AI"

# Set WORKER_SECRET via: wrangler secret put WORKER_SECRET
# Then set the same value as CLOUDFLARE_WORKER_SECRET in Render dashboard.
```

### Deploy steps

1. `npm install -g wrangler`
2. `wrangler login`
3. `cd cloudflare && wrangler deploy`
4. `wrangler secret put WORKER_SECRET` — enter a strong random string (e.g. `nanoid(32)`)
5. Note the deployed Worker URL: `https://funny-stories-image.<account>.workers.dev`
6. In the Render dashboard, set:
   - `CLOUDFLARE_WORKER_URL` = the Worker URL above
   - `CLOUDFLARE_WORKER_SECRET` = the same secret from step 4

### Free tier limits

| Resource | Free allowance | Usage per game (7 players) |
| :--- | :--- | :--- |
| Worker requests | 100,000 / day | 7 |
| Workers AI neurons | ~10,000 / day | ~2,100–4,200 (300–600 × 7) |
| Images per day | ~15–30 | One full game ≈ 2–5 neurons budget |

Adequate for personal use and small friend groups. Document in README.

---

## 16. Build order

Do these in order. **Verify each step before moving to the next.**

1. **Workspace skeleton.** Root `package.json` with `workspaces: ["client","server","shared"]`. Stub `package.json` in each. `tsconfig.base.json`. Run `npm install` — must complete cleanly.

2. **Shared types.** `shared/events.ts` — all payload interfaces, `Room`, `Player`, `Story`, `Language`.

3. **Server bootstrap.** Fastify + Socket.IO on a configurable port. `GET /health` → `{ ok: true }`. CORS allowed for `http://localhost:5173` in dev.

4. **Room lifecycle.** Implement `room:create`, `room:join`, `room:leave`, `lobby:update`. In-memory `Map<string, Room>`. **Unit-test the rotation formula** — write 5 assertions for `storyIndex(P, R, N)` with known inputs before moving on.

5. **Client: Home + Lobby.** Vite + React + Tailwind. `HomeScreen` (two modes — Create vs. Join — selected by the `?room=` URL parameter; see §8). `LobbyScreen` (player list, room code, QR, copy-link, Start button). No game logic yet. **Manual test:** open two browser tabs, create a room in one, open the invite link (`/?room=<CODE>`) in the other, verify the second tab shows Join mode and both see each other's nicknames.

6. **Round flow.** `game:start`, `round:start`, `round:submit`, bot auto-fill on disconnect and timer expiry. `RoundScreen` + `WaitingScreen`. **Manual test:** run a full 3-player, 7-round game in 3 tabs with no profanity filter or reveal yet. Verify that `storyIndex` puts the right answers in the right story slots.

7. **Profanity filter.** Wire `obscenity` and `bad-words-next` into the submit handler. **Test:** submit known bad words in both English and Russian, verify silent stand-in replacement.

8. **Cloudflare Worker.** Deploy `cloudflare/worker.js`. Test it directly with curl. Implement `server/src/image.ts`, including the **daily image cap** (`MAX_IMAGES_PER_DAY`, process-global counter, UTC reset, reserve-before-await — see §11 and §17). Wire `reveal:requestPicture` and `reveal:retryPicture` handlers. **Test:** timeout fallback (point `CLOUDFLARE_WORKER_URL` at a dead URL, verify `reveal:pictureError` is emitted and the client shows the retry button); and cap behaviour (set `MAX_IMAGES_PER_DAY=1`, verify the second request emits `reveal:pictureError` without calling the Worker). Note: the finale image `monkeys-on-bus.png` is **not** generated by the Worker — it is a design-time asset checked into `client/public/` (see §12).

9. **Reveal screen.** `reveal:start` sends `{ answers, prose }` per player. `RevealScreen` shows prose with highlighted phrases; picture generation is auto-triggered when the screen opens (no button), with the 3-second-delayed wait control, image fade-in, and error state (see §8 and §11).

10. **End screen + restart + room gallery.** Host buttons, Ready toggle, `game:restart` (drops bots, resets stories), `game:end`. Also the room gallery (§24): the host's "Share the room's pictures" button, the `gallery:share` / `gallery:ready` events, and the browsable gallery section embedded on the end screen.

11. **PWA.** Manifest, service worker, icons. Icons (`icon-192.png`, `icon-512.png`) are implementer-drafted from one of the mascot SVGs in §21, exported at both sizes. Flag in PR description for human design review post-launch. **Test:** "Add to Home Screen" on a real iPhone and a real Android device.

12. **Russian localization.** `ru.json` for client and server. Language switcher on `HomeScreen`. **Test:** full game in Russian — all strings, questions, stand-ins, and prose in Russian.

13. **Polish.** Framer Motion transitions (forward direction per §17), bot indicator in player list, deployer-controlled donation button on end screen (driven by `DEPLOYER_DONATE_URL` env var, hidden when unset), funny SVG mascot pass (background doodle, bot avatar, timer character, submit-confirm mascot, waiting mascot, picture-arrival flourish, end-screen mascots, error-state mascot — see §21), wordmark, final visual pass.

14. **Deploy.** Push to Render. Set env vars in dashboard. Run acceptance test on real phones. **Docker artefacts (implementer-drafted in this step):** create `Dockerfile`, `docker-compose.yml`, and `.dockerignore` at the repo root so self-hosters have a second deployment path alongside Render. Constraints:
    - Single-stage `node:20-alpine` base. Multi-stage is fine if it actually shrinks the image; otherwise don't bother.
    - `npm ci` then `npm run build`, then run `node server/dist/index.js`. The client bundle is served as static assets by the same Fastify process (per §14) — no separate static-file image, no nginx sidecar.
    - Exposes one port (`3000`). No volumes. Stateless container.
    - `docker-compose.yml` reads the same env vars as the Render service (`CLOUDFLARE_WORKER_URL`, `CLOUDFLARE_WORKER_SECRET`, optional `DEPLOYER_DONATE_URL`, optional `MAX_ROOMS`) from a `.env` file at the repo root. Ship `.env.example`.
    - `.dockerignore` excludes `node_modules`, `client/dist`, `server/dist`, `.git`, `.env`, `docs/screenshots`.
    - **Cloudflare Worker is not dockerised.** It stays a separate `wrangler deploy` artefact per §15.
    - Document usage in `README.md` (already drafted). Do not add a Docker subsection to §14 of this spec — the `render.yaml` is still the canonical hosted-deployment template; Docker is an alternative, not a replacement.

---

## 17. Hard constraints and limits

These are validation rules that cross-cut the data model (§4), socket events (§5), and UI (§8). They must be enforced server-side; client-side enforcement is for UX only and is not trusted.

### Nickname

- Length: **3–20 characters** after trimming.
- Trim leading and trailing whitespace before validating and storing.
- Must contain at least one non-whitespace character (redundant after trimming + min length, but stated explicitly).
- No profanity filter on nicknames — the nickname is the player's chosen identity. The profanity filter (§6) applies only to round answers.
- On violation: reject `room:create` / `room:join` with `error` event `{ code: 'INVALID_NICKNAME', message: '...' }`. Client surfaces inline validation.

### Answer textarea

- Hard cap: **70 characters**. Enforce both client-side (textarea `maxLength={70}`) and server-side (truncate to 70 on `round:submit` before the profanity filter runs).
- Soft counter visible in the bottom-right of the textarea, e.g. `42 / 70`. Counter turns amber at 60 and red at 70.
- Empty submission remains allowed (treated as auto-fill / timeout per §1).

### Room code alphabet

- 6 characters drawn from `"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"` (32 chars; no `0`/`O`, no `1`/`I`/`L`, ambiguous pairs removed).
- Implementation: `customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6)` from `nanoid`.
- Always uppercase. Joining accepts lowercase input and uppercases before lookup.

### Rate limits (in-memory token bucket, no Redis)

- `room:create`: **max 5 per IP per minute**.
- `room:join`: **max 30 per IP per minute**.
- Implement as a `Map<ip, { tokens, lastRefill }>` with a periodic sweep (e.g. every 60 s) to evict stale entries. On rate-limit hit, emit `error` `{ code: 'RATE_LIMITED', message: '...' }` and do not process the event.
- Behind Render's proxy: read the client IP from `x-forwarded-for` (first hop). Document this assumption — operators behind a different proxy chain may need to adjust.

### Server capacity ceiling

- **Max rooms per server process: 500.**
- On exceeding the ceiling, reject new `room:create` with `error` `{ code: 'SERVER_BUSY', message: '...' }`.
- This is a soft safety rail for a single Render starter instance, not a hard memory limit. Operators with larger plans can raise it via an env var (`MAX_ROOMS`, default 500).

### Daily image-generation ceiling

- **Max images generated per server process per UTC day: 25 (`MAX_IMAGES_PER_DAY`, default 25).**
- Enforced by a process-global counter in `server/src/image.ts`, shared across **all rooms** — the Cloudflare Workers AI Neuron budget is account-wide, not per-room, so a per-room cap would multiply and cap nothing.
- The counter resets at **00:00 UTC**, matching Cloudflare's free-tier daily reset.
- The slot is reserved (counter incremented) **before** the Worker call is awaited, so concurrent `reveal:requestPicture` events cannot overshoot the cap. **Attempts are counted, not successes** — a failed generation may still have consumed Neurons.
- On reaching the ceiling, `reveal:requestPicture` / `reveal:retryPicture` do **not** call the Worker; the server emits `reveal:pictureError` with a friendly "daily limit reached" message. A picture already cached in `story.pictureUrl` is still returned and does not consume a slot.
- This is a soft safety rail protecting the Cloudflare Workers AI free tier. Operators on the Workers Paid plan can raise it; operators on the Free plan get graceful degradation before Cloudflare hard-fails the request. See §11.

### Bot auto-fill source

When a player disconnects mid-round (per §7) or the round timer expires before they submit, the server auto-submits an answer on their behalf. The auto-submit value is **a random stand-in for the current question index**, sourced from the existing per-language stand-ins list in §6. This reuses the same machinery already in place for profanity replacements — no separate "bot phrases" file. Empty-string submissions from a live (non-bot) player are still allowed and pass through unchanged; auto-fill applies only to bots and timer expiry.

### Phase transition animations

Framer Motion slide-fade transitions between screens use a single locked direction: **forward = slide left-to-right** (new screen enters from the left, old screen exits to the right). There is no "restart" direction — `game:restart` reuses the same forward transition. Specific transitions:

- `HomeScreen` → `LobbyScreen` — forward.
- `LobbyScreen` → `RoundScreen` (on `game:start`) — forward.
- `RoundScreen` → `WaitingScreen` (on `round:submit`) — forward.
- `WaitingScreen` → `RoundScreen` (next round) — forward.
- Final round → `RevealScreen` — forward.
- `RevealScreen` → `EndScreen` — forward. Triggered by the player's self-paced "Continue" button (§8); each player's reveal is private, so there is no synchronized reveal→end transition.
- `EndScreen` → `RoundScreen` (on restart) — forward.

### Validation summary

| Constraint | Value | Enforcement |
| :--- | :--- | :--- |
| Nickname length | 3–20 chars (trimmed) | Server: hard reject. Client: inline hint. |
| Answer length | 70 chars max | Server: truncate. Client: `maxLength` + counter. |
| Room code alphabet | 32 unambiguous chars | Server: `customAlphabet`. Client: uppercase on input. |
| `room:create` rate | 5 / IP / min | Server only. |
| `room:join` rate | 30 / IP / min | Server only. |
| Concurrent rooms | 500 default, `MAX_ROOMS` env override | Server only. |
| Images per UTC day | 25 default, `MAX_IMAGES_PER_DAY` env override | Server only (process-global). |

---

## 18. Things NOT to do

- Do **not** add user accounts or auth of any kind.
- Do **not** persist stories or pictures. In-memory only.
- Do **not** add a regenerate-picture button. `pictureUrl` is write-once.
- Do **not** call Workers AI from the client. All AI calls are server-side.
- Do **not** use external profanity APIs. Local libraries only.
- Do **not** add a general reconnect, account system, or persistent identity token. A *bounded* connection-state-recovery grace window is allowed and expected (§7); beyond the window, disconnect = bot.
- Do **not** allow late-join after `game:start`.
- Do **not** run multiple Render instances without adding Redis pub/sub first.
- Do **not** show the style suffix to players.
- Do **not** expose `CLOUDFLARE_WORKER_SECRET` to the client.
- Do **not** increase Flux `steps` above 4 — the free neuron budget is the hard constraint.
- Do **not** hardcode any donation, payment, or sponsor URL in `EndScreen.tsx` or anywhere else in the built client. End-user-facing donation buttons must be deployer-controlled via the `DEPLOYER_DONATE_URL` env var. Hardcoded author donation links route end-user payments through the upstream author and break the legal separation that protects upstream authors of self-hosted forks (see the project's distribution-model analysis).

---

## 19. Acceptance test

Pass when verified on **real iPhone Safari and real Android Chrome** over the **live Render URL**:

1. Player A creates an English room. Sees a 6-char code, a working "Copy link" button, and a QR code.
2. Players B and C scan the QR or paste the link. Type nicknames. All three see each other in the lobby.
3. A starts the game. All three see "Who?" with a 60-second timer bar.
4. All submit answers through all 7 rounds.
5. A player who submits a profane answer sees their story proceed normally. Their teammates' final prose shows a stand-in instead — the offender cannot tell.
6. After round 7: each player sees their story as prose with 7 highlighted phrases and a "Generate Picture" button.
7. Each clicks "Generate Picture". Spinner + "Summoning chaos…". Within 15 seconds a goofy cartoon fades in.
8. A sees "One more game" + "Finish Game". B and C see a Ready toggle.
9. B and C tap Ready. A taps "One more game". All return to round 1 with the same room code and fresh stories.
10. A taps "Finish Game". All three see "Game is over" with the monkeys-on-bus image.
11. Player B closes their tab mid-game. A and C see B marked as a bot. The game completes with B's answers auto-filled.
12. Create a Russian room. All UI strings, questions, stand-ins, and prose render in Russian. The image prompt to Workers AI contains Russian text; the cartoon still reflects the story content.
13. Simulate Workers AI failure (temporarily revoke the Worker secret). Clicking "Generate Picture" shows the error message and a "Try again" button. No crash or blank screen.

---

## 20. Implementation hints

- **Socket.IO rooms:** `io.to(roomCode).emit(...)` for broadcasts; `socket.emit(...)` for per-player private messages (`reveal:start`, `reveal:pictureReady`).
- **Timer:** server sets `deadline = Date.now() + 60_000`. Client computes remaining time from `deadline` using its own `Date.now()`. Do not tick a server-side interval.
- **All-submitted fast-path:** when the last human player submits, immediately clear the round timer and advance. Bots count as pre-submitted.
- **QR code URL:** `https://yourdomain.com/?room=ABCDEF`. On load, `HomeScreen` reads `?room=`; when present it renders Join mode for that code, when absent it renders Create mode (§8). The QR code and the copied invite link encode the same URL — they are one code path, and the only two ways to join a room.
- **Copy link:** `navigator.clipboard.writeText(url)`. Fallback for older iOS Safari: create a hidden `<textarea>`, select, `document.execCommand('copy')`.
- **Bot in player list:** `PlayerList` renders a `🤖` icon and 50% opacity for `isBot: true` entries.
- **Image data URL size:** a 512×512 Flux Schnell PNG converted to base64 is typically 250–700 KB as a string. A single picture is within Socket.IO's default 1 MB message limit. The room gallery (§24), however, sends every player's picture in one `gallery:ready` message — up to 7 — which can exceed 1 MB, so the Socket.IO server raises `maxHttpBufferSize` to 8 MB. If image weight becomes a concern, the Worker can encode as JPEG (`Content-Type: image/jpeg`).
- **Don't trust client clocks:** use server-sent `deadline` epoch ms + client `Date.now()` for the timer bar. Never send a "seconds remaining" integer.
- **Reveal prose vs. prompt:** `reveal:start` sends player-facing `prose` built from the **localized** prose template. `buildPrompt` builds a separate string for the AI. These are two different rendering paths — don't conflate them.
- **Deployer donation button:** `EndScreen.tsx` reads `donateUrl` from the server config (sourced from the `DEPLOYER_DONATE_URL` env var, included in the `lobby:update` payload). When non-empty, render a subtle anchor `<a href="{donateUrl}" target="_blank" rel="noopener noreferrer">{t('endScreen.supportServer')}</a>` below the monkeys image. When empty, render nothing. Style as subtle body text. No SDK, no modal, no obligation copy. The upstream author's own donation link (if any) belongs in `README.md`, not in the built client.

---

## 21. Funny SVG assets and wordmark

Per the project's "very funny, mobile-universal" graphics ambition, the following SVG assets are drafted by the implementer in step 13 and live under `client/src/components/art/`. Each is an inline React SVG component, animated via Framer Motion springs and CSS keyframes. No external dependencies, no Lottie, no Rive.

| Asset | Component | Where it appears | Animation |
| :--- | :--- | :--- | :--- |
| Background doodle | `BackgroundDoodle.tsx` | All screens (behind content) | Subtle wiggly lines, static or slow drift |
| Bot avatar | `BotAvatar.tsx` | `PlayerList` for `isBot: true` slots | Replaces 🤖 emoji; idle blink |
| Timer character | `TimerCharacter.tsx` | `TimerBar` (final 10 s) | Idle wobble → panicked shake at ≤10 s |
| Submit-confirm mascot | `SubmitConfirm.tsx` | After `round:submit` | Brief celebration spring |
| Waiting mascot | `WaitingMascot.tsx` | `WaitingScreen` | Idle goofy animation loop |
| Picture-arrival flourish | `PictureFlourish.tsx` | `RevealScreen` on `pictureReady` | Confetti / sparkle burst |
| End-screen mascots | `EndMascots.tsx` | `EndScreen` (alongside monkeys-on-bus) | Companion characters |
| Error-state mascot | `ErrorMascot.tsx` | `RevealScreen` on `pictureError` | Sad-but-funny idle |
| Wordmark | `Wordmark.tsx` | `HomeScreen` header | Fredoka in `#ec4899` with bounce on mount |

All implementer-drafted; flag the set in the step 13 PR description for human design review post-launch.

The wordmark text is **per-language**, not a locale-invariant brand name: `Wordmark.tsx` renders the `home.title` i18n key, so each language supplies its own wordmark — English "Funny Stories", Russian "ЧЕПУ-ХА-ХА". A new language defines its own in its locale file.

### PWA icons

`icon-192.png` and `icon-512.png` are exported from one of the mascot SVGs above. See §16 step 11.

### `monkeys-on-bus.png`

Design-time asset, not part of this SVG set. See §12.

---

## 22. Style suffix lock

The style suffix in `server/src/prompt.ts` is a **breaking-change-locked** string from the moment `v0.1.0` is tagged. The current suffix:

```
, in a goofy cartoon style, googly eyes, exaggerated expressions, bright colors, hand-drawn doodle illustration
```

Ships as-is in `v0.1.0`. Any change to this suffix after `v0.1.0` is a breaking change for downstream forks (their screenshot assets, README art, marketing material may all be regenerated against this exact suffix). Treat suffix changes accordingly: bump the major version, document in CHANGELOG, and announce in the release notes.

The trailing "no text, no words" that appeared in the v4.0.0–v4.18.0 versions of this section was removed in v4.19.0 (still pre-`v0.1.0`): CLIP-conditioned diffusion models interpret negation poorly, and naming an unwanted concept ("text") tends to reinforce it rather than suppress it. The suffix is now positive-only.

No bake-off is scheduled pre-launch. If post-launch evidence shows the suffix produces consistently disappointing results, that is `v1.0.0` material, not a patch.

### Accepted artefact: hallucinated painter-style signatures

Flux Schnell occasionally renders **nonsense hand-lettered marks** in the corners of generated cartoons — squiggles that look like a painter's signature but are not. Diffusion models trained on signed paintings and illustrations hallucinate signature-shaped glyphs they have no way of forming correctly; what appears is random letterforms, not the signature of any real artist or any copyrighted mark.

This is a **known and accepted artefact** as of v0.1.0 (item 1 of the triage backlog, resolved as option F — document and accept). Possible mitigations (positive-framing suffix rewrite, panel-framing directive, post-OCR rejection, model swap to Flux Dev/Pro) are recorded in the backlog but **deliberately not enabled** in v1. Players generally laugh at the squiggle rather than complain; the cost of any mitigation (false-positive corner crops, suffix lock under §22 after v0.1.0, Neuron-budget hit from a heavier model) is greater than the cost of the artefact.

**Intellectual-property position.** The hallucinated marks are not a learned reproduction of a real artist's signature, are not associated with any specific real artist, and are not intended as an impersonation or copyrighted mark. The operator/deployer remains responsible for the deployed content as a whole (§27, the project's distribution-model analysis); the signature artefact does not by itself create an IP conflict distinct from the broader generative-AI questions every operator of an image-generation product already navigates.

---

## 23. README content

Write this last. Include:

- One-paragraph description of the game.
- A GitHub Sponsors link at the top of the README, **as a placeholder** (`https://github.com/sponsors/oursharedcode`). The author replaces `oursharedcode` before tagging `v0.1.0`. Do **not** treat the placeholder as a build blocker — the rest of the README is complete without it.
- One-click deploy buttons for Render and Cloudflare Workers (two markdown image-link badges pointing to template URLs). Include in `v0.1.0`.
- Status badges: build, tests, license (AGPL-3.0), GitHub stars. Selection is implementer-drafted.
- Quick-start: `npm install` + `npm run dev` (note: image generation requires the Cloudflare Worker deployed and `CLOUDFLARE_WORKER_URL` + `CLOUDFLARE_WORKER_SECRET` set in a local `.env` file; add `.env` to `.gitignore`).
- Cloudflare Worker deploy steps (from §15).
- Render deploy steps (from §14).
- Deployer donation guidance: a section explaining that operators who want a "Support this server" button on the end screen of *their* deployment must set `DEPLOYER_DONATE_URL` to their own donation page (Buy Me a Coffee, Ko-fi, GitHub Sponsors, Patreon, YuMoney, etc.). The button only appears when this variable is set; donations go to the deployer, not to the upstream author. The upstream author is supported separately through the GitHub Sponsors link at the top of the README.
- How to add a new language: add `client/src/i18n/<lang>.json`, `server/src/i18n/<lang>.json`, extend the `Language` type, add an entry to the `client/src/languages.ts` registry (code, native name, flag), add stand-ins for all 7 question indices, add a profanity word list.
- Known limitations: single Render instance, no persistence, no reconnect (disconnect = bot), Workers AI free tier ~15–30 images/day.

---

## 24. Room gallery

After a game, the whole group can browse every player's story and its AI
picture together. This is the one place the otherwise-private reveal is shared.

### Flow

1. Picture generation is **automatic** (§8, §11): each player's reveal screen
   emits `reveal:requestPicture` when it opens — there is no "Generate Picture"
   button. The server caches each result in `story.pictureUrl` (§11).
2. On the end screen the **host** sees a "Share the room's pictures" button.
   The host may press it at any time — it is not gated on every picture being
   ready, since a player can reach the end screen before their picture finishes.
3. Pressing it emits `gallery:share`. The server sets `room.galleryShared` and
   broadcasts `gallery:ready` to **every** player in the room.
4. On `gallery:ready`, every client shows the **gallery section** embedded on
   the end screen: each story and its picture, browsable one at a time (prev /
   next, with a position counter).

### `gallery:ready` payload

```typescript
interface GalleryEntry {
  nickname: string;           // owner of this story slot
  isBot: boolean;
  answers: string[];          // the 7 answers, for phrase highlighting
  prose: string;              // rendered story in the room language
  pictureUrl: string | null;  // base64 data URL, or null — see below
}
interface GalleryReadyPayload { entries: GalleryEntry[]; }
```

One entry per player slot, in `players[]` order: `entries[i]` pairs
`players[i]` with `stories[i]` (the §4 rotation invariant).

### Privacy model

`reveal:start` and `reveal:pictureReady` are per-player private. The gallery is
the deliberate exception: `gallery:ready` carries every story and picture to
every client. It is broadcast **only** after the host explicitly shares — never
automatically — so opening up the room's content is an opt-in group action.

### Missing pictures

`pictureUrl` is `null` when no picture exists for a slot:

- **Bot slots** — bots never run a reveal screen, so they never generate a
  picture. Bot stories are still **included** in the gallery — they are real
  stories assembled from everyone's rotated answers.
- **Humans who skipped or failed** — a player can press "Continue" before their
  picture finishes, or generation can fail or hit the daily cap (§11).

The gallery renders a "no picture" placeholder for any `null` entry; the story
prose always shows.

### Download

Each gallery entry has a download button that saves the story as a single PNG,
composited client-side on a `<canvas>` from the already-delivered
`gallery:ready` data — no server round-trip. For an entry **with** a picture,
the PNG is the cartoon with the story prose rendered below it. For a
**picture-less** entry (a bot slot, or a skipped or failed generation), the PNG
is the story text alone. The file is named after the story's owner.

Every downloaded image carries a footer block — added in v4.33.0 as item 6
of the triage backlog ("the image is the marketing"):

- The **content-responsibility notice** in the active locale —
  `footer.contentNotice` from the i18n bundle, pulled live so the wording
  stays in sync with the in-app footer if either is ever edited. EN:
  *"Player answers and AI pictures are the responsibility of the operator
  of this server, not of the upstream project."* RU: the corresponding
  translation. This is the load-bearing legal piece: when the image leaves
  the operator's site and travels alone, the disclaimer travels with it.
- A **QR code** for `SOURCE_URL` (the upstream repo,
  [client/src/sourceUrl.ts](../client/src/sourceUrl.ts)) — same constant
  the in-app source footer uses, single source of truth.
- The **source label** (`footer.source`) and the **printed URL** beside
  the QR, so the link survives a screenshot-of-screenshot where the QR
  pixels may be too small to scan.

The QR library (`qrcode`) is loaded via dynamic `import()` so it stays out of
the main JS bundle — it only ships to a client that actually taps Download.
The QR is rendered in the same cream/ink palette as the rest of the
composite, with a 1-module quiet zone to keep it scannable from a phone
camera at ~96 px.

### Self-healing

Because the host may share before every picture is in, the gallery refreshes
itself: while `room.galleryShared` is set, each newly completed picture
re-broadcasts `gallery:ready` with the updated entries (§11). Clients keep the
viewer on the same entry index across refreshes.

### Transport

`gallery:ready` carries up to 7 base64 pictures in one message, which can exceed
Socket.IO's default 1 MB limit, so the server raises `maxHttpBufferSize` to
8 MB (§20).

### Reset

`room.galleryShared` is cleared at the start of every game (`startGame`), so a
"one more game" restart begins with no shared gallery.

---

## 25. Deployer logo stamp

Optional. A deployer can brand their instance by overlaying a small logo on
every generated picture.

### How it works

- The logo is a **bundled asset**: `client/public/deployer-logo.png`. The repo
  ships it as a **25×25 pixel PNG** derived from the app's `icon-512.png`.
  Deployers who don't want a stamp delete the file (or replace it with a 25×25
  fully-transparent PNG); the bundled default is intentionally visible so the
  feature is discoverable.
- An operator brands their instance by replacing that file with their own
  **25×25 PNG** and rebuilding the client. There is **no environment variable**
  — a bundled asset was chosen deliberately over a `DEPLOYER_DONATE_URL`-style
  env var, so `render.yaml` is unaffected.
- The logo is a **client-side overlay** (the `LogoStamp` component): it is
  drawn over the picture on the reveal screen and in the room gallery (§24).
  It is **not** baked into the image pixels — it is a display overlay only.
- Position and rendering: bottom-right corner, **rendered at native 25×25
  pixels** (no CSS upscaling), `opacity: 0.8`, `pointer-events: none`. The
  intentional smallness keeps the stamp from competing with the cartoon
  content; pixel-level branding is preserved because the source is not
  resampled by the browser.

### Notes

- The size is locked at 25×25. Changing it requires updating both
  `client/public/deployer-logo.png` (the PNG dimensions) and
  `client/src/components/LogoStamp.tsx` (the `width`/`height` attributes) in
  lockstep — a deployer who ships a 64×64 PNG against a 25×25 component will
  see it downscaled by the browser. Keep them aligned.
- Because it is a display overlay, the logo is not present in the
  `gallery:ready` picture data, nor in any copied or screenshotted image file.
  Baking it into the pixels would require server- or Worker-side image
  compositing and an image library — explicitly not chosen for this
  low-priority feature.
- An operator's logo should be a 25×25 PNG with transparency where appropriate.
  At 25×25 the stamp is small but visible (~5% of a 512px cartoon's width);
  the bundled default is a bicubic downscale of `client/public/icon-512.png`,
  and the same recipe works for a deployer's own square logo.

---

## 26. Room lifecycle

Rooms are in-memory only — a `Map<roomCode, Room>` on the Node process; there is
no persistence and no database (§18). This section documents when a room is
created and destroyed.

### Creation

A room is created by `room:create` (§5), with a unique 6-character code. The
server refuses creation past `MAX_ROOMS` (default 500, §17), returning
`SERVER_BUSY`.

### Destruction

A room is destroyed in exactly three ways:

1. **The host ends the game** — `game:end` → `deleteRoom`.
2. **A lobby empties** — the last player leaves (via `room:leave`, or a
   disconnect that outlived the §7 grace window) and `players[]` becomes empty.
3. **A game goes all-bots** — every player in a `playing` or `reveal` room has
   been botified.

Because every disconnect runs the removal logic once its §7 grace window
elapses, an abandoned room cleans itself up: as each player's tab closes, the
room is peeled down until it reaches case 2 or 3 and is deleted. A never-started
lobby whose host leaves is destroyed the same way. No separate sweeper or cron
job is needed.

### No idle timeout

There is **no age- or idle-based room expiry**. A room whose socket(s) stay
connected but inactive — a browser tab left open and forgotten — persists until
those sockets actually disconnect. On a single free-tier instance this is
acceptable, and `MAX_ROOMS` is the hard backstop. If forgotten-tab accumulation
ever becomes a real problem, an idle sweep (a per-room last-activity timestamp
plus a periodic scan) is the documented next step — deliberately not built for
v1.

### Host stats

The Home screen's Create mode shows the host a small block of server stats,
fetched on mount via the `stats:get` event (§5, §13, §15):

- **Open rooms** — the current number of live rooms.
- **Images today** — the number of AI pictures generated since 00:00 UTC, over
  the daily cap (`MAX_IMAGES_PER_DAY`, §11, §17).

**Live updates.** After the initial fetch, the Home screen subscribes to the
`stats:update` event (§5) and updates its display whenever either counter
changes. The server emits `stats:update` from four places — successful
`reserveImageSlot()` (image generated), `room:create` (room opened),
`room:leave` that emptied a room, and `game:end` (room destroyed). The
broadcast is to every connected socket; only the Home screen's Create mode
subscribes, so other clients ignore it. The shared builder
`server/src/stats.ts` exposes `buildStats()` (used by both the `stats:get`
ack and the `stats:update` broadcast) and `broadcastStats(io)` (the
emit helper).

Because there is no idle timeout (above), the open-room count can occasionally
include a forgotten-tab room.

**Neurons used today is deliberately not surfaced.** Cloudflare Workers AI
gives no in-band Neuron count back to the server (§11), and the image count
already answers the practical question — "am I close to the daily cap?" — so a
per-image estimate or a Worker change was judged not worth the cost.

**Counter survives spin-down via Cloudflare KV.** The Render server's
`imagesToday` is process-global in-memory and resets on each cold start
(free-plan spin-down after ~15 min idle). To stop the host's
"Images today" counter from lying to "0 / N" after a restart, the
Cloudflare Worker persists a KV-backed counter (`STATS_KV` binding, see
§11 "Cloudflare KV setup"). The Render server syncs lazily on
`stats:get` and eagerly on startup, and `imagesGeneratedToday()` returns
`max(local, worker)` — so within a session the live counter ticks
normally and after a restart the KV value seamlessly takes over.

---

## 27. Source link and content responsibility

The deployed client carries a small **source footer** on the Home and End
screens. The footer is two pieces of text in one centred block:

1. A link to the upstream project on GitHub (a `<a target="_blank"
   rel="noopener noreferrer">` carrying the GitHub mark icon and the
   `footer.source` label, §9).
2. A one-line **content-responsibility notice** (`footer.contentNotice`, §9)
   stating that player answers and AI pictures are the responsibility of the
   *operator* of this server, not of the upstream project.

### Why both pieces ship together

The link and the notice are two halves of the same AGPL self-hosting promise:
the link tells the player where the code comes from, and the notice tells them
which entity is on the hook for the content they are looking at — the deployer
running the binary, not the upstream author. Both halves are required; do not
ship one without the other. The wording mirrors the analysis in
the project's distribution-model analysis (deployer-is-operator, financial-separation
shield) and the donation-routing rule already documented in §18 and §20.

### URL source

The upstream URL is a single hardcoded constant in
`client/src/sourceUrl.ts` — exported as `SOURCE_URL` and imported by the
footer. It is **not** an env var or a `lobby:update` payload field: this is
the upstream project's identity, baked into the build, and changing it is a
fork-level decision rather than a per-deploy one. (Operator-controllable
runtime config — the donation link, room cap — keeps going through env vars,
§20.)

A deployer with a fork they want surfaced instead is expected to change the
constant and rebuild. No reflection of "modified by deployer" is attempted in
the upstream footer — that is the deployer's responsibility, per AGPL §13.

### Placement

The footer renders at the end of the Home screen (both Create and Join modes)
and at the end of the End screen (below the optional "Support this server"
button). It is deliberately omitted from in-game screens (Round, Waiting,
Reveal) where players are mid-task — it is a navigation/legal artefact, not
gameplay UI.

### Build-version label

The footer also carries a tiny third line: `v<version> · <build-date>`. The
version is `client/package.json`'s `version` field; the date is the local
date at the time `vite build` ran. Both are injected at build time via
Vite's `define` mechanism and re-exported from `client/src/version.ts`
(`APP_VERSION`, `BUILD_DATE`).

The label exists so a returning visitor — and the operator looking over
their shoulder — can tell at a glance which deploy is actually running.
This matters because the PWA service worker (§13) can serve an older
cached shell after a deploy until the new version installs; the visible
label makes that observable without DevTools. The number is locale-
invariant — no translation key required.

---

**Start with build step 16.1 (workspace skeleton). Complete and verify each step before moving to the next.**

---

## Changelog

### `4.34.1` — 2026-05-25

- **§10 — item-10 anchor is now language-aware (refines v4.34.0).** v4.34.0 shipped one anchor phrase — `"two distinct subjects, X and Y, "` — applied to both EN and RU rooms. Real-world testing showed that a Cyrillic-noun pair inside an English structural template doesn't read to CLIP as a clear "two-thing" hint the way a Russian-native phrasing does. Refined: the EN path keeps `"two distinct subjects, X and Y, "`; the RU path emits `"1 X слева, 1 Y справа, "` — a numeric anchor (`1`) plus a spatial separator (`слева` / `справа`) that Flux weights strongly. The digit `1` sidesteps Russian grammatical gender — using `один` / `одна` / `одно` would require a brittle ending-based inflector to handle arbitrary player nouns; `1` is gender-agnostic and CLIP tokenises digits cleanly. The player's case form (e.g. instrumental `собакой` after stripping `с`) is left as-is inside the anchor; Flux recognises the noun root for visual concept regardless of case.
- Updated tests: the RU branches under `describe('distinct-subjects anchor (item 10 of vol02)')` now assert the new RU anchor format; one extra test pins that a duplicate RU pair still gets the `"two of them, "` anchor and **not** the RU spatial format (mutual exclusion is preserved). The test pinning composition with the item-2-B Russian action hint is updated to expect the RU anchor at position 0.
- Patch-level: refines an existing additive feature shipping in the same session. No new socket events, no client changes, no data-model changes.

### `4.34.0` — 2026-05-25

- **§10 — "two distinct subjects" anchor on the image prompt for differing slot-0 / slot-1.** Implements item 10 of the triage backlog. Flux's CLIP text encoder doesn't strongly bind adjacent nouns to separate visual entities, so a narrative like "a cat with a dog" or "кот с собакой" rendered as a single cat-dog chimera instead of two distinct figures. The fix mirrors item 19's same-subject `"two of them, "` anchor: when slots 0 and 1 are both non-null and **distinct** (i.e. `looksLikeSameSubject` returns false), `buildPrompt` prepends `"two distinct subjects, ${s0} and ${s1}, "` to the narrative, where `s0` and `s1` are `stripLeading`'d copies of the raw answers (drops `"with"` / `"с"` / `"со"` / articles for clean reading). Mutually exclusive with item 19's anchor — a duplicate pair gets `"two of them"`, a distinct pair gets `"two distinct subjects"`. The English anchor phrase steers Flux's encoder regardless of room language (same posture as the locked style suffix and the item-2-B Russian action hint). Composition order: distinct-subjects anchor → English action hint (Russian only) → narrative → style suffix.
- **Why English regardless of language:** "distinct" is the disambiguator that does the work; CLIP weights English structural words far more heavily than equivalent Russian phrases, and we want the anti-merging signal to bite hardest. The Cyrillic subject names inside the anchor (e.g. `кот and собака`) still help by clearly comma-separating the two tokens; Flux doesn't need to *understand* кот, just to see it as a distinct token from собака.
- **7 new tests in `server/src/prompt.test.ts`** under `describe('distinct-subjects anchor (item 10 of vol02)')` pin: EN bare nouns, EN strip-leading-with, RU bare nouns, RU strip-leading-с, mutual exclusion with samePair, no-fire on null slot, composition with the item-2-B Russian action hint. Four existing tests that asserted prompts STARTED with a specific string (the item-2 v1 action-front check and three item-2-B hint-prefix checks) are updated to assert relative ordering instead, since the new anchor sits even further in front.
- Minor-level: server-only additive prompt step behind the existing `reveal:requestPicture` path. No new socket events, no client changes, no data-model changes.

### `4.33.3` — 2026-05-25

- **§8 — RoundScreen Submit button disabled on empty/whitespace-only input.** Implements item 9 of the triage backlog. Until this fix, a player could tap Submit with an empty text box; the server treated the explicit empty submission as a real answer (`""`), bypassing the bot stand-in path (which only fires when the round timer expires with no submission at all). Downstream prose then rendered with visible double-space gaps where the answer should be. Submit is now disabled whenever `answer.trim().length < 1`, i.e. enabled the moment the player types at least one non-whitespace character. The bot stand-in / timer-expiry path is unchanged — a player who never submits still gets a stand-in. Patch-level: one `canSubmit` const + one `disabled` flag in [client/src/screens/RoundScreen.tsx](../client/src/screens/RoundScreen.tsx). No server, socket, or data-model changes.

### `4.33.2` — 2026-05-25

- **§9 — EndScreen title splits into two states.** Implements item 8 of the triage backlog. Until this fix, the EndScreen showed "Игра окончена" / "Game is over" the moment it mounted — but the game wasn't actually over yet: gallery sharing, picture late-arrivals, and a possible "One more game" restart were all still ahead. The heading is now keyed off the existing `gameOver` flag (true only after the host's Finish Game → `game:end` → `game:over` broadcast): `gameOver === false` → new key `end.roundsOver` ("Rounds are over" / "Раунды окончены"); `gameOver === true` → existing `end.title` ("Game is over" / "Игра окончена"). One i18n key added per language, one ternary in [client/src/screens/EndScreen.tsx](../client/src/screens/EndScreen.tsx). Patch-level: server, socket events, and data model are unchanged.

### `4.33.1` — 2026-05-25

- **§9 — `end.ready` reworded for clarity.** Implements item 7 of the triage backlog. Players hitting the End screen between games saw "I'm ready" / "Я готов" and asked "ready for what?" — the button signals readiness for the host's "One more game" restart but the bare phrasing was ambiguous. Updated copy: EN `"I'm ready for a new game"`, RU `"Я готов к новой игре"`. The active-state label (`end.readyActive` = "Ready ✓" / "Готов ✓") is unchanged — the check mark + prior tap resolve any leftover ambiguity. Patch-level: two i18n string edits, no code changes, no layout regression (full-width button at `text-xl` inside `max-w-md` accommodates both strings on a single line on phones down to 320 px).

### `4.33.0` — 2026-05-25

- **§24 — "scan-to-clone" footer on the downloadable story+picture image.** Implements item 6 of the triage backlog ("the image is the marketing"). Every PNG produced by `downloadStoryImage` ([client/src/downloadStory.ts](../client/src/downloadStory.ts)) now ends with a three-part footer: (1) the verbatim content-responsibility notice from the active locale (`footer.contentNotice` — EN: *"Player answers and AI pictures are the responsibility of the operator of this server, not of the upstream project."* — pulled live from the same i18n key the in-app footer uses); (2) a QR code for `SOURCE_URL`; (3) the source label and printed URL beside the QR so the link survives a screenshot of a screenshot. The disclaimer must travel with the image because the downloaded asset moves out of the in-app context where the footer would otherwise carry it.
- **New dep `qrcode` 1.5.x + `@types/qrcode`.** Loaded via dynamic `import()` so the ~24 kB / ~10 kB-gzipped chunk stays out of the main JS bundle — it only ships to a client that actually taps Download. The QR is rendered to an offscreen canvas with a 1-module quiet zone in the existing cream/ink palette, then `drawImage`'d onto the composite.
- **Layout.** Below the existing prose/nickname block, separated by a vertical pad: notice (italic, muted, wrapped); QR 96 × 96 px left + label/URL block right, vertically centred against the QR's height. Russian rooms use the same QR (the GitHub repo is bilingual) and the RU translation of both the notice and the source label.
- Minor-level: a client-only additive feature on an existing function. No new socket events, no server changes, no data-model changes. The bundle size delta is gated behind a dynamic import — zero impact on first-paint cost.

### `4.32.0` — 2026-05-23

- **§11, §26 — Cloudflare KV persistence for the daily image counter.** Finishes the deferred half of the triage backlog item 22 (option B from that analysis) and closes the user-facing bug where "Images today: 0 / 25" lied on the Home screen after a Render free-tier spin-down even though the day's Cloudflare quota was actually exhausted. The Cloudflare Worker (`cloudflare/worker.js`) now binds a new `STATS_KV` namespace, bumps a `count:YYYY-MM-DD` key after every successful `flux-1-schnell` call (48 h TTL — yesterday's key is garbage-collected without ever being read), and serves a new `GET /stats` endpoint that returns `{ date, count }` from KV. The Render server (`server/src/image.ts`) gains `syncImageCounterFromWorker()` and `maybeSyncImageCounter()` (~30 s TTL), called eagerly at startup and lazily from the `stats:get` handler. `imagesGeneratedToday()` returns `max(local, workerCount)` so within a session the live local counter wins and after a cold start the KV value seamlessly takes over. The cap check inside `reserveImageSlot()` uses the same `max(...)` so a fresh process whose KV count already hits the limit correctly refuses new reservations on the very first request.
- **`cloudflare/wrangler.toml` gains a `[[kv_namespaces]]` block** with placeholder IDs. One-time setup: `wrangler kv namespace create STATS_KV` (and `--preview`), paste IDs, `wrangler deploy`. Free-tier headroom is > 100× our usage (~25 writes/day, ~300 reads/day vs 1 000 / 100 000 limits).
- **10 new tests in `server/src/image.test.ts`** mock `fetch` and pin: local-only behaviour pre-sync, KV-wins after restart, local-wins during a session, cap reservation refuses on a cold start when KV is already at the limit, UTC rollover safety (yesterday's KV value never stamps onto today), silent absorption of network and HTTP errors, and the TTL-bounded refresh of `maybeSyncImageCounter`. New test-only export `__resetImageCounterStateForTests`.
- **Race note.** KV has no atomic increment, so two concurrent generations could under-count by 1 in a rare collision. The Render server's local counter still tracks the bump, so `max(local, worker)` stays monotonic in the player-visible number. Acceptable for the use case.
- Minor-level: additive Worker endpoint, additive server module state and helpers, additive optional Worker binding. No new socket events, no client changes, no data-model changes.

### `4.31.0` — 2026-05-23

- **§11 — cap-reached UX with hours-until-reset on both the lobby and the reveal screen.** Implements item 4 of the triage backlog. Two surfaces: (1) every client in the lobby subscribes to the live `stats:update` broadcast (§26) and shows a yellow-amber banner — "Picture generation is unavailable for the next ~N hours" — when `imagesGeneratedToday >= imagesLimit`; the host gets an extra "tap Start when ready, or wait" line. The Start button stays enabled so the host can choose to play picture-less. (2) The `reveal:pictureError` payload (`shared/events.ts`) gains an optional `code: 'CAP_REACHED' | 'GENERIC'` discriminator. The server emits `code: 'CAP_REACHED'` from the cap branch of `handlePictureRequest`; clients that read `code` switch to the i18n'd "The cartoon oven is full. New cartoons in ~N hours" caption. The legacy English `message` stays on the wire as a forward-compat fallback.
- **New i18n keys.** `lobby.capReached`, `lobby.capReachedHost`, `reveal.capReached` in both `client/src/i18n/en.json` and `client/src/i18n/ru.json`.
- **New client module `client/src/capReset.ts`.** Two pure helpers: `hoursUntilUtcMidnight()` (Math.ceil to next UTC midnight, floor-clamped to 1) and `isCapReached(stats)`. Computing hours client-side avoids an extra payload field for a value derivable from UTC arithmetic alone.
- Three new tests in `server/src/game.pictureError.test.ts` pin the wire shape: cap branch emits `code: 'CAP_REACHED'`, generic-failure branch emits `code: 'GENERIC'`, and success emits no error. Uses the same `vi.mock('./image.js')` pattern as `game.botPictures.test.ts`.
- Minor-level: an additive optional field on an existing socket payload + a new client banner driven by existing live stats. No new socket events, no data-model changes, no breaking client changes.

### `4.30.0` — 2026-05-23

- **§11 — server-side picture generation for bot-owned stories.** Implements item 3 of the triage backlog. Before this fix, `enterRevealPhase` only emitted `reveal:start` to non-bot players, so a botified player's story never received a `reveal:requestPicture` from any client and the room gallery (§24) showed a gap next to the bot's prose. `game.ts` now exports `generateBotStoryPictures(room, io)` which sequentially walks bot-owned stories, runs each through the same core pipeline as a human request (write-once cache → safety guards → cap reservation → Worker call → store on `story.pictureUrl`), and re-broadcasts `gallery:ready` on success when the gallery is already shared. Called from two trigger points: the end of `enterRevealPhase` (for players who botified before reveal) and `finalizePlayerRemoval` in `index.ts` when phase is already `'reveal'` (for players who botify *during* reveal). The cap returning `false` stops the loop so a multi-bot room can't burn the last few slots in a single tick.
- **Refactor.** `handlePictureRequest` is rewritten as a thin wrapper around a shared `generateStoryPicture` helper that returns a `PictureOutcome` discriminated union (`cached` / `ready` / `blocked` / `capped` / `failed`). The wrapper maps each outcome to the existing socket events; the bot path uses the same helper but emits nothing. Same daily cap, same safety guards, same write-once cache — only the trigger point and the absence of a socket recipient differ.
- Seven new tests in `server/src/game.botPictures.test.ts` pin: no work on an all-human room, single-bot story generation, write-once cache skip, cap-exhausted early exit, phase-guard on non-reveal phases, silent failure absorption, and idempotence on a second invocation. Vitest `vi.mock` stubs `./image.js` and `./stats.js` so the tests run offline.
- Minor-level: server-only additive trigger behind the existing `reveal:requestPicture` pipeline. No new socket events, no client changes, no data-model changes.

### `4.29.0` — 2026-05-23

- **§10 — Russian-only English-keyword hint layer (option B for vol02 item 2).** The v4.27.0 template reorder (option A) was empirically insufficient — real-room testing showed Russian action verbs still went missing from most generated pictures. New module `server/src/promptHints.ts` adds a substring-matching lexicon (~50 Russian stems → short English keyword strings, like *"лыж" → "skiing on snow"*, *"машин" → "in a car"*). When the Russian slot-4 answer contains any lexicon substring, `ruActionHint` returns a comma-joined hint string and `buildPrompt` prepends it to the narrative, giving Flux's CLIP encoder an English anchor that it weights more strongly than the Cyrillic content. The player's Russian remains unchanged in both the prompt and the prose. The English path is bypassed entirely.
- Rollback-friendly: option B sits in a single new module + a small call site in `prompt.ts`. Reverting this commit drops option B and leaves option A intact. Option C (Worker-side translation via `@cf/meta/m2m100-1.2b`) is still documented in the triage backlog item 2 as the next escalation if A + B together aren't enough.
- Six new tests in `server/src/prompt.test.ts` pin: hint for skiing, hint for car, multi-hint comma-joined order, no-match no-hint, English-bypass, and the order *"two of them, [hint], [narrative]"* composition with item 19.

### `4.28.0` — 2026-05-23

- **§25 — deployer-logo stamp resized from 50×50 to 25×25 pixels.** The bundled `client/public/deployer-logo.png` is now a 25×25 bicubic downscale of `client/public/icon-512.png` (was 50×50, see v4.26.0); `LogoStamp.tsx` renders it at native 25×25 via explicit `width={25} height={25}` attributes. 25×25 lands roughly halfway between the v4.22.0 "barely visible" 7×7 and the v4.26.0 "prominent" 50×50 — small but legible (~5% of a 512px cartoon's width), and unobtrusive enough not to compete with the picture content. `DESIGN_SYSTEM.md` v1.0.8 §5 and README updated to match.
- No server, socket-event, or data-model changes; client-only asset + CSS dimensions edit.

### `4.27.0` — 2026-05-23

- **§10 — Russian image-prompt template front-loads the action verb.** Implements option A of item 2 of the triage backlog. The Russian `imagePrompt` template changes from `"{0} {1} {4}, {2}, {3}"` to `"{4}: {0} {1}, {2}, {3}"`. The action verb (slot 4) now sits at position 0 with a caption-style colon delimiter, addressing Russian-specific failure modes Flux exhibits — Cyrillic tokenises ~2–3× larger under CLIP's BPE encoder and the encoder weights Russian tokens less strongly than English, so a mid-prompt Russian action verb was being silently truncated or under-weighted. The English template is unchanged. Two new tests in `server/src/prompt.test.ts` pin the new Russian-front layout and verify English remains subject-first. The §10 templates block and surrounding prose are updated to reflect the intentional per-language divergence.
- No spec architectural change. The image prompt builder still uses verbatim answers and no translation; only the template structure changed for one language. Options B (server-side Russian-action lexicon) and C (Worker-side M2M-100 translation) are documented in the triage backlog item 2 as the next escalation paths if A is empirically insufficient.

### `4.26.0` — 2026-05-23

- **§25 — deployer-logo stamp resized from 7×7 to 50×50 pixels.** The bundled `client/public/deployer-logo.png` is now a 50×50 bicubic downscale of `client/public/icon-512.png` (was 7×7, see v4.22.0); `LogoStamp.tsx` renders it at native 50×50 via explicit `width={50} height={50}` attributes (was `width={7} height={7}`). The 50×50 size makes the stamp legibly visible without dominating the cartoon, while keeping the "no CSS upscaling, pixel-perfect deployer branding" property intact. `DESIGN_SYSTEM.md` v1.0.7 §5 and README updated to match.
- No server, socket-event, or data-model changes; client-only asset + CSS dimensions edit.

### `4.25.0` — 2026-05-23

- **§22 — accept the hallucinated painter-style signature artefact (option F).** Implements item 1 of the triage backlog by documentation only: a new "Accepted artefact" subsection under §22 explains what the signature-shaped squiggle is (hallucinated nonsense letterforms, a known property of diffusion models trained on signed paintings), records that no mitigation is enabled in v1, and states the IP position — the marks are not a learned reproduction of any real artist's signature or copyrighted mark, the operator remains responsible for the deployed content as a whole (§27, the project's distribution-model analysis), and the artefact does not by itself create an IP conflict distinct from the broader generative-AI questions. README's "Content moderation and operator responsibility" section gains a parallel "Known visual artefacts" subsection.
- No code change. Options A–E from the backlog item (positive-framing suffix rewrite, panel-framing directive, OCR rejection, model swap) remain available as escalation paths if real-data evidence shows the artefact is more than cosmetic.

### `4.24.0` — 2026-05-23

- **§9 — Russian-only slot-1 "и" and slot-6 "это закончилось" prefixes at render time.** Implements item 23 of the triage backlog. `renderProse('ru', …)` now applies two transforms before substitution. (1) If slot 1 ("С кем?") does not already begin with `с`/`со`/`и`, it gets a literal `"и "` prepended — so bare player nouns like *"кенгуру"* compose as *"мышь и кенгуру"* rather than *"мышь кенгуру"*. (2) If slot 6 ("Чем всё закончилось?") is two words or fewer, a literal `"это закончилось "` is prepended — so an instrumental-case player answer like *"путешествием"* composes as *"В итоге это закончилось путешествием"* rather than the broken *"В итоге путешествием"*. The existing 10 RU slot-6 stand-ins are all 4+ words and untouched.
- **§10 — Russian slot-1 "и" prefix also applies in the image prompt.** The transform helper `ruSlot1NeedsAndPrefix` is exported from `server/src/i18n/index.ts` and imported by `server/src/prompt.ts`, so the image-prompt narrative stays aligned with the prose ("кот и лошадь" in both, not "кот лошадь" in the image). Composes correctly with item 19's "two of them, " duplicate-subject anchor — an identical bare-noun pair gets both signals ("two of them, кот и кот …").
- New tests in `server/src/i18n/index.test.ts` and `server/src/prompt.test.ts` pin: bare-noun slot 1, "с"/"со"/"и" preserved, single- and two-word slot 6, multi-word slot 6 untouched, the user-reported end-to-end bug example, and English-bypass.
- Minor-level: server-only render-time transforms on existing socket payload fields. No new socket events, no client changes, no data-model changes.

### `4.23.0` — 2026-05-23

- **§5, §26 — live `stats:update` broadcast.** Implements item 22 of the triage backlog (option C from the analysis). A new server→client event `stats:update` carrying the same `StatsPayload` as the `stats:get` ack is fired from four sites — successful `reserveImageSlot()`, `room:create`, `room:leave` that empties a room, and `game:end` (room destroyed). The Home screen's Create mode subscribes after the initial `stats:get` fetch and updates its display in real time, so the host's "Open rooms" and "Images today" counters tick visibly rather than only refreshing on remount. New module `server/src/stats.ts` houses `buildStats()` and `broadcastStats(io)`; both `stats:get` and the new broadcast paths share the same payload builder.
- **§26 documents the spin-down reset.** The in-memory counter is not durable across Render free-tier spin-downs; a full fix requires Cloudflare KV persistence (option B in the item 22 analysis) and is explicitly out of v1 scope.
- Minor-level: an additive server→client event behind an existing payload type. No data-model changes, no breaking client changes (clients that don't subscribe see no behaviour change).

### `4.22.0` — 2026-05-23

- **§25 — deployer-logo stamp default is now visible at 7×7 pixels.** Resolves item 21 of the triage backlog. The bundled `client/public/deployer-logo.png` is no longer a 1×1 transparent placeholder; it is a 7×7 PNG downscaled (bicubic) from `client/public/icon-512.png`, so an out-of-the-box deployment carries a small visible stamp the deployer can replace with their own 7×7 PNG. `LogoStamp.tsx` now renders the asset at **native 7×7 pixels** via explicit `width={7} height={7}` attributes (the prior `w-1/4` upscale class is gone) — at 7×7 there is no resampling, and the deployer's pixel-level branding survives intact. README and `DESIGN_SYSTEM.md` (v1.0.6 §5) updated to match.
- Minor-level: client-only asset + CSS change behind the existing `LogoStamp` component. No server, socket-event, or data-model changes.

### `4.21.0` — 2026-05-23

- **§9 — English-only "for" prefix on slot 5 at render time.** Implements item 20 of the triage backlog. `renderProse('en', …)` now prepends a literal `"for "` to the slot-5 ("What for?") answer at substitution time, but only when the answer doesn't already begin with a connective in a small regex list (`for`, `to`, `because`, `so that`, `in order`, `in exchange`, `out of`, `since`). Bare player answers like *"money"* render as *"They skiing for money."* while existing stand-ins like *"to impress a pigeon"* are untouched (no *"for to impress"*). Russian is unchanged — its "Зачем?" question naturally elicits answers that compose with the existing template. New tests in `server/src/i18n/index.test.ts` pin the cases.
- Minor-level: server-only render-time transform on an existing socket payload field. No new socket events, no client changes, no data-model changes.

### `4.20.0` — 2026-05-23

- **§10 — duplicate-subject anchor on the image prompt.** Implements item 19 of the triage backlog. When slots 0 and 1 plausibly refer to the same subject ("mouse" / "with a mouse"; "мышь" / "с мышью"), `buildPrompt` prepends a literal `"two of them, "` to the narrative before the style suffix, so the diffusion model renders two distinct subjects instead of collapsing them. Detection (`looksLikeSameSubject` in `server/src/prompt.ts`) is a cheap and conservative pair-of-strings check: strip leading "with" / "с" / "со" and any article from each slot, then accept either an exact match or a head-noun stem match (last token, first 4 chars — wide enough for Russian declension). The English anchor phrase is used regardless of the prompt language; Flux's training is English-heavy and the directive works as a steering signal across languages.
- Minor-level: server-only additive prompt step behind the existing `reveal:requestPicture` path. No new socket events, no client changes, no data-model changes.

### `4.19.0` — 2026-05-23

- **§10, §9, §22 — image-prompt rebuild for better picture/story alignment.** Implements item 18 of the triage backlog. The image prompt is no longer a hardcoded comma-joined string of all 7 answers; it now uses a per-language `imagePrompt` template (new key alongside `prose` in `server/src/i18n/<lang>.json`) that reads as a natural sentence using **slots 0–4 only** (who, with-whom, action, where, when — in that order, action moved ahead of where/when). Slots 5 ("what for") and 6 ("what was at the end") remain in the player-facing prose but are excluded from the image prompt. The action verb now sits earlier in the prompt where the CLIP encoder weights tokens most strongly. `buildPrompt(story, language)` gains a language parameter; `handlePictureRequest` passes `room.language` in.
- **§22** — locked style suffix is shortened: `, in a goofy cartoon style, googly eyes, exaggerated expressions, bright colors, hand-drawn doodle illustration`. The trailing "no text, no words" is dropped — CLIP-conditioned diffusion models interpret negation poorly, and *naming* "text" as the unwanted concept tends to reinforce it. Pre-`v0.1.0` change; once tagged, §22's breaking-change rules apply.
- Minor-level: server-only behaviour change behind the existing `reveal:requestPicture` path. No new socket events, no client changes, no data-model changes.

### `4.18.0` — 2026-05-23

- **§13 — stale-PWA-cache fix.** Implements item 16 of the triage backlog. Two layered measures: (a) `client/vite.config.ts` removes `index.html` from the precache `globPatterns` and adds a `NetworkFirst` runtime-caching rule for navigation requests with a 3-second network-timeout fallback to cache, so a fresh open after a deploy lands on the new shell; (b) a new `client/src/swReload.ts` installs a `controllerchange` listener (called from `main.tsx`) that does a one-shot `window.location.reload()` when a new service worker takes over while the page is loaded, so a long-lived host session also picks up the deploy.
- Minor-level: a client-only change to the SW strategy. No server, socket-event, or data-model changes.

### `4.17.0` — 2026-05-23

- **§27 — build-version label on the source footer.** Implements item 17 of the triage backlog. The Home- and End-screen source footer now carries a third small line, `v<version> · <build-date>`, sourced from `client/package.json` and the build clock via a new `client/src/version.ts` module and Vite `define`-injected globals (`__APP_VERSION__`, `__BUILD_DATE__` in `client/vite.config.ts`). Makes the running deploy version observable to players and operators without DevTools — the prerequisite for verifying any fix to the still-open item 16 (stale PWA cache after deploy).
- Minor-level: a client-only additive line on an existing component. No server, socket-event, or data-model changes. No new i18n keys (version string is locale-invariant).

### `4.16.0` — 2026-05-23

- **§6 — unconditional hard-block list as a second pre-Worker prompt-safety layer.** A new file `server/src/filter/hardBlocks.ts` and a new "Hard-block list" subsection under §6. `handlePictureRequest` (game.ts) now short-circuits on either `containsCsamCombination(prompt)` *or* `containsHardBlock(prompt)` before `reserveImageSlot()`. The hard-block list is narrow by design — sexual-violence verbs, child-sexual-abuse standalone terms, bestiality, targeted-violence verbs like "assassinate"/"behead" — and explicitly excludes broad-use words ("kill", "shoot", "murder") that have legitimate party-game uses. Tests live in `server/src/filter/hardBlocks.test.ts`. Implements an additional reputational-risk mitigation called out in the project's distribution-model analysis (v1.3.0).
- Minor-level: server-only additive layer behind the existing `reveal:pictureError` UX path. No new socket events, no new error codes, no data-model changes.

### `4.15.0` — 2026-05-23

- **§6 — combinatorial CSAM-pattern guard on the assembled image prompt.** A new file `server/src/filter/csam.ts` and a new "CSAM-pattern guard" subsection under §6. `handlePictureRequest` (game.ts) calls `containsCsamCombination(buildPrompt(story))` before `reserveImageSlot()` and short-circuits with the generic `reveal:pictureError` if it fires. Both indicator lists (minor-indicator and sexual-indicator, EN + RU) are intentionally conservative — false positives are "try again," false negatives are the cost of avoiding a curated wordlist. The corresponding tests live in `server/src/filter/csam.test.ts`.
- **§6** — corrects an implicit assumption from the project's distribution-model analysis (v1.1.1): Thorn (Safer) is commercial and NCMEC does not publish a public CSAM-term wordlist, so the project cannot "integrate Thorn's free wordlist." The combinatorial heuristic is what open-source projects in this space actually ship, and is what the spec now requires.
- Minor-level: server-only additive feature behind the existing `reveal:pictureError` UX path. No new socket events, no new error codes, no data-model changes. The guard runs **before** the daily-cap reservation so a flood of blocked prompts cannot exhaust the Cloudflare Neuron budget for legitimate rooms.

### `4.14.0` — 2026-05-23

- **New §27 — in-game source link and content-responsibility footer.** Implements item 8 of the triage backlog. The Home screen and End screen end with a small centred footer carrying two pieces: a link to the upstream project on GitHub (canonical URL in `client/src/sourceUrl.ts`) and a one-line notice that player answers and AI pictures are the responsibility of the operator of this server, not of the upstream project. The two halves ship together by rule (§27); the wording mirrors the project's distribution-model analysis (deployer-is-operator). Footer is deliberately omitted from the mid-game screens (Round, Waiting, Reveal).
  - **§8** — new "Source footer" bullet referencing §27.
  - **§9** — `home.*` and `end.*` are unchanged; a new `footer.*` namespace (link label + content notice) is added.
  - **§27** — new section covering placement, URL source (hardcoded constant, not env var), and rationale.
- Minor-level: a client-only additive piece of UI. No server, socket-event, or data-model changes.

### `4.13.0` — 2026-05-23

- **§5, §8, §9, §26 — host now sees today's image usage alongside the open-room counter.** Implements item 15 of the triage backlog. The `stats:get` payload is extended with `imagesGeneratedToday` and `imagesLimit`; the host's Home-screen stats block now shows two lines — "Open rooms: N" and "Images today: G / L" — both fetched once when the screen opens.
  - **§5** — `stats:get` ack payload extended.
  - **§8** — the Home Create-mode bullet now points at the host-stats block in §26 rather than just the open-room counter.
  - **§9** — the `home.*` catalogue gains the images-today line.
  - **§26** — the "Open-room counter" subsection is renamed "Host stats" and covers both numbers; **neurons used today is deliberately not surfaced** — Cloudflare gives no in-band Neuron count back to the server, and the image count already answers the practical question.
- Minor-level: an additive extension of an existing event and a one-line UI addition. No new events, no data-model changes.

### `4.12.0` — 2026-05-23

- **§24, §9 — download a story and its picture from the room gallery.** Implements item 14 of the triage backlog. Each gallery entry gains a download button that saves the story as a single PNG, composited client-side on a `<canvas>`: for an entry with a picture, the cartoon with the prose rendered below it; for a picture-less entry (bot slot, skipped/failed generation), a PNG of the story text alone. No server round-trip — it uses the data already in the `gallery:ready` payload.
  - **§24** — new "Download" subsection.
  - **§9** — the `gallery.*` catalogue gains the download-button labels.
- Minor-level: a client-only additive feature. No server, socket-event, or data-model changes.

### `4.11.0` — 2026-05-23

- **New §26 (Room lifecycle) + §5, §8, §9 — open-room counter and documented room lifecycle.** Implements item 13 of the triage backlog.
  - **New §26** — documents how rooms are created and destroyed: a room is deleted when the host ends the game, when a lobby empties, or when a game goes all-bots. Because disconnects run removal after the §7 grace window, abandoned rooms self-clean — no sweeper. There is deliberately no idle timeout; `MAX_ROOMS` is the backstop.
  - **§5** — new `stats:get` client→server event (ack returns `{ openRooms }`).
  - **§8** — the Home screen's Create mode shows the host a small open-room counter.
  - **§9** — the `home.*` catalogue gains the open-room counter label.
- Minor-level: an additive feature (one new request/ack event, a host-only Home-screen label) plus a documentation section. No data-model changes; client and server both touched.

### `4.10.0` — 2026-05-23

- **§5, §7, §8 — host notice when a player is lost.** Implements item 12 of the triage backlog. When a player is botified after the §7 grace window elapses, the server emits a new `player:lost` event to the host, who sees a non-blocking banner — *"<name> exited"* — with two choices: "Ignore, continue the game" (dismiss; the bot plays on) or "Create a new room" (ends the game for everyone and drops the host on a fresh Create screen).
  - **§5** — new `player:lost` (server→client, host-only) event.
  - **§7** — the game-phase rules note that botifying a player also notifies the host.
  - **§8** — new "Host notice" UI entry; the banner is host-only and non-blocking — the game continues underneath it.
  - **§9** — new `playerLost.*` UI-string namespace.
- Minor-level: an additive feature with one new server→client event and a host-only UI overlay. "Create a new room" reuses the existing `game:end` flow. No data-model changes; client and server both touched.

### `4.9.0` — 2026-05-23

- **§7, §18 — bounded disconnect grace window (connection-state recovery).** Implements items 9 and 11 of the triage backlog. A dropped socket — typically a phone that backgrounded the browser — is no longer acted on immediately. Socket.IO connection-state recovery is enabled, and the server defers removal behind a ~60 s grace timer; a client that returns within the window keeps its `socket.id`, its rooms, and its missed events, and the room is neither frozen nor deleted. Beyond the window (or if the browser fully discards the page) the player still falls through to bot replacement.
  - **§7** — new "Disconnect grace window" subsection; the lobby / game / reveal phase rules now apply *after* the window. `room:leave` remains immediate.
  - **§18** — the "do not implement reconnect" rule is amended: a *bounded* connection-state-recovery grace window is allowed; a general reconnect, account system, or persistent identity token is still forbidden.
  - **Architecture overview** — "No reconnect" becomes "Bounded reconnect."
- Minor-level: a narrow, additive relaxation of the disconnect rule, affecting server code only (`index.ts`). No client, data-model, or socket-event changes. `socket.id` remains the only identifier and stays stable across a recovered connection, so no `socket.id`-keyed structure changes.

### `4.8.0` — 2026-05-22

- **§21 — the Home-screen wordmark is now per-language.** Implements item 5 of the triage backlog. The wordmark was previously hardcoded "Funny Stories" and treated as a locale-invariant brand name; that decision is reversed. `Wordmark.tsx` now renders the existing `home.title` i18n key, so each language supplies its own wordmark — English "Funny Stories", Russian "ЧЕПУ-ХА-ХА". The `home.title` key already existed in both locale files (it was orphaned when `<Wordmark />` replaced the original `<h1>`); it is simply reused.
- Minor-level: a small i18n change that reuses an existing key and affects one component. Client-only; no server, socket-event, or data-model changes.

### `4.7.0` — 2026-05-22

- **New §25 (Deployer logo stamp) — optional deployer branding on generated pictures.** Implements item 4 of the triage backlog (low priority). A deployer can overlay a small logo on every generated picture by replacing the bundled `client/public/deployer-logo.png` asset (shipped transparent, so it is off by default) and rebuilding. The logo is a client-side display overlay (`LogoStamp`), shown over the picture on the reveal screen and in the room gallery; it is not baked into the image pixels. No environment variable — a bundled asset was chosen deliberately over an env-var approach.
- Minor-level: an additive, optional, off-by-default feature with a new section. Client-only; no server, socket-event, data-model, or `render.yaml` changes.

### `4.6.0` — 2026-05-22

- **§9, §23 — language selector is a flagged list driven by a central registry.** Implements item 3 of the triage backlog. The Home-screen language switcher is no longer two plain "EN" / "RU" text buttons; it is a vertical list with one row per language showing the language's flag emoji and its native name ("English", "Русский").
  - **§9** — the selector renders from a new `client/src/languages.ts` registry (`{ code, name, flag }` per language), which is the single source for the language list; the `?lang=` URL-parameter check also derives from it.
  - **§23** — the "how to add a new language" list gains a step: add an entry to the `client/src/languages.ts` registry. Adding a language no longer means hand-editing a hardcoded `['en','ru']` array in the Home screen.
- Minor-level: a UI refinement plus a new registry module (`client/src/languages.ts`) that downstream language code derives from. Client-only; no server, socket-event, or data-model changes. The `Language` union type in `shared/events.ts` stays hand-maintained — TypeScript types cannot be generated from a runtime list.

### `4.5.0` — 2026-05-22

- **New §24 (Room gallery) — shared post-game gallery of every story and picture.** Implements item 2 of the triage backlog. After a game, the host presses "Share the room's pictures" and every player then sees a browsable gallery — every story and its AI picture, one at a time — embedded as a section on the end screen.
  - **New §24** — documents the share flow, the `gallery:ready` payload (`GalleryEntry`), the opt-in privacy model, missing-picture placeholders (bot slots are included), the self-healing re-broadcast, and the `maxHttpBufferSize` increase.
  - **§5** — added `gallery:share` (client→server, host only) and `gallery:ready` (server→client) events.
  - **§8** — the reveal screen no longer has a "Generate Picture" button: generation is automatic when the screen opens, with a funny wait control shown only after a 3-second delay. The end screen gains the host's "Share the room's pictures" button and the gallery section.
  - **§9** — the `reveal.*` UI-string catalogue drops the "generate" key; a new `gallery.*` namespace is added.
  - **§11** — picture generation is auto-triggered (not button-triggered); the cached `story.pictureUrl` is reused by the gallery, and a late picture re-broadcasts `gallery:ready`.
  - **§16** — build steps 9 and 10 updated for auto-generation and the gallery.
  - **§20** — the image-size hint notes that `gallery:ready` bundles every picture, so `maxHttpBufferSize` is raised to 8 MB.
- Minor-level: an additive feature with a new section and two new socket events, plus one new data-model field (`Room.galleryShared`). The reveal-screen picture flow changes from manual to automatic. No rotation, profanity, or round-flow changes; no sections renumbered.

### `4.4.0` — 2026-05-22

- **§8, §9, §16, §20 — invite-link join flow reworked into a two-mode Home screen.** Consolidates three items from the triage backlog: item 1 (invite-link joiners saw the room-creation UI), item 6 (the language control was shown to joining players who cannot use it), and item 7 (a stale/recycled link must never grant the host role).
  - **§8** — added a **Home screen** entry. The screen now has two modes selected by the `?room=<CODE>` URL parameter. Create mode (no param) shows the wordmark, language selector, nickname, and "Create room". Join mode (param present) shows the wordmark, a read-only "joining room `<CODE>`" line, nickname, and "Join room" — no language selector, no editable code field. The manual room-code entry box is removed from both modes: the only join paths are the invite link and the QR code. A `ROOM_NOT_FOUND` result in Join mode shows a clear "room no longer exists" message and a "Create a new room" escape button.
  - **§9** — the language switcher is now Create-mode only (the host's choice); joining players never see it and inherit the room language. Documented the optional `?room=<CODE>&lang=<code>` link parameter. The `home.*` UI-string catalogue is updated to match the new screen: the room-code placeholder key is dropped, and joining-room / stale-link / "create a new room" keys are added.
  - **§16 step 5** — `HomeScreen` description and manual test updated for the two-mode design.
  - **§20** — the `?room=` hint updated: the parameter selects Join vs. Create mode rather than pre-filling a join field; the QR code and copied invite link encode the same URL.
- Minor-level: changes Home-screen UI behaviour and removes the manual-code join path (a deliberate, recorded scope decision — the only join paths are now the link and the QR). Affects `HomeScreen.tsx` and the client i18n catalogues; no server, socket-event, or data-model changes; no sections renumbered.

### `4.3.2` — 2026-05-21

- **§14 (Render deployment) — buildCommand fix.** The `render.yaml` `buildCommand` was `npm install && npm run build`. Because the same blueprint sets `NODE_ENV=production`, `npm install` omitted devDependencies (vite, typescript, tailwind, …), so the client build failed on Render with `TS2688: Cannot find type definition file for 'vite/client'`. Corrected to `npm install --include=dev && npm run build`, which forces the build tooling in regardless of `NODE_ENV`. Patch-level: §14's intent (one build command produces the client + server bundles) is unchanged; mirrors the `npm ci --include=dev` already used in the step-14 Dockerfile.

### `4.3.1` — 2026-05-21

- **§6 (Profanity filter / stand-ins) — Russian localization fix.** The Russian stand-in pool for question 3 ("When?") contained `"в Tuesday, похожий на Wednesday"` — the English weekday names were never translated. Corrected to `"во вторник, похожий на среду"`. Found during build step 12 (Russian localization). Patch-level: a single content fix to one stand-in string; pool size and structure unchanged.

### `4.3.0` — 2026-05-21

- **Reveal → end transition specified.** §8 and §17 both referenced an `EndScreen` and a `RevealScreen → EndScreen` transition, but no section stated what *triggered* it — §19's acceptance test jumped straight from "generate picture" (step 7) to "host sees the end-screen buttons" (step 8) with no action in between. Resolved during build step 10:
  - **§8 (Reveal screen)** — added a self-paced "Continue" button below the picture controls. Each player's reveal is private (`reveal:start` is per-player), so each player advances to the end screen on their own; there is no host-gated or synchronized reveal→end step.
  - **§17 (Phase transitions)** — the `RevealScreen → EndScreen` line now states the transition is triggered by that Continue button.
  - **§5 (Socket events)** — clarified `game:over`: it is the *terminal* broadcast sent after the host's `game:end`, and also pulls any straggler still on the reveal screen to the end screen.
  - **§4 (Server data model)** — added `readyForRestart: Set<string>` to the `Room` interface. The field is required to implement `game:ready` / `game:restartReady` (both already specified in §5); §4 simply did not list it.
- Minor-level: clarifies an underspecified requirement that affects downstream code and adds one data-model field. No behavioural change to rotation, profanity, round-flow, or image logic; no sections renumbered.

### `4.2.4` — 2026-05-21

- **§11 (Image generation) — data-URL media type fix.** The `generateImage` snippet hard-coded `data:image/png` in the returned data URL. Since the Worker now returns JPEG (§15, corrected in 4.2.3), the snippet now derives the media type from the Worker response's `Content-Type` header (`data:${contentType};base64,…`), defaulting to `image/png`. This matches the working `server/src/image.ts` in the repo. Patch-level: completes the image-format reality correction begun in 4.2.3.

### `4.2.3` — 2026-05-21

- **§15 (Cloudflare Worker) — corrected to match the live Workers AI API.** The `worker.js` snippet assumed `@cf/black-forest-labs/flux-1-schnell` returns a raw PNG byte stream and used a `num_steps` parameter. Verified against the deployed Worker during build step 8: Flux Schnell actually returns `{ image: "<base64 JPEG>" }`, and the parameter is `steps`. The snippet now uses `steps: 4`, wraps the AI call in try/catch → `502`, and decodes the base64 to raw bytes before responding (with a raw-stream fallback for older models). This matches the working `cloudflare/worker.js` in the repo.
- **§18** — the "do not increase Flux `num_steps` above 4" bullet renamed to `steps` to match the corrected parameter name.
- Patch-level: §15's intent — call Flux Schnell at minimum step count, return image bytes to the server — is unchanged; only the API details are corrected to reality.

### `4.2.2` — 2026-05-20

- **§8 (Mobile-first UI) — conflict fix.** The Motion bullet hard-coded `stiffness: 300, damping: 30`, which conflicted with `DESIGN_SYSTEM.md` §4's `snappy` preset (`stiffness: 400, damping: 30`) — the preset that doc designates for screen transitions. §8 now defers spring values to `DESIGN_SYSTEM.md` §4: the design system is authoritative for motion presets, the spec defines only that transitions exist and are spring-based (never linear). Patch-level: §8's contract is unchanged.
- No other changes.

### `4.2.1` — 2026-05-20

- **§10 (Image prompt builder) — arithmetic fix.** The `buildPrompt` snippet truncated the narrative with `narrative.slice(0, 450)`, then appended the ~130-char style suffix — yielding up to ~580 characters and violating §10's own "cap total length at 500 characters" rule. Corrected to `narrative.slice(0, 500 - style.length)` so the total is genuinely ≤ 500. Patch-level: the section's stated contract ("cap at 500") is unchanged; only the example code is corrected to honour it.
- No other changes.

### `4.2.0` — 2026-05-20

- **§11 (Image generation) extended** with an operator-side **daily image cap**. A process-global counter `imagesToday` in `server/src/image.ts` tracks images generated by this server process, shared across all rooms. When it reaches `MAX_IMAGES_PER_DAY` the Worker is not called and `reveal:pictureError` is emitted with a friendly "daily limit reached" message. The counter resets at 00:00 UTC. The slot is reserved (counter incremented) **before** the Worker `await` so concurrent requests cannot overshoot; attempts are counted, not successes.
- **§14 (Render deployment)** — `render.yaml` gains `MAX_IMAGES_PER_DAY` as an optional, deployer-controlled env var (`sync: false`, default 25), sibling to `MAX_ROOMS`.
- **§17 (Hard constraints)** — new "Daily image-generation ceiling" subsection and a row in the validation summary table.
- **§16 step 8** — wording amended to include implementing the daily cap and a test for cap behaviour.
- **Rationale.** Cloudflare Workers AI does not push a notification when the free Neuron budget is exhausted, and on the Workers Paid plan overage is billed automatically with no built-in spend cap. An app-level counter is the only provider-independent guarantee against silently exceeding the free tier. This is the operator-side quota that the project's distribution-model analysis assigns to each operator — shipped here with a safe default.
- **No behavioural change** to the rotation, profanity, round-flow, or reveal logic. Additive feature; no spec body sections renumbered.

### `4.1.0` — 2026-05-17

- **§16 step 14 expanded** with Docker artefacts as implementer-drafted files (`Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.env.example`). Single-stage `node:20-alpine`, stateless, one port, no volumes. Cloudflare Worker stays a separate `wrangler deploy` artefact.
- **No changes to existing sections.** The Docker option is additive — `render.yaml` remains the canonical hosted-deployment template, Docker is a second supported path for self-hosters. No spec body sections renumbered.
- **Rationale.** `README.md` documents two deployment paths (Render and Docker). The Docker artefacts themselves were not previously in any binding doc; this entry pins them to a specific build step so they don't get skipped.

### `4.0.0` — 2026-05-17

- **Folded** `SPEC_AMENDMENT_donation_routing.md` into the main spec. The amendment file is **retired and deleted** from the project. Single source of truth restored.
- **No behavioural changes** from the v3.1.0 merged state. The amendment's text was already merged into §14 (`render.yaml` env var), §16 step 13 (Polish), §18 (Things NOT to do), §20 (implementation hints), and §23 (README content) under v3.1.0; v4.0.0 is the bookkeeping cut that removes the now-redundant companion-doc pointer.
- **Section reference fixes** in two places where v3's body text pointed at `§17` and `§19` (the amendment's own numbering) instead of v3's renumbered `§18` and `§20`:
  - `lobby:update` payload row in §5 — `(see §17 and §20)` → `(see §18 and §20)`.
  - Client UI string catalogue in §9 (`end.*` bullet) — `§14, §17, and §20` → `§14, §18, and §20`.
- **Note on spec amendments** (top of document) rewritten: from "the donation amendment currently overrides §16, §17, §19" → "no active amendments in v4".
- **Companion documents row** trimmed to the four marketing analyses; `SPEC_AMENDMENT_donation_routing.md` removed.
- **Preamble** refreshed to describe the v3 → v4 transition.
- **Bumped to major** despite no behavioural change. This marks the close of the amendment era and the return to a single binding document. Per the project's own semver rules this would normally be a minor bump (3.2.0), and the major was an explicit project decision rather than a strict semver application — noted here so downstream forks understand the bump is editorial, not architectural.

### `3.1.0` — 2026-05-17

- Companion document `SPEC_AMENDMENT_donation_routing.md` introduced as an active override of §16 step 13, §17, and §19 with respect to end-screen donation-link handling.
- §14 `render.yaml` gained `DEPLOYER_DONATE_URL` as an optional, unset, deployer-controlled env var.
- §5 `lobby:update` payload gained `donateUrl: string | null`.
- §9 i18n key `endScreen.supportServer` added (EN: "Support this server ☕"; RU: "Поддержать этот сервер ☕").
- §16 step 13 (Polish) reworded: hardcoded Buy Me a Coffee link → deployer-controlled button driven by env var, hidden when unset.
- §18 (Things NOT to do) gained the "no hardcoded donation URLs in the client" bullet.
- §20 (Implementation hints) gained the "Deployer donation button" implementation note.
- §23 (README content) gained the deployer donation guidance section.
- Rationale: see `SPEC_AMENDMENT_donation_routing.md` (now retired in v4.0.0). The amendment protected the upstream author from inheriting deployer-side legal and reputational exposure under the GitHub / self-hosted distribution path.

### `3.0.0` — earlier

- Clean rewrite of v2. Contradictions removed, section numbering fixed, Cloudflare Worker secret made mandatory, dead `StandIn.en` field dropped, prompt builder decoupled from English grammar, `game:state` ghost event removed, `playerId` clarified, `reveal:start` payload cleaned up, "one more game" edge case specified.
