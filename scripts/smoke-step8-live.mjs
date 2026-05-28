// SPDX-License-Identifier: AGPL-3.0-only
//
// Live end-to-end test for spec §16 step 8 — generates a REAL cartoon via the
// deployed Cloudflare Worker. Requires the dev server running with a valid
// .env (CLOUDFLARE_WORKER_URL + CLOUDFLARE_WORKER_SECRET).

import { io as ioc } from 'socket.io-client';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = 'http://localhost:3000';
const ROUNDS = 7;
const OUT_DIR = 'c:/Mark/Dev/monkeybus/test-output';

// All players submit the same answer each round, so every story ends up
// identical and the cartoon is predictable.
const ANSWERS = [
  'a sleepy cat',
  'with a clumsy robot',
  'in an erupting volcano',
  'at exactly midnight',
  'danced the tango badly',
  'to win a free sandwich',
  'everyone got a tiny medal',
];

function connect() {
  return new Promise((resolve, reject) => {
    const s = ioc(URL, { transports: ['websocket'], reconnection: false });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}
function emit(s, ev, payload) {
  return new Promise((resolve) => s.emit(ev, payload, (ack) => resolve(ack)));
}
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

function waitFor(socket, events, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ type: 'timeout' }), timeoutMs);
    for (const ev of events) {
      socket.once(ev, (payload) => {
        clearTimeout(timer);
        resolve({ type: ev, payload });
      });
    }
  });
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL:', msg); failures++; }
  else console.log('  ✓', msg);
}

function saveDataUrl(dataUrl, basename) {
  const m = dataUrl.match(/^data:(image\/[\w.+-]+);base64,(.+)$/s);
  if (!m) return null;
  const ext = m[1].split('/')[1].replace(/[^\w]/g, '');
  const bytes = Buffer.from(m[2], 'base64');
  mkdirSync(OUT_DIR, { recursive: true });
  const path = `${OUT_DIR}/${basename}.${ext}`;
  writeFileSync(path, bytes);
  return { path, bytes: bytes.length, mime: m[1] };
}

async function main() {
  console.log('\n— Connect 3 clients, create + join —');
  const A = await connect();
  const B = await connect();
  const C = await connect();
  const sockets = [A, B, C];

  const created = await emit(A, 'room:create', { nickname: 'Alice', language: 'en' });
  const code = created.roomCode;
  await emit(B, 'room:join', { roomCode: code, nickname: 'Bob' });
  await emit(C, 'room:join', { roomCode: code, nickname: 'Carol' });

  console.log('\n— Play 7 rounds to reach reveal phase —');
  A.emit('game:start');
  await tick(300);
  for (let r = 0; r < ROUNDS; r++) {
    for (const s of sockets) s.emit('round:submit', { answer: ANSWERS[r] });
    await tick(150);
  }
  await tick(600);

  console.log('\n— Request picture for Alice (REAL Cloudflare AI call) —');
  A.emit('reveal:requestPicture');
  const r1 = await waitFor(A, ['reveal:pictureReady', 'reveal:pictureError'], 50000);

  if (r1.type === 'timeout') {
    console.error('  ✗ FAIL: timed out (50s) waiting for picture');
    failures++;
  } else if (r1.type === 'reveal:pictureError') {
    console.error(`  ✗ FAIL: reveal:pictureError — "${r1.payload.message}"`);
    failures++;
  } else {
    const url = r1.payload.pictureUrl;
    assert(typeof url === 'string' && url.startsWith('data:image/'), 'pictureReady -> data:image/ URL');
    assert(url.length > 5000, `image payload is substantial (${url.length} base64 chars)`);
    const saved = saveDataUrl(url, 'cartoon-alice');
    if (saved) {
      console.log(`  ✓ cartoon saved: ${saved.path}`);
      console.log(`    (${saved.mime}, ${(saved.bytes / 1024).toFixed(1)} KB)`);
    } else {
      console.error('  ✗ FAIL: could not parse the data URL');
      failures++;
    }

    console.log('\n— Request again: write-once cache (spec §11) —');
    const t0 = Date.now();
    A.emit('reveal:retryPicture');
    const r2 = await waitFor(A, ['reveal:pictureReady', 'reveal:pictureError'], 10000);
    const dt = Date.now() - t0;
    assert(r2.type === 'reveal:pictureReady', 'retry -> pictureReady');
    assert(r2.payload?.pictureUrl === url, 'retry returns the SAME url (cached, no new AI call)');
    assert(dt < 2000, `cached response was instant (${dt}ms)`);
  }

  console.log('\n— Cleanup —');
  for (const s of sockets) s.disconnect();
  await tick(200);

  console.log(`\n${failures === 0 ? '✓ All asserts passed' : `✗ ${failures} failure(s)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL', err); process.exit(1); });
