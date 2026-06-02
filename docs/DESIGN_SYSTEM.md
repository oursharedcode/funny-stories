# Funny Stories — Design System

<!-- VERSIONING BLOCK — DO NOT REMOVE. Update on every substantive change. -->

| | |
|---|---|
| **Document version** | `1.0.8` |
| **Last updated** | 2026-05-23 |
| **Document ID** | `DESIGN_SYSTEM_v1` |
| **Companion documents** | `FUNNY_STORIES_SPEC_v4.md` (binding build spec — wins on any conflict) |

> **Scope.** This document defines **how** the app looks and moves. The build spec defines **what** screens exist and what they do. When the two conflict, the spec wins. When the spec is silent on visual personality, this document is authoritative.
>
> **Non-goals.** This is not a marketing doc, not a brand book, not a Figma library. It is the source of truth for design tokens, motion presets, and mascot personality used by the React + Tailwind + Framer Motion implementation.

---

## 1. Personality

Funny Stories looks like a notebook a slightly unhinged friend doodled in during a boring meeting. The personality is exaggerated, expressive, goofy, **never corporate**. Mascots have googly eyes and bad posture. Spring physics overshoot. Idle animations wobble. Error states are sad-but-funny, not apologetic.

The visual goal is one a player describes to a friend as *"the dumb game with the eyeball monkeys."*

What we are not: minimalist, Material, Apple-clean, enterprise, accessible-but-bland, "modern SaaS." If a design choice could appear unmodified in a B2B dashboard, it is wrong.

---

## 2. Color tokens

Tailwind utility classes are the source of truth. Custom hex values listed here are for tooling, illustrations, and the PWA manifest.

### Brand colors

| Token | Value | Tailwind class | Used for |
|---|---|---|---|
| `--brand-pink` | `#ec4899` | `pink-500` | Wordmark, highlighted phrases in reveal prose, primary actions |
| `--brand-cream` | `#fef3c7` | `amber-100` | App background, PWA `theme_color` |
| `--brand-ink` | `#1f2937` | `gray-800` | Body text |
| `--brand-mascot-yellow` | `#facc15` | `yellow-400` | Mascot fills, monkey skin |
| `--brand-mascot-blue` | `#60a5fa` | `blue-400` | Bot avatar tint, secondary mascot fills |

### State colors

| Token | Value | Tailwind class | Used for |
|---|---|---|---|
| `--state-amber` | `#f59e0b` | `amber-500` | Character counter at 60/70, timer bar at 20s remaining |
| `--state-red` | `#ef4444` | `red-500` | Character counter at 70/70, timer bar last 10s, error mascot |
| `--state-success` | `#10b981` | `emerald-500` | Submit-confirm mascot, ready-toggle on state |

### Surfaces

| Token | Tailwind class | Used for |
|---|---|---|
| Card background | `bg-white` | Player list rows, modal-like containers |
| Subtle divider | `border-amber-200` | Between sections; cream-compatible |
| Disabled button | `bg-gray-300 text-gray-500` | Disabled "One more game" |

**Reduced contrast is forbidden.** No `text-gray-400` on `bg-amber-100`. Text is `gray-800` or `pink-600` on cream. If a state needs to read "disabled," it gets a desaturated card surface, not a low-contrast label.

---

## 3. Typography

| Role | Font family | Weights | Where |
|---|---|---|---|
| Display | `Fredoka` (Google Fonts) | 500, 600, 700 | Wordmark, screen headlines, big buttons |
| Prose | `Georgia, serif` | 400, 400-italic, 700 | Reveal screen story prose only |
| UI | System stack | 400, 600 | Everything else (nicknames, room codes, captions, counter) |

System stack:
```css
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue",
Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"
```

### Sizing scale (Tailwind)

