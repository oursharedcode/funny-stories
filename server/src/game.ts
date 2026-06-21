// SPDX-License-Identifier: AGPL-3.0-only

import type { Server as SocketIOServer } from 'socket.io';
import type {
  ClientToServerEvents,
  ErrorPayload,
  GalleryReadyPayload,
  Room,
  ServerToClientEvents,
  Story,
} from './types.js';
import { QUESTIONS, renderProse } from './i18n/index.js';
import { filterAnswer } from './filter/index.js';
import { containsCsamCombination } from './filter/csam.js';
import { containsHardBlock } from './filter/hardBlocks.js';
import { pickStandin } from './filter/standins.js';
import { buildPrompt } from './prompt.js';
import { generateImage, reserveImageSlot } from './image.js';
import { broadcastStats } from './stats.js';

export const ROUNDS = 7;
export const ANSWER_MAX_LENGTH = 70;
export const ROUND_DURATION_MS = Number(process.env.ROUND_DURATION_MS ?? 60_000);

type IO = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

// ============================================================================
// Rotation formula (spec §4) — covered by game.test.ts.
// storyIndex(P, R, N) = (P - R + N) mod N
// ============================================================================

export function storyIndex(playerIndex: number, round: number, playerCount: number): number {
  if (!Number.isInteger(playerCount) || playerCount <= 0) {
    throw new RangeError('playerCount must be a positive integer');
  }
  if (!Number.isInteger(playerIndex) || playerIndex < 0) {
    throw new RangeError('playerIndex must be a non-negative integer');
  }
  if (!Number.isInteger(round) || round < 0) {
    throw new RangeError('round must be a non-negative integer');
  }
  return (((playerIndex - round) % playerCount) + playerCount) % playerCount;
}

// ============================================================================
// Game lifecycle
// ============================================================================

export function startGame(room: Room, io: IO): void {
  room.phase = 'playing';
  room.currentRound = 0;
  room.galleryShared = false; // reset for a restarted game
  room.stories = room.players.map<Story>(() => ({
    answers: new Array<string | null>(ROUNDS).fill(null),
    pictureUrl: null,
  }));
  startRound(room, io);
}

function startRound(room: Room, io: IO): void {
  room.submittedThisRound = new Set();

  // Bots get auto-filled at the top of every round (spec §17).
  for (const p of room.players) {
    if (p.isBot) autoFillFor(room, p.id);
  }

  room.roundDeadline = Date.now() + ROUND_DURATION_MS;

  io.to(room.code).emit('round:start', {
    roundNumber: room.currentRound,
    question: QUESTIONS[room.language][room.currentRound] ?? '???',
    deadline: room.roundDeadline,
  });

  clearRoundTimer(room);
  room.roundTimer = setTimeout(() => {
    advanceRound(room, io);
  }, ROUND_DURATION_MS);

  // If all human players happen to have already submitted (only possible
  // when every slot is a bot — guarded against in caller), advance now.
  maybeAdvance(room, io);
}

export function submitAnswer(room: Room, socketId: string, answer: string, io: IO): void {
  if (room.phase !== 'playing') return;
  if (room.submittedThisRound.has(socketId)) return;

  const playerIdx = room.players.findIndex((p) => p.id === socketId);
  if (playerIdx === -1) return;
  const player = room.players[playerIdx]!;
  if (player.isBot) return; // already auto-filled at round start

  const truncated = String(answer ?? '').slice(0, ANSWER_MAX_LENGTH);
  // Profanity filter (spec §6) — silent stand-in replacement on any hit.
  const cleaned = filterAnswer(truncated, room.language, room.currentRound);
  const storyIdx = storyIndex(playerIdx, room.currentRound, room.players.length);
  room.stories[storyIdx]!.answers[room.currentRound] = cleaned;
  room.submittedThisRound.add(socketId);

  broadcastWaiting(room, io);
  maybeAdvance(room, io);
}

