// SPDX-License-Identifier: AGPL-3.0-only
//
// Cloudflare Worker — Workers AI image generation for Funny Stories (spec §15).
// Deployed separately from the Render service via `wrangler deploy`.
// NOT an npm workspace.
//
// Endpoints (both require the X-Secret header):
//   GET /generate?prompt=… → JPEG/PNG image bytes (Flux Schnell, 4 steps).
//   GET /stats             → { date: "YYYY-MM-DD", count: N } JSON from KV.
//
// The KV-backed counter (STATS_KV binding, see wrangler.toml) survives the
// Render free-tier spin-down that resets the server's in-memory counter.
// Vol02 follow-up to BUGS_AND_IMPROVEMENTS_01.md item 22.

const KV_KEY_PREFIX = 'count:';
// 48 h — yesterday's key is garbage-collected without ever being read.
const KV_TTL_SECONDS = 60 * 60 * 48;

export default {
  async fetch(request, env) {
    // Shared-secret check — prevents public abuse of the free tier (spec §15, §18).
    const secret = request.headers.get('X-Secret');
    if (!secret || secret !== env.WORKER_SECRET) {
      return new Response('Forbidden', { status: 403 });
    }

    const url = new URL(request.url);

    // ── GET /stats ──────────────────────────────────────────────────────
    // Server polls this lazily (30 s TTL) to recover the day-total after
    // a Render restart. Returns 0 when the KV binding is unconfigured or
    // the key is absent — neither is an error condition.
    if (url.pathname === '/stats') {
      const date = utcDayKey();
      const count = env.STATS_KV ? await readCount(env.STATS_KV, date) : 0;
      return new Response(JSON.stringify({ date, count }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── GET /generate ───────────────────────────────────────────────────
    const prompt = url.searchParams.get('prompt');
    if (!prompt) return new Response('Missing prompt', { status: 400 });

    let result;
    try {
      result = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
        prompt,
        steps: 4, // minimum cost on the free tier — never raise (spec §18, §15)
      });
    } catch (err) {
      return new Response(`AI error: ${err}`, { status: 502 });
    }

    // Best-effort KV bump after successful generation. KV has no atomic
    // increment, so two concurrent generations could under-count by one in
    // the rare race; the Render server still tracks its local counter and
    // surfaces max(local, kv) to the player, so the visible count remains
    // monotonic. A KV failure must never break image generation — wrapped
    // in try/catch and ignored.
    if (env.STATS_KV) {
      try {
        const date = utcDayKey();
        const current = await readCount(env.STATS_KV, date);
        await env.STATS_KV.put(`${KV_KEY_PREFIX}${date}`, String(current + 1), {
          expirationTtl: KV_TTL_SECONDS,
        });
      } catch {
        // Intentional: KV is observational, not authoritative for reservation.
      }
    }

    // Flux Schnell returns { image: "<base64>" }. Decode to raw bytes so the
    // Render server can arrayBuffer() it directly (spec §11). Older Workers AI
    // image models returned a raw byte stream — handle that as a fallback.
    if (result && typeof result === 'object' && typeof result.image === 'string') {
      const bytes = Uint8Array.from(atob(result.image), (c) => c.charCodeAt(0));
      return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg' } });
    }
    return new Response(result, { headers: { 'Content-Type': 'image/png' } });
  },
};

async function readCount(kv, date) {
  const raw = await kv.get(`${KV_KEY_PREFIX}${date}`);
  const n = Number.parseInt(raw ?? '0', 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function utcDayKey() {
  return new Date().toISOString().slice(0, 10);
}