| Use | Class | Notes |
|---|---|---|
| Wordmark | `text-5xl font-bold` | Larger on tablet via `md:text-6xl` |
| Screen headline | `text-3xl font-semibold` | Fredoka |
| Primary button | `text-xl font-semibold` | Fredoka, generous padding |
| Body | `text-base` | UI sans |
| Caption / hint | `text-sm text-gray-600` | Counter, "Waiting for host…" |
| Reveal prose | `text-xl leading-relaxed` | Georgia, single column, max-width `prose` |
| Reveal phrase highlight | `text-pink-600 font-bold` | Inline `<span>` per §8 of spec |

### Russian-script considerations

Fredoka covers Cyrillic; verify weights 500/600/700 actually render in Cyrillic on a real Android device during step 12. If any weight falls back to a system font in Cyrillic only, drop that weight from the Russian Fredoka load and substitute the next-closest weight. Do not introduce a second display face.

---

## 4. Motion presets (Framer Motion)

Three named springs. Use them everywhere. Do not invent a fourth without a reason worth writing down here.

```ts
// client/src/styles/motion.ts
export const snappy = { type: "spring", stiffness: 400, damping: 30 } as const;
export const goofy  = { type: "spring", stiffness: 180, damping: 12 } as const;
export const panic  = { type: "spring", stiffness: 700, damping: 8  } as const;
```

| Preset | Feel | Used on |
|---|---|---|
| `snappy` | Quick, tight, low overshoot | Screen transitions, button press feedback, "Copy link" toast |
| `goofy` | Slow rise, generous overshoot, wobbles into place | Mascot mounts, picture-arrival fade-in, submit-confirm |
| `panic` | Fast, under-damped, visible shake | Timer character at ≤10s, error mascot entrance |

### Screen transitions

Per spec §17 phase transitions, **forward direction = slide left-to-right** is locked. Use `snappy`. No `mode="wait"` between rounds — the outgoing screen exits as the incoming enters, which keeps the perceived round cadence tight.

```tsx
<motion.div
  initial={{ x: "-100%", opacity: 0 }}
  animate={{ x: 0, opacity: 1 }}
  exit={{ x: "100%", opacity: 0 }}
  transition={snappy}
/>
```

### Reduced motion

Honour `prefers-reduced-motion: reduce`. When set:
- Springs collapse to a 150ms linear opacity crossfade. No translation, no scale.
- Mascot idle animations stop. Reactive animations (submit-confirm, picture-arrival) become a one-shot opacity fade.
- Timer character at ≤10s stops shaking; the timer bar still changes color (color is information, not motion).

Implementation: one `useReducedMotion()` hook from Framer Motion at the App root. Pass a context value `motionEnabled: boolean` and gate every spring on it.

---

## 5. Mascot library

Nine SVG components, all under `client/src/components/art/`. Each is an inline React SVG, no external deps, no Lottie, no Rive. Animations come from CSS keyframes (idle loops) or Framer Motion (reactive one-shots). Each component takes a `className` prop for sizing; no other props in v1.

| File | Personality | Idle animation | Reactive animation |
|---|---|---|---|
| `BackgroundDoodle.tsx` | A page from a meeting notebook | None — static (spec §8 forbids animating the background) | — |
| `Wordmark.tsx` | The wordmark in Fredoka pink, slightly tilted; text is per-language via the `home.title` i18n key ("Funny Stories" / "ЧЕПУ-ХА-ХА") | Bounce on mount (`goofy`) | — |
| `BotAvatar.tsx` | A boxy robot with one eye drawn higher than the other | Blink every 4–6s (CSS) | Twitch on appearance |
| `TimerCharacter.tsx` | A round-bodied creature riding the timer bar | Gentle wobble (CSS, 2s loop) | At ≤10s remaining: switch to `panic` shake + wide eyes |
| `SubmitConfirm.tsx` | A tiny celebrating blob | — (mounts on submit) | `goofy` spring entrance, 600ms, then exit |
| `WaitingMascot.tsx` | A creature drumming its fingers on a desk | Finger-tap loop (CSS, 1.2s) | — |
| `PictureFlourish.tsx` | Confetti + sparkle burst | — (one-shot only) | `goofy` spring + radial particle burst on `reveal:pictureReady` |
| `EndMascots.tsx` | Companion characters waving goodbye to the monkeys-on-bus | Gentle wave (CSS, 3s loop) | — |
| `ErrorMascot.tsx` | A sad-but-resigned blob shrugging | Slow blink, occasional shrug (CSS, 5s loop) | `panic` spring on entrance, then settles to idle |

