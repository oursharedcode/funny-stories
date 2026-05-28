// SPDX-License-Identifier: AGPL-3.0-only
//
// Smoke test for spec §16 step 9 — reveal:start payload.
// Plays a full 7-round game and verifies every non-bot player receives a
// private reveal:start with { answers, prose } and that the prose is the
// locked English template (spec §9) filled with that player's answers.

import { io as ioc } from 'socket.io-client';

const URL = 'http://localhost:3000';
const ROUNDS = 7;

// Distinct answer per round; all players submit the same one, so every
// assembled story is identical and the prose is predictable.
const ANSWERS = [
  'Alice',
  'a robot',
  'in a volcano',
  'at midnight',
  'danced badly',
  'to win a sandwich',
  'everyone got a medal',
];
const EXPECTED_PROSE =
  'Alice and a robot were in a volcano at midnight. ' +
  'They danced badly to win a sandwich. In the end, everyone got a medal.';

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

  const reveals = new Map();
  for (const [name, s] of [['Alice', A], ['Bob', B], ['Carol', C]]) {
    s.on('reveal:start', (p) => reveals.set(name, p));
  }

  const created = await emit(A, 'room:create', { nickname: 'Alice', language: 'en' });
  const code = created.roomCode;
  await emit(B, 'room:join', { roomCode: code, nickname: 'Bob' });
  await emit(C, 'room:join', { roomCode: code, nickname: 'Carol' });

  console.log('\n— Play 7 rounds to reach reveal phase —');
  A.emit('game:start');
  await tick(200);
  for (let r = 0; r < ROUNDS; r++) {
    for (const s of sockets) s.emit('round:submit', { answer: ANSWERS[r] });
    await tick(120);
  }
  await tick(500);

  console.log('\n— Verify reveal:start —');
  assert(reveals.size === 3, `all 3 players received reveal:start (got ${reveals.size})`);

  const a = reveals.get('Alice');
  assert(Array.isArray(a?.answers), 'answers is an array');
  assert(a?.answers.length === 7, `answers has 7 entries (got ${a?.answers.length})`);
  assert(
    a?.answers.every((x) => typeof x === 'string'),
    'every answer is a string',
  );
  assert(typeof a?.prose === 'string' && a.prose.length > 0, 'prose is a non-empty string');
  assert(
    a?.prose === EXPECTED_PROSE,
    `prose matches the locked English template\n      expected: ${EXPECTED_PROSE}\n      got:      ${a?.prose}`,
  );
  for (const ans of ANSWERS) {
    assert(a?.prose.includes(ans), `prose contains the answer "${ans}"`);
  }

  console.log('\n— Cleanup —');
  for (const s of sockets) s.disconnect();
  await tick();

  console.log(`\n${failures === 0 ? '✓ All asserts passed' : `✗ ${failures} failure(s)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL', err); process.exit(1); });
