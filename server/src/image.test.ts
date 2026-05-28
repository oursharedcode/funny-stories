// SPDX-License-Identifier: AGPL-3.0-only

// Vol02 follow-up to BUGS_AND_IMPROVEMENTS_01.md item 22 — the Render
// free-tier spin-down resets the server's in-memory `imagesToday` to 0,
// so the player-visible "Images today" counter lies about the day's
// real usage. The fix layers a Cloudflare KV-backed counter on the
// Worker side (cloudflare/worker.js) and a TTL-bounded sync helper on
// the server side that returns max(local, kv). These tests pin the
// server's half of that contract.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetImageCounterStateForTests,
  imagesGeneratedToday,
  maybeSyncImageCounter,
  reserveImageSlot,
  syncImageCounterFromWorker,
} from './image.js';

const todayKey = new Date().toISOString().slice(0, 10);

function mockFetchOk(payload: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

beforeEach(() => {
  __resetImageCounterStateForTests();
  process.env.CLOUDFLARE_WORKER_URL = 'https://worker.example.com';
  process.env.CLOUDFLARE_WORKER_SECRET = 'shh';
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.CLOUDFLARE_WORKER_URL;
  delete process.env.CLOUDFLARE_WORKER_SECRET;
});

describe('image counter — Worker-side KV persistence (vol02 follow-up to item 22)', () => {
  it('returns local count when worker has not been synced', () => {
    expect(imagesGeneratedToday()).toBe(0);
    reserveImageSlot();
    reserveImageSlot();
    expect(imagesGeneratedToday()).toBe(2);
  });

  it('returns max(local, worker) — KV value wins after a server restart', async () => {
    // Simulate Render cold start: local counter is 0, worker reports today's
    // real count of 17.
    vi.stubGlobal('fetch', mockFetchOk({ date: todayKey, count: 17 }));
    await syncImageCounterFromWorker();
    expect(imagesGeneratedToday()).toBe(17);
  });

  it('returns local count when local exceeds worker (in-session generation)', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ date: todayKey, count: 5 }));
    await syncImageCounterFromWorker();
    expect(imagesGeneratedToday()).toBe(5);
    // Local counter ticks up past the (stale) worker snapshot.
    for (let i = 0; i < 8; i++) reserveImageSlot();
    expect(imagesGeneratedToday()).toBe(8);
  });

  it('cap reservation uses max(local, worker) — cold-started process correctly refuses when KV is already at the limit', async () => {
    process.env.MAX_IMAGES_PER_DAY = '25';
    vi.stubGlobal('fetch', mockFetchOk({ date: todayKey, count: 25 }));
    await syncImageCounterFromWorker();
    expect(reserveImageSlot()).toBe(false);
    delete process.env.MAX_IMAGES_PER_DAY;
  });

  it('ignores a worker payload for a different UTC day (rollover safety)', async () => {
    vi.stubGlobal('fetch', mockFetchOk({ date: '1999-12-31', count: 999 }));
    await syncImageCounterFromWorker();
    expect(imagesGeneratedToday()).toBe(0);
  });

  it('silently absorbs a worker fetch failure and leaves the counter unchanged', async () => {
    reserveImageSlot();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    await expect(syncImageCounterFromWorker()).resolves.toBeUndefined();
    expect(imagesGeneratedToday()).toBe(1);
  });

  it('silently absorbs a non-2xx response and leaves the counter unchanged', async () => {
    reserveImageSlot();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    await syncImageCounterFromWorker();
    expect(imagesGeneratedToday()).toBe(1);
  });

  it('returns 0 with no fetch attempt when CLOUDFLARE_WORKER_URL is unset', async () => {
    delete process.env.CLOUDFLARE_WORKER_URL;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await syncImageCounterFromWorker();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(imagesGeneratedToday()).toBe(0);
  });
});

describe('maybeSyncImageCounter — TTL-bounded refresh', () => {
  it('hits the network on the first call', async () => {
    const fetchSpy = mockFetchOk({ date: todayKey, count: 3 });
    vi.stubGlobal('fetch', fetchSpy);
    await maybeSyncImageCounter();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(imagesGeneratedToday()).toBe(3);
  });

  it('skips the network on a follow-up call within the TTL window', async () => {
    const fetchSpy = mockFetchOk({ date: todayKey, count: 3 });
    vi.stubGlobal('fetch', fetchSpy);
    await maybeSyncImageCounter();
    await maybeSyncImageCounter();
    await maybeSyncImageCounter();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