### Mascot construction rules

- **Eyes are mandatory and exaggerated.** Pupils are off-center. At least one eye on any character with a face is misaligned with the other by 1–3 px at the design size.
- **Outlines are visible.** Use `stroke="#1f2937"` `stroke-width="2.5"` on filled shapes. No anti-aliased zero-width strokes.
- **Hand-drawn imperfection.** Lines wobble slightly — no perfectly straight edges except on intentional geometric elements (the bus, the timer bar). Use Bezier curves with deliberate small asymmetries.
- **Fill palette is restricted.** Mascot fills draw from the brand palette (§2). No off-palette colors unless a specific narrative reason is noted in the component file's top comment.
- **No gradients in v1.** Flat fills only. Gradients read as "modern app," which is the wrong personality.
- **viewBox is square 100×100** for all character mascots. Background doodle and wordmark are free-form.

### Sizing in layout

Mascots are sized by parent class only:
```tsx
<TimerCharacter className="w-8 h-8" />
<EndMascots    className="w-32 h-32" />
```
The SVG fills 100% of its container. Never set width/height inside the component.

### Implementer-drafted, designer-reviewed

All nine mascots are drafted by the implementer in build step 13 (Polish) and flagged in the PR description for human design review **post-launch**. The launch criterion is "they exist and they're goofy," not "they're final." Iteration is welcome after v0.1.0 tag.

### Deployer logo stamp (raster, not a mascot)

One exception to the all-SVG rule above: the **deployer logo stamp**
(`LogoStamp.tsx`, sourced from `client/public/deployer-logo.png`) is a
raster asset and a deployer-controlled UI element, not a mascot. Binding
spec: `FUNNY_STORIES_SPEC_v4.md` §25.

- **Size: 25×25 pixels, rendered at native size.** The PNG ships at
  25×25; the component renders it with explicit `width={25}
  height={25}` attributes (no CSS upscaling). Pixel-level branding
  survives intact.
- **Position:** bottom-right corner of the picture container, on the
  reveal screen and in the room gallery. 80% opacity,
  `pointer-events: none`.
- **Default content.** The bundled `deployer-logo.png` is a 25×25
  downscale of the app's `icon-512.png` so an out-of-the-box
  deployment carries a small visible stamp. A deployer who wants no
  stamp deletes the file (or replaces it with a 25×25 fully
  transparent PNG); a deployer who wants their own stamp replaces it
  with their own 25×25 PNG.
- **Size is locked at 25×25.** Changing the dimensions requires
  updating the PNG and the component's `width`/`height` attributes
  in lockstep (a deployer who ships a 64×64 PNG against a 25×25
  component will see the browser downscale it).

---

## 6. Animation triggers per screen

This table is the contract between the spec's screen list (§8) and the mascot library. If a screen is on the list and a mascot trigger is missing, that is a bug.