function autoFillFor(room: Room, socketId: string): void {
  if (room.submittedThisRound.has(socketId)) return;
  const playerIdx = room.players.findIndex((p) => p.id === socketId);
  if (playerIdx === -1) return;
  const storyIdx = storyIndex(playerIdx, room.currentRound, room.players.length);
  room.stories[storyIdx]!.answers[room.currentRound] = pickStandin(
    room.language,
    room.currentRound,
  );
  room.submittedThisRound.add(socketId);
}

function broadcastWaiting(room: Room, io: IO): void {
  const total = room.players.length;
  const submitted = room.submittedThisRound.size;
  for (const p of room.players) {
    if (p.isBot) continue;
    if (!room.submittedThisRound.has(p.id)) continue;
    io.to(p.id).emit('round:waiting', { submitted, total });
  }
}

function maybeAdvance(room: Room, io: IO): void {
  if (room.submittedThisRound.size >= room.players.length) {
    advanceRound(room, io);
  }
}

function advanceRound(room: Room, io: IO): void {
  clearRoundTimer(room);

  // Timer-expiry path: auto-fill anyone still missing.
  for (const p of room.players) autoFillFor(room, p.id);

  room.currentRound++;
  if (room.currentRound >= ROUNDS) {
    enterRevealPhase(room, io);
    return;
  }
  startRound(room, io);
}

// stories[i] belongs to players[i] (spec §4): each non-bot player receives
// their own assembled story as private prose. Bots have no client to send to.
function enterRevealPhase(room: Room, io: IO): void {
  room.phase = 'reveal';
  room.players.forEach((player, i) => {
    if (player.isBot) return;
    const answers = (room.stories[i]?.answers ?? []).map((a) => a ?? '');
    io.to(player.id).emit('reveal:start', {
      answers,
      prose: renderProse(room.language, answers),
    });
  });
  // Bot-owned stories have no client to fire reveal:requestPicture, so
  // their pictureUrl would stay null forever and leave a visible gap in
  // the room gallery (item 3 of BUGS_AND_IMPROVEMENTS_02.md). Generate
  // them server-side. Fire-and-forget: failures fall back to the same
  // null-picture state as before.
  void generateBotStoryPictures(room, io);
}

function clearRoundTimer(room: Room): void {
  if (room.roundTimer) {
    clearTimeout(room.roundTimer as NodeJS.Timeout);
    room.roundTimer = null;
  }
}

// ============================================================================
// Mid-game disconnect — called from the socket disconnect handler when a
// player who was in a 'playing' room becomes a bot.
// ============================================================================

export function handleMidGameBotification(room: Room, socketId: string, io: IO): void {
  if (room.phase !== 'playing') return;
  autoFillFor(room, socketId);
  maybeAdvance(room, io);
}

// ============================================================================
// Reveal — picture generation (spec §11)
// ============================================================================

// stories[i] belongs to players[i] (spec §4). A player's own story is at
// their index in the players array.
export function getStoryForPlayer(room: Room, socketId: string): Story | null {
  const idx = room.players.findIndex((p) => p.id === socketId);
  if (idx === -1) return null;
  return room.stories[idx] ?? null;
}

// Outcome of a single picture-generation attempt. Lets the caller decide
// whether to notify a specific socket (human path) or stay silent (bot path).
type PictureOutcome =
  | { kind: 'cached'; pictureUrl: string; imagePrompt: string }
  | { kind: 'ready'; pictureUrl: string; imagePrompt: string }
  | { kind: 'blocked' }
  | { kind: 'capped' }
  | { kind: 'failed' };

