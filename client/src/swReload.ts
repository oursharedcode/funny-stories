// SPDX-License-Identifier: AGPL-3.0-only

// Auto-reload when a new service worker takes over (spec §13).
//
// Pairs with the NetworkFirst navigation strategy in vite.config.ts:
// - NetworkFirst handles the "user opens the app after a deploy" case
//   (a fresh navigation goes to the network and gets the new shell).
// - This listener handles the "user has the tab open through a deploy"
//   case (the SW updates in the background; when it activates, the
//   running page reloads on the next available tick to pick up the new
//   bundle).
//
// Without this, registerType: 'autoUpdate' would update the SW silently
// but leave the currently-loaded page on the old code until the user
// manually refreshed — the symptom that drove backlog item 16.

let refreshing = false;

export function installSwReloadListener(): void {
  if (typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // controllerchange also fires the first time a SW claims the page,
    // when there was no previous controller. Reloading then would loop
    // forever. The guard makes sure we only reload once per session.
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
