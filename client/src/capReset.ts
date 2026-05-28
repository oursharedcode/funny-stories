// SPDX-License-Identifier: AGPL-3.0-only

// Hours until the next UTC midnight — used by the cap-reached UX (item 4
// of BUGS_AND_IMPROVEMENTS_02.md). The server enforces the daily image
// cap with a process-global counter that resets at 00:00 UTC
// (server/src/image.ts, spec §11 "Daily image cap"); when the cap fires
// either pre-game in the Lobby or at reveal time, the client tells the
// user roughly when generation will resume.
//
// Rounding: `Math.ceil` so a near-midnight value never displays as "0
// hours". The minimum we ever show is 1 — even at 23:59:59 UTC we say
// "in 1 hour" rather than "in 0 hours" or "right now".
//
// Why client-side: avoids an extra socket round-trip on every Lobby
// mount, and the time-zone-independent UTC arithmetic is identical
// across server and client. A misset client clock would mis-display, but
// the worst-case UX is a slightly-wrong hour estimate on a message the
// user can already see is approximate ("~N hours").
export function hoursUntilUtcMidnight(now: Date = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  const msLeft = next - now.getTime();
  return Math.max(1, Math.ceil(msLeft / 3_600_000));
}

// Convenience: true when the live stats payload says today's image
// allowance is fully consumed. The Lobby uses this to show a banner,
// and the Home screen uses it to dim the create-room CTA.
export function isCapReached(
  stats: { imagesGeneratedToday: number; imagesLimit: number } | null,
): boolean {
  if (!stats) return false;
  return stats.imagesGeneratedToday >= stats.imagesLimit;
}
