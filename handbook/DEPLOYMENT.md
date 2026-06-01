# Deployment (full guide)

The root [README](../README.md) covers the simplest path (two buttons, free tier). This is the complete reference: Render details, Docker self-hosting, the Cloudflare Worker, and the gotchas that bite.

Both deploy paths need the **Cloudflare Worker** for image generation. **Deploy the Worker first** — its URL doesn't exist until it's live, and the game server needs that URL.

---

## Deploying the Cloudflare Worker

The Worker handles AI image generation. It's separate from the Node service and stays on Cloudflare's free tier.

### 1. Generate a shared secret S

Any high-entropy string, 32+ chars. Use whichever one-liner matches the machine you have open:

```bash
openssl rand -hex 32                                                       # macOS / Linux / Git Bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # any machine with Node 20
```
```powershell
[guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")          # Windows PowerShell
```

No terminal handy? Make **S** by hand: **at least 32 characters**, **only letters and digits** (`A–Z a–z 0–9`), **no spaces, no symbols**, genuinely random-looking — not a word or a date. (Symbols and spaces get mangled differently by shells and config fields, silently breaking the both-sides match; letters and digits are safe.)

Copy **S** once — you paste it in two places (the Worker and the Node service) and never type it again.

### 2. Deploy

**One-click (recommended):**

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/oursharedcode/funny-stories/tree/master/cloudflare)

