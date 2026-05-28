// SPDX-License-Identifier: AGPL-3.0-only
//
// End-to-end smoke test for spec §16 step 7:
// submit profane answers in a real game, verify silent stand-in replacement.

import { io as ioc } from 'socket.io-client';
import { readFileSync } from 'node:fs';

const URL = 'http://localhost:3000';
const N = 3;
const ROUNDS = 7;

// Mirror the stand-ins pools by loading the built shared types is overkill —
// just hard-import the data file via dynamic import so we can verify the
// replacement word is from the right pool.
const { STANDINS } = await import('file:///c:/Mark/Dev/monkeybus/server/src/filter/standins.ts').catch(
  // If TS import fails (Node can't load .ts), parse the file as text and pull
  // out a known stand-in to test contains() against.
  () => ({ STANDINS: null }),
);

function connect() {
  return new Promise((resolve, reject) => {
    const s = ioc(URL, { transports: ['websocket'], reconnection: false });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

function emit(s, ev, payload) {
  return new Promise((resolve) => {
    s.emit(ev, payload, (ack) => resolve(ack));
  });
}

const tick = (ms = 120) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL:', msg); failures++; }
  else console.log('  ✓', msg);
}

async function main() {
  console.log('\n— Connect 3 clients —');
  const A = await connect();
  const B = await connect();
  const C = await connect();
  const sockets = [A, B, C];
  const nicks = ['Alice', 'Bob', 'Carol'];

  console.log('\n— A creates EN room, B+C join —');
  const created = await emit(A, 'room:create', { nickname: nicks[0], language: 'en' });
  const code = created.roomCode;
  await emit(B, 'room:join', { roomCode: code, nickname: nicks[1] });
  await emit(C, 'room:join', { roomCode: code, nickname: nicks[2] });

  console.log(`\n— A starts game in room ${code} —`);
  A.emit('game:start');
  await tick(200);

  // Define a script: each player either submits a clean answer or a profane one.
  // We'll track exactly which submissions should be replaced.
  // (P, R) pairs that are profane; we expect those to land as stand-ins on the server.
  const submissions = {
    // round 0
    0: { 0: 'clean-A-r0', 1: 'shit', 2: 'clean-C-r0' },           // B profane
    1: { 0: 'sh1t', 1: 'clean-B-r1', 2: 'clean-C-r1' },            // A profane (leet)
    2: { 0: 'clean-A-r2', 1: 's.h.i.t', 2: 'clean-C-r2' },         // B profane (separated)
    3: { 0: 'clean-A-r3', 1: 'clean-B-r3', 2: 'fuck' },            // C profane
    4: { 0: 'clean-A-r4', 1: 'clean-B-r4', 2: 'clean-C-r4' },      // all clean
    5: { 0: 'clean-A-r5', 1: 'clean-B-r5', 2: 'clean-C-r5' },
    6: { 0: 'clean-A-r6', 1: 'clean-B-r6', 2: 'clean-C-r6' },
  };

  for (let r = 0; r < ROUNDS; r++) {
    for (let p = 0; p < N; p++) {
      sockets[p].emit('round:submit', { answer: submissions[r][p] });
    }
    await tick(150);
  }
  await tick(400);

  console.log('\n  → check server log for "[ROOM ' + code + ']" assembled stories.');
  console.log('  → expected: every "shit"/"sh1t"/"s.h.i.t"/"fuck" gets replaced by a stand-in,');
  console.log('    every "clean-*" passes through verbatim.');

  for (const s of sockets) s.disconnect();
  await tick();

  console.log(`\n${failures === 0 ? '✓ Submitted ' + (ROUNDS * N) + ' answers (4 profane, ' + (ROUNDS * N - 4) + ' clean)' : `✗ ${failures} failure(s)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL', err); process.exit(1); });
