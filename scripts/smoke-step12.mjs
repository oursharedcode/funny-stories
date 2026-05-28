// SPDX-License-Identifier: AGPL-3.0-only
//
// Smoke test for spec §16 step 12 — Russian localization (server side).
// Creates a room with language 'ru', plays 7 rounds, and verifies that the
// round questions and the assembled reveal prose come back in Russian,
// rendered from the locked Russian prose template (spec §9).

import { io as ioc } from 'socket.io-client';

const URL = 'http://localhost:3000';
const ROUNDS = 7;

const EXPECTED_QUESTIONS = [
  'Кто?',
  'С кем?',
  'Где?',
  'Когда?',
  'Что они сделали?',
  'Зачем?',
  'Чем всё закончилось?',
];

// One distinct Russian answer per round; all players submit the same one,
// so every assembled story is identical and the prose is predictable.
const ANSWERS = ['кот', 'с роботом', 'в лесу', 'ночью', 'танцевали', 'ради смеха', 'все устали'];
// RU template (spec §9): "{0} {1} {3} {2} {4} {5}. В итоге {6}."
const EXPECTED_PROSE =
  'кот с роботом ночью в лесу танцевали ради смеха. В итоге все устали.';

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
  console.log('\n— Connect 3 clients, create RU room + join —');
  const A = await connect();
  const B = await connect();
  const C = await connect();
  const sockets = [A, B, C];

  const questions = [];
  A.on('round:start', (p) => { questions[p.roundNumber] = p.question; });
  let reveal = null;
  A.on('reveal:start', (p) => { reveal = p; });

  const created = await emit(A, 'room:create', { nickname: 'Аня', language: 'ru' });
  const code = created.roomCode;
  await emit(B, 'room:join', { roomCode: code, nickname: 'Боря' });
  await emit(C, 'room:join', { roomCode: code, nickname: 'Вера' });

  console.log('\n— Play 7 rounds in Russian —');
  A.emit('game:start');
  await tick(300);
  for (let r = 0; r < ROUNDS; r++) {
    for (const s of sockets) s.emit('round:submit', { answer: ANSWERS[r] });
    await tick(150);
  }
  await tick(600);

  console.log('\n— Verify Russian questions —');
  for (let r = 0; r < ROUNDS; r++) {
    assert(
      questions[r] === EXPECTED_QUESTIONS[r],
      `round ${r} question is Russian: "${questions[r]}"`,
    );
  }

  console.log('\n— Verify Russian reveal prose —');
  assert(reveal !== null, 'received reveal:start');
  assert(
    reveal?.prose === EXPECTED_PROSE,
    `prose matches the locked Russian template\n      expected: ${EXPECTED_PROSE}\n      got:      ${reveal?.prose}`,
  );
  assert(
    (reveal?.prose ?? '').includes('В итоге'),
    'prose uses the Russian connective "В итоге" (not English "In the end")',
  );
  assert(
    !/[A-Za-z]/.test(reveal?.prose ?? 'x'),
    'prose contains no Latin letters — fully Russian',
  );

  console.log('\n— Cleanup —');
  for (const s of sockets) s.disconnect();
  await tick();

  console.log(`\n${failures === 0 ? '✓ All asserts passed' : `✗ ${failures} failure(s)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL', err); process.exit(1); });