| Screen | Idle | Reactive |
|---|---|---|
| `HomeScreen` — Create mode | `BackgroundDoodle` (static); `Wordmark` bounces on mount | Language toggle: subtle `snappy` press feedback |
| `HomeScreen` — Join mode | `BackgroundDoodle` (static); `Wordmark` bounces on mount | No language toggle. On `ROOM_NOT_FOUND`: the "room no longer exists" message and "Create a new room" button enter with `snappy` |
| `LobbyScreen` | `BackgroundDoodle`; player list rows stagger-mount with `snappy` (50ms delay each) | New player join: their row enters with `goofy` |
| `RoundScreen` | `BackgroundDoodle`; `TimerCharacter` wobbles on the timer bar | At ≤10s: `TimerCharacter` switches to `panic` shake; timer bar fill goes red |
| `WaitingScreen` | `WaitingMascot` taps fingers; `(submitted/total)` counter ticks with `snappy` | Counter increment: brief scale-pop on the number |
| `RevealScreen` (generating) | `BackgroundDoodle` | Generation auto-starts on mount (no button). Nothing for the first 3s; then `WaitingMascot` mounts with `goofy` as the wait control (spec §8) |
| `RevealScreen` (post-picture) | — | `pictureReady`: image fades in with `goofy` scale, `PictureFlourish` plays once |
| `RevealScreen` (error) | `ErrorMascot` idle | `pictureError`: `ErrorMascot` enters with `panic`, "Try again" button mounts with `snappy` |
| `EndScreen` | `EndMascots` wave; monkeys-on-bus static | Ready toggle: `snappy` thumb-flick; "One more game" disabled state: shake on attempted click. Host's "Share the room's pictures" reveals the room-gallery section on `gallery:ready`; the gallery is browsed prev/next with a static content swap (animated transitions are a post-launch polish item — spec §24) |

**SubmitConfirm timing:** on `round:submit` ack, render the `SubmitConfirm` mascot as an overlay for 600ms before transitioning to `WaitingScreen`. This is the only mascot that mounts and unmounts as a one-shot UI element rather than living on a screen.

---

## 7. Sound

**No sound in v1.** This is locked. Revisit post-launch. If/when sound ships, it requires its own design system section covering: mute default, autoplay policy on iOS Safari, file format, asset weight budget, and the "is this funny or annoying after the third game" test.

---

## 8. Accessibility

Mobile party games can't be fully accessible — they assume a touchscreen, sight, and the ability to read quickly. Within that, v1 does the following:

- All buttons have visible focus rings (`focus:ring-2 focus:ring-pink-500 focus:ring-offset-2`).
- Tap targets ≥ 44×44px. Verify on the smallest target (language toggle) during step 5.
- All mascot SVGs are `aria-hidden="true"`. They are decorative. The functional screen content is in real HTML elements with real text.
- All text meets WCAG AA contrast against its background (verified: `gray-800` on `amber-100` ≈ 11.5:1; `pink-600` on `amber-100` ≈ 5.2:1).
- `prefers-reduced-motion` is honoured per §4.
- Russian and English UI strings are i18n-keyed; no text baked into SVGs.

What v1 does **not** do: screen-reader narration of game state changes, keyboard-only game flow, high-contrast theme. Document this in `CONTRIBUTING.md` as a "good first PR" area.

---

## 9. Out of scope for v1

Listed so a future contributor doesn't waste a week and a PR:

- Lottie, Rive, After Effects exports.
- Video assets of any kind.
- WebGL beyond what cleanly degrades. (No Three.js, no shaders, no Pixi.)
- Sound, music, haptics.
- Dark mode. (The cream background is the brand.)
- Custom cursor.
- Animated favicon.
- A second display face.
- A separate "tablet layout." The mobile portrait layout scales up; tablets and desktops get the same vertical column, centered.

---

## Changelog

### `1.0.8` — 2026-05-23

- **§5 (Deployer logo stamp) — size changed from 50×50 to 25×25 pixels.** Tracks `FUNNY_STORIES_SPEC_v4.md` §25 (v4.28.0). The bundled `deployer-logo.png` is a 25×25 bicubic downscale of `icon-512.png`; `LogoStamp.tsx` renders it at native 25×25 via explicit `width={25} height={25}`. Pixel-perfect-no-CSS-upscale rule unchanged; deployer-replacement procedure unchanged (drop a 25×25 PNG in, rebuild).
- No other changes.

### `1.0.7` — 2026-05-23

