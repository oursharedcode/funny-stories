// SPDX-License-Identifier: AGPL-3.0-only

const MAX_RETRIES = 2;
const TIMEOUT_MS = 15_000;
const STATS_TIMEOUT_MS = 3_000;
const RETRY_DELAY_MS = 1_000;
const MAX_IMAGES_PER_DAY_DEFAULT = 25;

// Read lazily so process.env is populated (env.ts) before first use.
export function maxImagesPerDay(): number {
  const v = Number(process.env.MAX_IMAGES_PER_DAY);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : MAX_IMAGES_PER_DAY_DEFAULT;
}

// ============================================================================
// Daily image cap (spec §11, §17)
//
// Process-global counter, shared across ALL rooms — the Cloudflare Workers AI
// Neuron budget is account-wide, not per-room. Resets at 00:00 UTC.
//
// Two layers cooperate:
//
//   • `imagesToday` (this module) — in-process counter, incremented atomically
//     inside `reserveImageSlot()` BEFORE the Worker call is awaited. This is
//     authoritative for reservation: concurrent reservations from multiple
//     rooms cannot overshoot the cap because the check + increment are
//     synchronous JS.
//
//   • `workerCount` (this module) — last-known value from the Cloudflare
//     Worker's KV-backed counter. Refreshed lazily via `maybeSyncImageCounter`
//     (TTL-bounded) and eagerly on server startup. Survives the Render free-
//     tier spin-down that resets `imagesToday` to 0 (vol02 follow-up to
//     BUGS_AND_IMPROVEMENTS_01.md item 22).
//
// `imagesGeneratedToday()` returns the **max** of the two, so:
//   – Within a session: local counter dominates (correct and live).
//   – After a Render restart: KV counter dominates (recovered).
// The cap check uses the same max, so the next reservation correctly fails
// when the KV counter already exceeds the limit even if the local counter is
// still 0 from a cold start.
// ============================================================================

let imagesToday = 0;
let dayKey = utcDayKey();
let workerCount = 0;
let lastWorkerSyncMs = 0;
const WORKER_SYNC_TTL_MS = 30_000;

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Day rollover at 00:00 UTC resets both counters. Called by `reserveImageSlot`
// (the only mutator) and by the sync path (which guards against stamping a
// pre-rollover Worker count onto today).
function rolloverIfNewDay(): void {
  const today = utcDayKey();
  if (today === dayKey) return;
  dayKey = today;
  imagesToday = 0;
  workerCount = 0;
  lastWorkerSyncMs = 0;
}

// Fetches the Worker's /stats endpoint and refreshes `workerCount` when the
// response reports today's UTC day. Network failures are silently absorbed —
// the local counter remains a safe fallback. The stamp on `lastWorkerSyncMs`
// is set on completion (success or failure) to bound retry frequency.
export async function syncImageCounterFromWorker(): Promise<void> {
  rolloverIfNewDay();
  const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
  const secret = process.env.CLOUDFLARE_WORKER_SECRET;
  if (!workerUrl || !secret) {
    lastWorkerSyncMs = Date.now();
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STATS_TIMEOUT_MS);
  try {
    const res = await fetch(`${workerUrl}/stats`, {
      headers: { 'X-Secret': secret },
      signal: controller.signal,
    });
    if (!res.ok) return;
    const data = (await res.json()) as { date?: unknown; count?: unknown };
    if (data?.date === utcDayKey() && typeof data.count === 'number' && data.count >= 0) {
      workerCount = Math.floor(data.count);
    }
  } catch {
    // Intentionally ignored — see header comment.
  } finally {
    clearTimeout(timer);
    lastWorkerSyncMs = Date.now();
  }
}

// TTL-bounded sync. The first call after startup (or after the TTL expires)
// awaits the Worker round-trip; subsequent calls within the TTL window resolve
// immediately. Use this in request handlers (e.g. `stats:get`) to keep the
// surfaced count fresh without blocking on every request.
export async function maybeSyncImageCounter(): Promise<void> {
  if (lastWorkerSyncMs > 0 && Date.now() - lastWorkerSyncMs < WORKER_SYNC_TTL_MS) {
    return;
  }
  await syncImageCounterFromWorker();
}

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

// Test-only — lets tests reset module state between cases. Not part of the
// public API; production code has no reason to call this.
export function __resetImageCounterStateForTests(): void {
  imagesToday = 0;
  workerCount = 0;
  lastWorkerSyncMs = 0;
  dayKey = utcDayKey();
}

// ============================================================================
// Worker call (spec §11)
// ============================================================================

// Calls the Cloudflare Worker, retries on failure, times out per attempt via
// AbortController (which actually cancels the in-flight request, unlike a bare
// Promise.race). Returns a base64 data URL. Throws on exhausted retries or
// missing configuration. Never logs the request — only status codes surface
// in errors, so the X-Secret header cannot leak (docs/Cloudflare_usage.md).
export async function generateImage(prompt: string): Promise<string> {
  const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
  const secret = process.env.CLOUDFLARE_WORKER_SECRET;
  if (!workerUrl || !secret) {
    throw new Error('Cloudflare Worker not configured');
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(
        `${workerUrl}/generate?prompt=${encodeURIComponent(prompt)}`,
        { headers: { 'X-Secret': secret }, signal: controller.signal },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = await res.arrayBuffer();
      const contentType = res.headers.get('content-type') ?? 'image/png';
      const b64 = Buffer.from(buffer).toString('base64');
      return `data:${contentType};base64,${b64}`;
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('unreachable');
}