// Core picture-generation pipeline shared by the human request path and
// the server-side bot-owned-story path (item 3 of BUGS_AND_IMPROVEMENTS_02.md).
// Checks the write-once cache, runs prompt-safety guards, reserves a daily-cap
// slot, calls the Worker, and writes the result back into story.pictureUrl.
// The two safety guards run before the cap reservation so a blocked prompt
// costs no Neuron slot. The cap reservation is atomic; concurrent calls from
// multiple stories or rooms cannot overshoot the cap.
async function generateStoryPicture(
  room: Room,
  story: Story,
  io: IO,
): Promise<PictureOutcome> {
  const { prompt, translationFailed } = await buildPrompt(story, room.language);
  if (story.pictureUrl) {
    return { kind: 'cached', pictureUrl: story.pictureUrl, imagePrompt: prompt };
  }
  // Fail closed when translation to English failed: a non-English answer that
  // reaches the English CSAM guard untranslated would slip past it, so we
  // refuse rather than send an unscreened prompt to the model. The retry in
  // translateToEnglish absorbs transient blips first. See docs/MODERATION.md.
  if (translationFailed || containsCsamCombination(prompt) || containsHardBlock(prompt)) {
    return { kind: 'blocked' };
  }
  if (!reserveImageSlot()) return { kind: 'capped' };
  // Live stats update (spec §26) — pushed after every successful reservation
  // so the host's Home-screen counter ticks visibly rather than only updating
  // on remount (item 22 of BUGS_AND_IMPROVEMENTS_01.md).
  broadcastStats(io);

  try {
    const pictureUrl = await generateImage(prompt);
    story.pictureUrl = pictureUrl; // write-once cache
    return { kind: 'ready', pictureUrl, imagePrompt: prompt };
  } catch {
    return { kind: 'failed' };
  }
}

// Handles reveal:requestPicture / reveal:retryPicture (identical handler,
// spec §11). Thin wrapper around generateStoryPicture that emits the
// appropriate socket event based on outcome.
export async function handlePictureRequest(
  room: Room,
  socketId: string,
  io: IO,
): Promise<void> {
  if (room.phase !== 'reveal') return;

  const story = getStoryForPlayer(room, socketId);
  if (!story) return;

  const outcome = await generateStoryPicture(room, story, io);
  switch (outcome.kind) {
    case 'cached':
    case 'ready':
      io.to(socketId).emit('reveal:pictureReady', {
        pictureUrl: outcome.pictureUrl,
        imagePrompt: outcome.imagePrompt,
      });
      // If the host already shared the gallery, a late picture refreshes it (§24).
      if (outcome.kind === 'ready' && room.galleryShared && room.phase === 'reveal') {
        io.to(room.code).emit('gallery:ready', buildGallery(room));
      }
      return;
    case 'capped':
      // The `code` discriminator lets the client switch to its i18n'd
      // "oven is full, new cartoons in ~N hours" caption and derive the
      // hours-until-reset from UTC midnight locally (item 4 of
      // BUGS_AND_IMPROVEMENTS_02.md). The English `message` is kept as a
      // wire fallback for any older client that doesn't know `code`.
      io.to(socketId).emit('reveal:pictureError', {
        message: 'The cartoon oven is full for today. Try again tomorrow!',
        code: 'CAP_REACHED',
      });
      return;
    case 'blocked':
    case 'failed':
      // Generic message for both — spec §6 keeps CSAM/hard-block rejections
      // indistinguishable from real failures so the heuristics aren't probable.
      io.to(socketId).emit('reveal:pictureError', {
        message: 'Generation failed. Try again.',
        code: 'GENERIC',
      });
      return;
  }
}