- **§5 (Deployer logo stamp) — size changed from 7×7 to 50×50 pixels.** Tracks `FUNNY_STORIES_SPEC_v4.md` §25 (v4.26.0). The bundled `deployer-logo.png` is now a 50×50 bicubic downscale of `icon-512.png`; `LogoStamp.tsx` renders it at native 50×50 via explicit `width={50} height={50}`. Pixel-perfect-no-CSS-upscale rule unchanged; deployer-replacement procedure unchanged (drop a 50×50 PNG in, rebuild).
- No other changes.

### `1.0.6` — 2026-05-23

- **§5 — added "Deployer logo stamp (raster, not a mascot)" subsection.** Tracks `FUNNY_STORIES_SPEC_v4.md` §25 (v4.22.0). The bundled `deployer-logo.png` is now a 7×7 downscale of `icon-512.png` and is rendered at native 7×7 pixels by `LogoStamp.tsx` (explicit `width={7} height={7}`, no CSS upscaling). The previous "ships fully transparent, off by default" stance is reversed — there is now a small visible default stamp; deployers who want no stamp delete the file or replace it with a 7×7 transparent PNG.
- No other changes.

### `1.0.5` — 2026-05-22

- **§5 (Mascot library) — the wordmark text is now per-language.** Tracks `FUNNY_STORIES_SPEC_v4.md` §21 (v4.8.0). `Wordmark.tsx` no longer hardcodes "Funny Stories"; it renders the `home.title` i18n key, so the wordmark is "Funny Stories" in English and "ЧЕПУ-ХА-ХА" in Russian. The §5 table row is updated accordingly.
- No other changes.

### `1.0.4` — 2026-05-22

- **§6 (Animation triggers per screen) — reveal-screen picture flow and the new end-screen gallery.** Tracks `FUNNY_STORIES_SPEC_v4.md` §8 / §24 (v4.5.0). The reveal screen no longer has a "Generate Picture" button: generation auto-starts on mount, and the `WaitingMascot` wait control appears only after a 3-second delay. The `EndScreen` row now covers the host's "Share the room's pictures" control and the browsable room-gallery section. `WaitingMascot` is consequently used on both the waiting screen and the reveal screen.
- No other changes.

### `1.0.3` — 2026-05-22

- **§6 (Animation triggers per screen) — `HomeScreen` split into Create and Join modes.** Tracks `FUNNY_STORIES_SPEC_v4.md` §8 (v4.4.0): the Home screen now has two modes selected by the `?room=` URL parameter. The single `HomeScreen` row in the §6 table is replaced by two rows — Create mode (wordmark + language toggle) and Join mode (wordmark, no language toggle; the `ROOM_NOT_FOUND` message and "Create a new room" button enter with `snappy`). Motion presets unchanged.
- No other changes.

### `1.0.2` — 2026-05-21

- **§5 & §6 (Mascot library / animation triggers) — conflict fix.** `BackgroundDoodle` was described as having a "slow horizontal drift, 60s loop" idle animation, and §6 said it "drifts" on `HomeScreen`. The binding spec `FUNNY_STORIES_SPEC_v4.md` §8 states "Do not animate the background." Corrected both to **static** (spec wins on conflict per the scope note above). Found during build step 13.
- No other changes.

### `1.0.1` — 2026-05-20

- **§2 (Color tokens) — conflict fix.** The `--state-amber` row said the timer bar turns amber at "30s remaining"; the binding spec `FUNNY_STORIES_SPEC_v4.md` §8 specifies the last 20s. Corrected to "20s remaining" to match the spec (spec wins on conflict).
- No other changes.

### `1.0.0` — 2026-05-17

- Initial cut. Personality, color tokens, typography, motion presets (`snappy` / `goofy` / `panic`), mascot library (nine SVGs from spec §21), per-screen animation triggers, reduced-motion rules, accessibility notes, and v1 out-of-scope list.
- Companion to `FUNNY_STORIES_SPEC_v4.md`. Spec wins on conflicts.
