// SPDX-License-Identifier: AGPL-3.0-only
//
// End-to-end smoke test for spec §16 step 4:
// room:create, room:join, room:leave, lobby:update, host promotion on disconnect.
//
// Uses "track latest lobby state per client" pattern to avoid racing against
// socket.io event ordering between ack and broadcasts.

import { io as ioc } from 'socket.io-client';

const URL = 'http://localhost:3000';

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

const tick = (ms = 80) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('  ✗ FAIL:', msg);
    failures++;
  } else {
    console.log('  ✓', msg);
  }
}

async function main() {
  console.log('\n— Connecting 3 clients —');
  const A = await connect();
  const B = await connect();
  const C = await connect();
  const latest = { A: null, B: null, C: null };
  A.on('lobby:update', (p) => (latest.A = p));
  B.on('lobby:update', (p) => (latest.B = p));
  C.on('lobby:update', (p) => (latest.C = p));

  console.log('\n— A creates a room —');
  const created = await emit(A, 'room:create', { nickname: 'Alice', language: 'en' });
  await tick();
  assert(typeof created.roomCode === 'string' && created.roomCode.length === 6, 'room code is 6 chars');
  assert(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/.test(created.roomCode), 'code uses unambiguous alphabet');
  assert(latest.A?.players.length === 1, 'A sees own lobby (1 player)');
  assert(latest.A?.hostId === created.socketId, 'A is the host');
  assert(latest.A?.donateUrl === null, 'donateUrl null when DEPLOYER_DONATE_URL unset');
  const code = created.roomCode;

  console.log('\n— B joins —');
  const bJoin = await emit(B, 'room:join', { roomCode: code, nickname: 'Bob' });
  await tick();
  assert(!bJoin.error, 'B join succeeded');
  assert(bJoin.players?.length === 2, 'B join ack: 2 players');
  assert(bJoin.hostId === created.socketId, 'B join ack: host is Alice');
  assert(bJoin.language === 'en', 'B join ack: language en');
  assert(latest.A?.players.length === 2, 'A sees 2 players after B joins');
  assert(latest.B?.players.length === 2, 'B sees 2 players');

  console.log('\n— C joins —');
  const cJoin = await emit(C, 'room:join', { roomCode: code, nickname: 'Carol' });
  await tick();
  assert(!cJoin.error, 'C join succeeded');
  assert(latest.A?.players.length === 3, 'A sees 3');
  assert(latest.B?.players.length === 3, 'B sees 3');
  assert(latest.C?.players.length === 3, 'C sees 3');

  console.log('\n— lowercase room code accepted —');
  const D = await connect();
  const dAck = await emit(D, 'room:join', { roomCode: code.toLowerCase(), nickname: 'Dave' });
  await tick();
  assert(!dAck.error, 'lowercase code accepted');
  D.disconnect();
  await tick();
  assert(latest.A?.players.length === 3, 'D removed from lobby after disconnect');

  console.log('\n— bogus code rejected —');
  const E = await connect();
  const eAck = await emit(E, 'room:join', { roomCode: 'ZZZZZZ', nickname: 'Eve' });
  assert(eAck.error?.code === 'ROOM_NOT_FOUND', 'unknown code -> ROOM_NOT_FOUND');
  E.disconnect();

  console.log('\n— bad nickname rejected —');
  const F = await connect();
  const fAck = await emit(F, 'room:join', { roomCode: code, nickname: 'ab' });
  assert(fAck.error?.code === 'INVALID_NICKNAME', 'nickname < 3 chars -> INVALID_NICKNAME');
  F.disconnect();

  console.log('\n— B leaves explicitly —');
  B.emit('room:leave');
  await tick();
  assert(latest.A?.players.length === 2, 'A sees 2 after B leaves');
  assert(latest.C?.players.length === 2, 'C sees 2 after B leaves');
  assert(latest.A?.players.every((p) => p.nickname !== 'Bob'), 'B removed from lobby roster');

  console.log('\n— host A disconnects -> C should be promoted —');
  A.disconnect();
  await tick();
  assert(latest.C?.players.length === 1, 'only Carol remains');
  assert(latest.C?.hostId !== created.socketId, 'hostId no longer points to A');
  assert(latest.C?.hostId === C.id, 'hostId points to C');

  console.log('\n— Cleanup —');
  B.disconnect();
  C.disconnect();
  await tick();

  console.log(`\n${failures === 0 ? '✓ All asserts passed' : `✗ ${failures} failure(s)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