// Item 3 of BUGS_AND_IMPROVEMENTS_02.md — bot-owned stories never receive
// reveal:requestPicture from any client, so the server fires their generation
// here. Sequential rather than parallel: humans race against bots on the
// shared daily cap, and serialising bot work keeps a multi-bot room from
// burning the last few slots in a single tick.
//
// Called from enterRevealPhase for players who were already bots at reveal
// time, and from index.ts when a player botifies *during* reveal (after the
// grace window expires past §7) so their story still gets a picture.
//
// Idempotent: stories with a pictureUrl already set are skipped via the
// write-once cache in generateStoryPicture, so calling this twice for the
// same room is harmless.
export async function generateBotStoryPictures(room: Room, io: IO): Promise<void> {
  for (const [i, player] of room.players.entries()) {
    if (!player.isBot) continue;
    if (room.phase !== 'reveal') return;
    const story = room.stories[i];
    if (!story || story.pictureUrl) continue;

    const outcome = await generateStoryPicture(room, story, io);
    // Cap exhausted — stop trying so we don't keep paying the no-op check
    // and so any human still waiting on a slot doesn't get pre-empted by
    // a stream of bot attempts.
    if (outcome.kind === 'capped') return;
    // Picture landed and the gallery is already shared — refresh it so the
    // bot's panel fills in without waiting for the next human picture (§24).
    if (outcome.kind === 'ready' && room.galleryShared && room.phase === 'reveal') {
      io.to(room.code).emit('gallery:ready', buildGallery(room));
    }
  }
}

// ============================================================================
// Room gallery (spec §24)
// ============================================================================

// Builds the whole-room gallery: one entry per player slot in players[] order,
// pairing each story (stories[i] ↔ players[i], spec §4) with its owner and any
// generated picture. Bot slots and ungenerated stories carry pictureUrl: null.
export function buildGallery(room: Room): GalleryReadyPayload {
  return {
    entries: room.players.map((player, i) => {
      const answers = (room.stories[i]?.answers ?? []).map((a) => a ?? '');
      return {
        nickname: player.nickname,
        isBot: player.isBot,
        answers,
        prose: renderProse(room.language, answers),
        pictureUrl: room.stories[i]?.pictureUrl ?? null,
      };
    }),
  };
}

// Handles gallery:share — host only. Marks the gallery shared and broadcasts it
// to every player. Late pictures keep it fresh via handlePictureRequest.
export function shareGallery(room: Room, socketId: string, io: IO): void {
  if (room.phase !== 'reveal') return;
  if (room.hostId !== socketId) {
    io.to(socketId).emit('error', {
      code: 'NOT_HOST',
      message: 'Only the host can share the gallery.',
    });
    return;
  }
  room.galleryShared = true;
  io.to(room.code).emit('gallery:ready', buildGallery(room));
}

// ============================================================================
// End screen — "one more game" readiness and restart (spec §4, §5, §16 step 10)
// ============================================================================

// Toggles a non-bot player's "ready for another game" flag and broadcasts the
// full ready set so every client (and the host's restart button) stays in sync.
export function handleReadyToggle(
  room: Room,
  socketId: string,
  ready: boolean,
  io: IO,
): void {
  if (room.phase !== 'reveal') return;
  const player = room.players.find((p) => p.id === socketId);
  if (!player || player.isBot) return;

  if (ready) room.readyForRestart.add(socketId);
  else room.readyForRestart.delete(socketId);

  io.to(room.code).emit('game:restartReady', {
    readyIds: [...room.readyForRestart],
  });
}

// Validates a host's restart request and, on success, resets the room to a
// fresh pre-game state per spec §4 "One more game" reset: drops bots, rebuilds
// the host if needed, clears the ready set. The caller then broadcasts the new
// roster and calls startGame to rebuild stories and begin round 0.
export function prepareRestart(
  room: Room,
  socketId: string,
): { ok: true } | { ok: false; error: ErrorPayload } {
  if (room.phase !== 'reveal') {
    return { ok: false, error: { code: 'ROOM_LOCKED', message: 'Game is not over yet.' } };
  }
  if (room.hostId !== socketId) {
    return { ok: false, error: { code: 'NOT_HOST', message: 'Only the host can restart.' } };
  }
  const nonBots = room.players.filter((p) => !p.isBot);
  if (nonBots.length < 3) {
    return {
      ok: false,
      error: { code: 'NOT_ENOUGH_PLAYERS', message: 'Need at least 3 players.' },
    };
  }

  room.players = nonBots;
  if (!room.players.some((p) => p.id === room.hostId)) {
    room.hostId = room.players[0]!.id;
  }
  room.readyForRestart.clear();
  return { ok: true };
}
