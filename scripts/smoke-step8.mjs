// SPDX-License-Identifier: AGPL-3.0-only
//
// Smoke test for spec §16 step 8 — image-generation error path + daily cap.
// Run the server with MAX_IMAGES_PER_DAY=1 and NO Cloudflare config, so:
//   request 1 -> reserveImageSlot() ok -> generateImage throws "not
//                configured" -> reveal:pictureError "Generation failed"
//   request 2 -> reserveImageSlot() returns false (cap 1 reached) ->
//                reveal:pictureError daily-cap message, Worker never called.

import { io as ioc } from 'socket.io-client';

const URL = 'http://localhost:3000';
const N = 3;
const ROUNDS = 7;

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
const tick = (ms = 150) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL:', msg); failures++; }
  else console.log('  ✓', msg);
}

async function main() {
  console.log('\n— Connect 3 clients, create + join —');
  const A = await connect();
  const B = await connect();
  const C = await connect();
  const sockets = [A, B, C];

  const aEvents = [];
  A.on('reveal:pictureError', (p) => aEvents.push({ type: 'error', message: p.message }));
  A.on('reveal:pictureReady', (p) => aEvents.push({ type: 'ready', url: p.pictureUrl }));

  const created = await emit(A, 'room:create', { nickname: 'Alice', language: 'en' });
  const code = created.roomCode;
  await emit(B, 'room:join', { roomCode: code, nickname: 'Bob' });
  await emit(C, 'room:join', { roomCode: code, nickname: 'Carol' });

  console.log('\n— Play 7 rounds to reach reveal phase —');
  A.emit('game:start');
  await tick(200);
  for (let r = 0; r < ROUNDS; r++) {
    for (const s of sockets) s.emit('round:submit', { answer: `answer-r${r}` });
    await tick(120);
  }
  await tick(400);

  console.log('\n— Request 1: Worker not configured -> generation error —');
  A.emit('reveal:requestPicture');
  await tick(800);
  assert(aEvents.length === 1, 'exactly one event after request 1');
  assert(aEvents[0]?.type === 'error', 'request 1 -> reveal:pictureError');
  assert(
    /generation failed/i.test(aEvents[0]?.message ?? ''),
    `request 1 message is "Generation failed" (got: "${aEvents[0]?.message}")`,
  );

  console.log('\n— Request 2: daily cap (MAX_IMAGES_PER_DAY=1) already used —');
  A.emit('reveal:retryPicture');
  await tick(800);
  assert(aEvents.length === 2, 'exactly one more event after request 2');
  assert(aEvents[1]?.type === 'error', 'request 2 -> reveal:pictureError');
  assert(
    /oven is full|limit/i.test(aEvents[1]?.message ?? ''),
    `request 2 message is the daily-cap message (got: "${aEvents[1]?.message}")`,
  );

  console.log('\n— Cleanup —');
  for (const s of sockets) s.disconnect();
  await tick();

  console.log(`\n${failures === 0 ? '✓ All asserts passed' : `✗ ${failures} failure(s)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL', err); process.exit(1); });
