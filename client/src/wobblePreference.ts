// SPDX-License-Identifier: AGPL-3.0-only

// Per-user preference for which engine renders + records the 5-second gallery
// wobble. CSS keyframes are cheap and ship by default (~1 KB inline rules);
// Lottie is opt-in for richer animation control at the cost of ~250 KB of
// `lottie-web` in the bundle (lazy-loaded only when the user opts in).
//
// The choice is shown only to the game starter on the Home screen — joiners
// inherit the default. Storage is plain localStorage; nothing here is sent
// to the server.

const KEY = 'fs:wobbleEngine';

export type WobbleEngine = 'css' | 'lottie';

export const DEFAULT_WOBBLE_ENGINE: WobbleEngine = 'css';

export function getWobbleEngine(): WobbleEngine {
  try {
    const stored = window.localStorage.getItem(KEY);
    return stored === 'lottie' || stored === 'css' ? stored : DEFAULT_WOBBLE_ENGINE;
  } catch {
    return DEFAULT_WOBBLE_ENGINE;
  }
}

export function setWobbleEngine(engine: WobbleEngine): void {
  try {
    window.localStorage.setItem(KEY, engine);
  } catch {
    // Private-mode Safari and other strict storage policies will throw — the
    // preference simply doesn't persist, which is fine.
  }
}
