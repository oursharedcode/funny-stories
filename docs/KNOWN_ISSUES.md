# Known Issues

Bugs and behaviour-to-verify items found after the initial build, consolidated
from the internal triage logs. Each row carries a **status** — *Solved* or
*Not solved* (with *Partial* where some options shipped and an escalation
remains). "Source" points back to the original triage item (vol01 = first
triage volume, vol02 = second).

Improvements and new features are tracked separately in [ROADMAP.md](./ROADMAP.md).

## Open / partial

| Issue | Status | Detail | Source |
|---|---|---|---|
| Russian action verbs don't appear in the generated picture | **Partial** | Action-first template (v4.27.0) + Russian→English action-hint lexicon `server/src/promptHints.ts` (v4.29.0) shipped. Escalation **option C** — Worker-side `@cf/meta/m2m100-1.2b` translation — remains **not done**, to be picked up only if A+B prove empirically insufficient. | vol02 #2 |

## Resolved

| Issue | Status | Resolution | Source |
|---|---|---|---|
| Invite-link joiners saw the room-creation UI | Solved | Home screen switches to a join-only view when the URL carries `?room=` (v4.4.0 §8). | vol01 #1 |
| Host role could be granted by opening a stale room link | Solved | Stale `?room=` shows a clear "room no longer exists" message; verified `joinRoom` never assigns `hostId` (v4.4.0 §8). | vol01 #7 |
| Host backgrounds the app on mobile and returns → botified | Solved | ~60s disconnect grace window + Socket.IO connection-state recovery (v4.9.0 §7). | vol01 #9 |
| README advertised a paid Render plan that no longer matched `render.yaml` | Solved | README rewritten to the free plan; no price; idle spin-down noted in known limitations. | vol01 #10 |
| A brief app switch dropped the host's room | Solved | Dropped socket not acted on for ~60s; returning client recovers transparently (v4.9.0 §7). | vol01 #11 |
| Stale cached version of the PWA served from the browser | Solved | `NetworkFirst` navigation rule + index-html excluded from precache + `swReload.ts` auto-reload on SW takeover (v4.18.0 §13). | vol01 #16 |
| Generated picture often didn't reflect the story content | Solved | Per-language natural-sentence `imagePrompt` template, slots 0–4 only, action-first, negation removed from style suffix (v4.19.0 §10). | vol01 #18 |
| "Images today" counter showed zero all the time | Solved | Live `stats:update` ticking (v4.23.0) + Cloudflare KV persistence surviving spin-down (v4.32.0). | vol01 #22 |
| "Images today: 0 / 25" after a Render spin-down | Solved | Worker KV `count:YYYY-MM-DD` + TTL-bounded server sync; `imagesGeneratedToday()` returns `max(local, workerCount)` (v4.32.0). | vol02 #5 |
| "I'm ready" / "Я готов" end-screen button read as ambiguous | Solved | Relabelled "I'm ready for a new game" / "Я готов к новой игре" (v4.33.1). | vol02 #7 |
| Distinct subjects (cat + dog) merged into one chimera | Solved | Language-aware distinct-pair anchor in `buildPrompt` (v4.34.0, refined v4.34.1). | vol02 #10 |
| English image prompts produced a cat-dog chimera | Solved | Prepend `"and "` to slot 1 when it lacks a connector, mirroring the Russian "и" logic (v4.34.x). | vol02 #12 |