The button reads the `cloudflare/` folder from this public repo and creates a **new Worker repo on your own GitHub + Cloudflare account**. After it deploys, you **must** set the secret yourself (the button can't): **dashboard → your Worker → Settings → Variables →** `WORKER_SECRET = S`. Until you do, the Worker returns 403 to every request.

**Or via the CLI:**

```bash
npm install -g wrangler
wrangler login
cd cloudflare
wrangler deploy
wrangler secret put WORKER_SECRET   # paste S
```

Note the deployed URL (`https://funny-stories-image.<your-account>.workers.dev`). Set:

- The Worker's `WORKER_SECRET` = **S**
- The Node service's `CLOUDFLARE_WORKER_URL` (the deployed URL) and `CLOUDFLARE_WORKER_SECRET` = **S** (same value, both sides)

If the secrets don't match, the Worker returns 403 and `Generate picture` shows a friendly error on every phone. That's the right behaviour — it's what protects the free-tier neuron budget from public scraping.

### Optional (advanced) — persistent image counter (Cloudflare KV)

By default the Worker ships with KV **disabled**, so the one-click button works in any account (a hard-coded KV namespace id only works in the account that created it). The Worker runs fine without it. This section is for an advanced operator who wants the daily image count to survive restarts; it walks through the full mechanism and the code that implements it.

#### The Render spin-down issue (why this exists)

The daily image ceiling (`MAX_IMAGES_PER_DAY`, default 25) is enforced by a **process-global counter that lives only in the Node service's memory**, resetting at 00:00 UTC. On Render's **free** tier this matters:

- The service **spins down after ~15 minutes idle**.
- On the next request it **cold-starts a fresh process** — and the in-memory counter is back to **0**.

So a host who generated 20 cartoons, went idle, and came back later finds the count reset to 0 and the daily cap effectively restarted. For casual use this is harmless. But if you want the cap to be a *true* per-UTC-day total that survives spin-downs (and is shared across restarts), you need a store that outlives the process. Cloudflare KV — already sitting next to the Worker — is that store. **Without KV, the counter is accurate only within one continuous run; with KV, it is recovered after every cold start.** (The label the host sees was made deployment-agnostic on purpose — *"Up to N cartoons per day. Resets daily at 00:00 UTC."* — precisely because the live tally can't be trusted across spin-downs in the default deployment.)

#### How the two layers cooperate

The Node service (`server/src/image.ts`) keeps two numbers and surfaces the **max** of them:

- `imagesToday` — the in-process counter, incremented synchronously inside `reserveImageSlot()` *before* the Worker call. Authoritative for reservation, so concurrent rooms can't overshoot the cap.
- `workerCount` — the last value read from the Worker's KV-backed counter, refreshed lazily (30 s TTL) via `/stats`. Survives the cold start that resets `imagesToday` to 0.

Within a live session the local counter dominates (correct and immediate); after a Render restart the KV counter dominates (recovered). The cap check uses the same `max`, so a cold-started process whose KV count already exceeds the limit correctly refuses new reservations.

#### Step 1 — create your namespace and enable it

```bash
wrangler kv namespace create STATS_KV            # prints your id
wrangler kv namespace create STATS_KV --preview  # prints your preview_id
```

Then uncomment the `[[kv_namespaces]]` block in `cloudflare/wrangler.toml` and paste **your** `id` / `preview_id`. (Never commit someone else's id — it belongs to the account that minted it and breaks every other deployer's button.)

#### Step 2 — the Worker side (`cloudflare/worker.js`)

The Worker treats `STATS_KV` as optional and bumps it best-effort after each successful generation; a KV failure must never break image generation. It also exposes `/stats` for the Node service to poll:

```js
const KV_KEY_PREFIX = 'count:';
const KV_TTL_SECONDS = 60 * 60 * 48; // 48 h — yesterday's key self-expires

// GET /stats → { date: "YYYY-MM-DD", count: N }
if (url.pathname === '/stats') {
  const date = utcDayKey();
  const count = env.STATS_KV ? await readCount(env.STATS_KV, date) : 0;
  return new Response(JSON.stringify({ date, count }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// …after a successful env.AI.run(...) generation:
if (env.STATS_KV) {
  try {
    const date = utcDayKey();
    const current = await readCount(env.STATS_KV, date);
    await env.STATS_KV.put(`${KV_KEY_PREFIX}${date}`, String(current + 1), {
      expirationTtl: KV_TTL_SECONDS,
    });
  } catch {
    // Intentional: KV is observational, never authoritative — ignore failures.
  }
}

async function readCount(kv, date) {
  const raw = await kv.get(`${KV_KEY_PREFIX}${date}`);
  const n = Number.parseInt(raw ?? '0', 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function utcDayKey() {
  return new Date().toISOString().slice(0, 10);
}
```

KV has no atomic increment, so two truly-concurrent generations could under-count by one in a rare race; the Node service still tracks its own counter and surfaces `max(local, kv)`, so the visible count stays monotonic.

#### Step 3 — the Node service side (`server/src/image.ts`)

The service polls `/stats` (TTL-bounded) and folds the result into `workerCount`, guarded by a day-rollover check so a pre-midnight count never stamps onto the new day:

```js
let imagesToday = 0;
let workerCount = 0;

export function reserveImageSlot() {
  rolloverIfNewDay();
  if (imagesGeneratedToday() >= maxImagesPerDay()) return false;
  imagesToday++;
  return true;
}

export function imagesGeneratedToday() {
  return Math.max(imagesToday, workerCount); // local live, KV recovers after restart
}

export async function syncImageCounterFromWorker() {
  rolloverIfNewDay();
  const res = await fetch(`${workerUrl}/stats`, { headers: { 'X-Secret': secret } });
  if (!res.ok) return;
  const data = await res.json();
  if (data?.date === utcDayKey() && typeof data.count === 'number' && data.count >= 0) {
    workerCount = Math.floor(data.count);
  }
}
```

The full, production version (timeouts via `AbortController`, the 30 s sync TTL, startup eager-sync, and silent network-failure absorption) is in `server/src/image.ts`. With this in place the host's cap is a real per-UTC-day total that survives Render's spin-downs.

---

## Option A — Render (recommended for a hosted instance)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/oursharedcode/funny-stories)

1. Click the button above, or push this repo to your own Render account.
2. In the Render dashboard, set the following environment variables on the service:

   | Variable | Required | Description |
   |---|---|---|
   | `CLOUDFLARE_WORKER_URL` | yes | `https://funny-stories-image.<your-account>.workers.dev`, from the Worker step above. |
   | `CLOUDFLARE_WORKER_SECRET` | yes | The same secret **S** you set on the Worker. |
   | `DEPLOYER_DONATE_URL` | no | If set, the end screen shows a small **Support this server** button linking here. **Donations go to *you*, the operator** — not to the upstream author. Leave unset for no button. |
   | `MAX_ROOMS` | no | Concurrent room ceiling. Default 500. Safe to leave unset on the free plan. |
   | `MAX_IMAGES_PER_DAY` | no | Daily Cloudflare AI image ceiling per process (resets 00:00 UTC). Default 25. |
   | `NODE_VERSION` | yes | `20` (already in `render.yaml`). |
   | `NODE_ENV` | yes | `production` (already in `render.yaml`). |

3. Render auto-builds on push to `master`. First deploy takes ~3 minutes.
4. Visit your `.onrender.com` URL on a real phone and run the [acceptance test](../docs/FUNNY_STORIES_SPEC_v4.md#19-acceptance-test).

**Render free-tier caveats.** Single instance, ~512 MB RAM, no horizontal scaling. The game is deliberately built for this — room state is in-memory, so adding instances breaks rooms across them. The free tier also **spins the service down when idle**: the first visit after a quiet period waits a few seconds for a cold start, and because rooms are in-memory, a spin-down **ends any rooms that were still open**. The host's *"Images today"* counter is also in-memory and resets on every spin-down (see KV above for persistence). Render's free tier allows up to 15 free web services per account, and needs no credit card. Upgrade the one service to a paid plan for always-on, no-cold-start behaviour.

---

## Option B — Docker (self-hosted)

For people running their own VPS, homelab, or Kubernetes. The image is small and stateless.

```bash
# Build
docker build -t funny-stories:latest .

# Run
docker run -d \
  --name funny-stories \
  -p 3000:3000 \
  -e CLOUDFLARE_WORKER_URL="https://funny-stories-image.<your-account>.workers.dev" \
  -e CLOUDFLARE_WORKER_SECRET="<the secret>" \
  -e DEPLOYER_DONATE_URL="" \
  -e MAX_ROOMS="500" \
  -e NODE_ENV="production" \
  funny-stories:latest
```

Or with Docker Compose — `docker-compose.yml` is checked in at the repo root:

```bash
cp .env.example .env   # fill in CLOUDFLARE_WORKER_URL and CLOUDFLARE_WORKER_SECRET
docker compose up -d
```

**Reverse-proxy notes.**

- Terminate TLS at your proxy (Caddy, nginx, Traefik). The container listens HTTP on port 3000.
- WebSockets must pass through. For nginx: `proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`. For Caddy: `reverse_proxy` already handles this. For Traefik: ensure your router accepts the `Upgrade: websocket` header.
- The rate limiter reads `x-forwarded-for`. Make sure your proxy sets it correctly, or operators behind multiple hops will all share one bucket.

**No volumes needed.** The game writes nothing to disk. The container can be killed and restarted at any time; in-flight games will end (their players become bots, as expected by design).

---

## Deployment gotchas

Most of these fail *silently* — no error points at the cause.

| Symptom | Cause / fix |
|---|---|
| `Generate picture` errors on **every** phone | `WORKER_SECRET` not set, or the two secrets aren't identical. Set it on the Worker; paste the *same* value into the Node service. |
| Cloudflare build fails / button 404s | the repo must be **public** (the button reads `cloudflare/` over the public URL), and the button URL's branch must match the default branch (`master`, not `main`). |
| Cloudflare deploy errors "KV namespace not valid" | a `[[kv_namespaces]]` block with another account's id — keep it commented out (it's optional). |
| Game slow / cold after idle | expected on Render's **free** tier — it spins down when idle and ends open rooms. Upgrade the service for always-on. |
| Cloudflare button hits an org wall | a GitHub **org** that restricts third-party apps needs an **org owner** to approve Cloudflare's GitHub App. |

**Expect two repos and a GitHub App.** The Cloudflare button creates a separate worker-only repo on your account and installs Cloudflare's GitHub App (ongoing auto-deploy access — reviewable at GitHub → Settings → Applications). The Render service deploys from the full repo. Two repos is normal, not a mistake.

**You are the operator of record.** You create the accounts and click deploy, so you own your instance and the content your players generate. The default config ships basic safeguards (server-side profanity filter, a goofy-cartoon style suffix); review them before running a public instance. See [MODERATION.md](./MODERATION.md).

---

## Accepting donations from *your* players

If you run a public instance and want a small "Support this server" button on the end screen, set `DEPLOYER_DONATE_URL` to your own donation page (Buy Me a Coffee, Ko-fi, GitHub Sponsors, Patreon, YuMoney, anything). The button only appears when this variable is set. **Donations go to you, the operator, not to the upstream author** — this is by design and is a [structural property of the AGPL distribution path](../docs/FUNNY_STORIES_SPEC_v4.md#18-things-not-to-do). The upstream author is supported only through the GitHub Sponsors link in the root README.
