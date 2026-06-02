# Roadmap

Improvements and new features proposed after the initial build, consolidated
from the internal triage logs. Each row carries a **status** — *Solved* (shipped)
or *Not solved* (still planned). "Source" points back to the original triage
item (vol01 = first triage volume, vol02 = second).

Bugs and behaviour-to-verify items are tracked separately in
[KNOWN_ISSUES.md](./KNOWN_ISSUES.md).

## Planned / not yet shipped

_Nothing outstanding._ Every improvement below has shipped. The only remaining
forward-looking work is the conditional **option C** escalation (Worker-side
M2M-100 translation) noted against the Russian-action-verb bug in
[KNOWN_ISSUES.md](./KNOWN_ISSUES.md).

## Delivered

| Improvement | Status | Shipped as | Source |
|---|---|---|---|
| Shared room gallery of all stories and pictures | Solved | v4.5.0 §24 — host "Share the room's pictures"; automatic picture generation. | vol01 #2 |
| Language selector as a flagged list, data-driven registry | Solved | v4.6.0 — flag + native name list from `client/src/languages.ts`. | vol01 #3 |
| Optional deployer logo stamped on generated pictures | Solved | v4.7.0 §25 — client-side overlay from a bundled `deployer-logo.png`. | vol01 #4 |
| Localizable Home-screen wordmark | Solved | v4.8.0 — `Wordmark.tsx` renders the `home.title` i18n key (RU "ЧЕПУ-ХА-ХА"). | vol01 #5 |
| Language control restricted to the host | Solved | v4.4.0 §8/§9 — selector shown only in Home/Create mode. | vol01 #6 |
| In-game link to GitHub + content-responsibility notice | Solved | v4.14.0 §27 — source footer on Home/End screens. | vol01 #8 |
| Host told when a player is lost, chooses how to proceed | Solved | v4.10.0 — `player:lost` event + non-blocking host banner. | vol01 #12 |
| Open-room counter for the host + documented room lifecycle | Solved | v4.11.0 — `stats:get` counter; new spec §26 room lifecycle. | vol01 #13 |
| Download a story and its picture from the gallery | Solved | v4.12.0 — client-side `<canvas>` composite to PNG. | vol01 #14 |
| Show today's image-generation usage | Solved | v4.13.0 — "Images today: G / L" in the host stats block. | vol01 #15 |
| Small app-version label on the start page | Solved | v4.17.0 §27 — `v<version> · <build-date>` in the source footer. | vol01 #17 |
| Image prompt preserves a duplicate subject ("X with X") | Solved | v4.20.0 §10 — `"two of them, "` anchor on same-subject pairs. | vol01 #19 |
| English prose connective "for" between slots 4 and 5 | Solved | v4.21.0 §9 — render-time "for " prefix when no connective present. | vol01 #20 |
| Deployer-logo stamp default reworked | Solved | §25 — 25×25 native-size PNG; delete/replace to opt out. | vol01 #21 |
| Russian prose "и" between subjects + "это закончилось" before ending | Solved | v4.24.0 §9 — render-time prefixes with word-count heuristic. | vol01 #23 |
| Generated pictures with painter-style signatures / scribbled text | Solved | v4.25.0 §22 — documented and accepted; "Known visual artefacts" in MODERATION. Options A–E held in reserve. | vol02 #1 |
| Bot-filled stories for exited players still get a picture | Solved | v4.30.0 — server-driven `generateBotStoryPictures` for bot-owned stories. | vol02 #3 |
| "Cartoon oven is full" pre-game warning + resume-time notice | Solved | v4.31.0 — lobby banner + `CAP_REACHED` reveal caption with hours-to-reset. | vol02 #4 |
| Viral "image is the marketing" QR code on the downloadable image | Solved | v4.33.0 — content notice + `SOURCE_URL` QR + printed URL on the export. | vol02 #6 |
| "Игра окончена" → "Раунды окончены" between last round and reveal | Solved | v4.33.2 — `end.roundsOver` vs `end.title` keyed off `gameOver`. | vol02 #8 |
| Disable round Submit until the text box has input | Solved | v4.33.3 — `canSubmit = answer.trim().length >= 1`. | vol02 #9 |
| Joiners don't see "ready for a new game" until the gallery is shared | Solved | v4.33.x — non-host ready toggle gated on `gallery !== null`. | vol02 #11 |
