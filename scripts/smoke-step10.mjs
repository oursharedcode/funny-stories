// SPDX-License-Identifier: AGPL-3.0-only
//
// Smoke test for spec §16 step 10 — end screen, ready toggle, restart, end.
// Plays a 4-player game to reveal, drops one player to a bot, verifies the
// ready/restart/end flow:
//   - game:ready toggles broadcast game:restartReady with the full ready set
//   - a non-host game:restart is rejected with NOT_HOST
//   - a host game:restart drops bots, rebuilds stories, starts round 0
//   - game:end broadcasts game:over to every remaining client

import { io as ioc } from 'socket.io-client';

const URL = 'http://localhost:3000';
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
const tick = (ms = 200) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ FAIL:', msg); failures++; }
  else console.log('  ✓', msg);
}

async function playRounds(sockets) {
  for (let r = 0; r < ROUNDS; r++) {
    for (const s of sockets) s.emit('round:submit', { answer: `round-${r}` });
    await tick(120);
  }
  await tick(500);
}

async function main() {
  console.log('\n— Connect 4 clients, create + join —');
  const A = await connect();
  const B = await connect();
  const C = await connect();
  const D = await connect();

  const state = new Map();
  for (const [name, s] of [['A', A], ['B', B], ['C', C], ['D', D]]) {
    const st = { reveals: 0, lastRound: null, gameOver: false, errors: [], lastReady: null, lastLobby: null };
    state.set(name, st);
    s.on('reveal:start', () => { st.reveals++; });
    s.on('round:start', (p) => { st.lastRound = p; });
    s.on('game:over', () => { st.gameOver = true; });
    s.on('error', (e) => { st.errors.push(e); });
    s.on('game:restartReady', (p) => { st.lastReady = p.readyIds; });
    s.on('lobby:update', (p) => { st.lastLobby = p; });
  }

  const created = await emit(A, 'room:create', { nickname: 'Alice', language: 'en' });
  const code = created.roomCode;
  await emit(B, 'room:join', { roomCode: code, nickname: 'Bob' });
  await emit(C, 'room:join', { roomCode: code, nickname: 'Carol' });
  await emit(D, 'room:join', { roomCode: code, nickname: 'Dave' });

  console.log('\n— Game 1: play 7 rounds to reveal —');
  A.emit('game:start');
  await tick(300);
  await playRounds([A, B, C, D]);
  assert(
    [...state.values()].every((s) => s.reveals === 1),
    'all 4 players received reveal:start',
  );

  console.log('\n— Dave disconnects mid-reveal (becomes a bot) —');
  D.disconnect();
  await tick(300);

  console.log('\n— Bob and Carol toggle ready —');
  B.emit('game:ready', { ready: true });
  await tick(200);
  C.emit('game:ready', { ready: true });
  await tick(200);
  const ready = state.get('A').lastReady ?? [];
  assert(
    ready.length === 2 && ready.includes(B.id) && ready.includes(C.id),
    `game:restartReady lists exactly Bob + Carol (got ${JSON.stringify(ready)})`,
  );

  console.log('\n— Toggle Bob off, then back on —');
  B.emit('game:ready', { ready: false });
  await tick(200);
  assert(
    (state.get('A').lastReady ?? []).length === 1,
    'toggling off removes Bob from the ready set',
  );
  B.emit('game:ready', { ready: true });
  await tick(200);

  console.log('\n— Non-host restart attempt is rejected —');
  B.emit('game:restart');
  await tick(300);
  assert(
    state.get('B').errors.some((e) => e.code === 'NOT_HOST'),
    'non-host game:restart -> NOT_HOST error',
  );

  console.log('\n— Host restarts the game —');
  for (const st of state.values()) { st.reveals = 0; st.lastRound = null; }
  A.emit('game:restart');
  await tick(600);
  for (const name of ['A', 'B', 'C']) {
    assert(
      state.get(name).lastRound?.roundNumber === 0,
      `${name} received round:start round 0 after restart`,
    );
  }
  const lobby = state.get('A').lastLobby;
  assert(lobby?.players.length === 3, `bot dropped: roster is 3 players (got ${lobby?.players.length})`);
  assert(lobby?.players.every((p) => !p.isBot), 'restarted roster has no bots');

  console.log('\n— Game 2: play 7 rounds to reveal —');
  await playRounds([A, B, C]);
  assert(
    ['A', 'B', 'C'].every((n) => state.get(n).reveals === 1),
    'restarted game reaches reveal with 3 players',
  );

  console.log('\n— Host ends the game —');
  A.emit('game:end');
  await tick(400);
  for (const name of ['A', 'B', 'C']) {
    assert(state.get(name).gameOver, `${name} received game:over`);
  }

  console.log('\n— Cleanup —');
  for (const s of [A, B, C]) s.disconnect();
  await tick();

  console.log(`\n${failures === 0 ? '✓ All asserts passed' : `✗ ${failures} failure(s)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error('FATAL', err); process.exit(1); });
