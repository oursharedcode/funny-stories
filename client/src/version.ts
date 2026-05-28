// SPDX-License-Identifier: AGPL-3.0-only

// Build-time constants injected by Vite (see client/vite.config.ts). The
// version comes from client/package.json; the date is set when the bundle
// is built. Both are surfaced by the source footer (spec §27) so a player
// — and the operator looking over their shoulder — can tell which deploy
// is actually running, which matters when a PWA shell may be cached from
// a previous deploy (backlog item 16).
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

export const APP_VERSION: string = __APP_VERSION__;
export const BUILD_DATE: string = __BUILD_DATE__;
