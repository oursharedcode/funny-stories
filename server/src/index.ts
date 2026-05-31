// SPDX-License-Identifier: AGPL-3.0-only

// MUST be first — loads .env into process.env before any other module reads it.
import './env.js';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { Server as SocketIOServer } from 'socket.io';
import type {
  ClientToServerEvents,
  LobbyUpdatePayload,
  Room,
  ServerToClientEvents,
} from './types.js';
import {
  RoomError,
  createRoom,
  deleteRoom,
  findRoomForSocket,
  isValidLanguage,
  joinRoom,
  removePlayer,
  validateNickname,
} from './rooms.js';
import {
  generateBotStoryPictures,
  handleMidGameBotification,
  handlePictureRequest,
  handleReadyToggle,
  prepareRestart,
  shareGallery,
  startGame,
  submitAnswer,
} from './game.js';
import { broadcastStats, buildStats } from './stats.js';
import { generateImage, maybeSyncImageCounter, syncImageCounterFromWorker } from './image.js';
import { buildPrompt } from './prompt.js';
import { LANGUAGES } from 'shared';
import type { Language } from 'shared';

const PORT = Number(process.env.PORT ?? 3000);
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const DEV_CLIENT_ORIGIN = 'http://localhost:5173';
// Built client bundle, relative to server/dist/index.js (spec §14).
const CLIENT_DIST = fileURLToPath(new URL('../../client/dist/', import.meta.url));
// Bounded disconnect grace window (spec §7). A client that returns within
// RECOVERY_WINDOW_MS keeps its slot via Socket.IO connection-state recovery;
// the removal timer is a touch longer so recovery always wins the race.
const RECOVERY_WINDOW_MS = 60_000;
const DISCONNECT_GRACE_MS = RECOVERY_WINDOW_MS + 5_000;

async function main(): Promise<void> {
  const fastify = Fastify({ logger: true });

  await fastify.register(fastifyCors, {
    origin: NODE_ENV === 'production' ? false : DEV_CLIENT_ORIGIN,
    credentials: true,
  });

  fastify.get('/health', async () => ({ ok: true }));

  // Dev-only one-shot image-prompt + image-generation endpoint used by the
  // /?test=image client page. Builds the prompt deterministically; if
  // `generate` is true, also calls the Worker (and consumes one Neuron).
  // Body: { answers: (string|null)[7], language: Language, generate?: boolean }
  fastify.post('/test/image', async (request, reply) => {
    if (NODE_ENV === 'production') return reply.code(404).send({ error: 'not found' });
    const body = request.body as
      | { answers?: unknown; language?: unknown; generate?: unknown }
      | undefined;
    const answers = Array.isArray(body?.answers) ? (body!.answers as unknown[]) : null;
    const language = body?.language as string | undefined;
    if (!answers || answers.length !== 7) return reply.code(400).send({ error: 'answers[7]' });
    if (!language || !LANGUAGES.some((l) => l.code === language)) {
      return reply.code(400).send({ error: 'language' });
    }
    const normalized = answers.map((a) => (typeof a === 'string' ? a : null));
    const imagePrompt = await buildPrompt(
      { answers: normalized, pictureUrl: null },
      language as Language,
    );
    if (body?.generate !== true) return { imagePrompt };
    try {
      const pictureUrl = await generateImage(imagePrompt);
      return { imagePrompt, pictureUrl };
    } catch (err) {
      fastify.log.error(err);
      const parts: string[] = [];
      let cur: unknown = err;
      while (cur instanceof Error) {
        parts.push(`${cur.name}: ${cur.message}`);
        const c = (cur as Error & { cause?: unknown }).cause;
        if (c === cur) break;
        cur = c;
      }
      const workerUrl = process.env.CLOUDFLARE_WORKER_URL ?? '(unset)';
      return reply
        .code(500)
        .send({ imagePrompt, error: parts.join(' <- ') || String(err), workerUrl });
    }
  });

  // Production: this same Fastify process serves the built client bundle —
  // one process, no nginx sidecar (spec §14). Unmatched routes fall back to
  // index.html so the SPA can handle deep links like /?room=ABCDEF. In dev
  // the client runs on Vite's own server, so static serving is skipped.
  if (NODE_ENV === 'production') {
    await fastify.register(fastifyStatic, { root: CLIENT_DIST });
    fastify.setNotFoundHandler((_request, reply) => reply.sendFile('index.html'));
  }

  await fastify.ready();

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(
    fastify.server,
    {
      cors: {
        origin: NODE_ENV === 'production' ? false : DEV_CLIENT_ORIGIN,
        credentials: true,
      },
      // The gallery:ready message carries every player's picture in one
      // payload (spec §24), which exceeds Socket.IO's default 1 MB limit.
      maxHttpBufferSize: 8e6,
      // Bounded disconnect grace window (spec §7): a client that returns
      // within this window keeps its socket.id, rooms, and missed events.
      connectionStateRecovery: {
        maxDisconnectionDuration: RECOVERY_WINDOW_MS,
      },
    },
  );

  function broadcastLobby(room: Room): void {
    const payload: LobbyUpdatePayload = {
      players: room.players,
      hostId: room.hostId,
      donateUrl: process.env.DEPLOYER_DONATE_URL || null,
      wobbleEngine: room.wobbleEngine,
    };
    io.to(room.code).emit('lobby:update', payload);
  }

  // Pending player-removal timers, keyed by socket.id (spec §7 grace window).
  // A dropped socket is removed only when its timer fires; a return within the
  // window cancels it.
  const disconnectTimers = new Map<string, NodeJS.Timeout>();

  // Runs the real removal once the grace window has elapsed with no return.
  function finalizePlayerRemoval(socketId: string): void {
    disconnectTimers.delete(socketId);
    const result = removePlayer(socketId);
    if (!result) return;
    if (result.becameBot && !result.deleted) {
      handleMidGameBotification(result.room, socketId, io);
      // Item 3 of BUGS_AND_IMPROVEMENTS_02.md — if the player botifies during
      // reveal (after enterRevealPhase already ran), their own story has no
      // picture yet because no client fired reveal:requestPicture. Trigger
      // the server-side generator so the gallery doesn't show a gap.
      if (result.room.phase === 'reveal') {
        void generateBotStoryPictures(result.room, io);
      }
      // Notify the host that a player was lost (spec §12). The botified player
      // keeps their slot and nickname; if the lost player was the host, hostId
      // now points at the promoted host, who correctly receives the notice.
      const lost = result.room.players.find((p) => p.id === socketId);
      if (lost) {
        io.to(result.room.hostId).emit('player:lost', { nickname: lost.nickname });
      }
    }
    if (!result.deleted) broadcastLobby(result.room);
    if (result.deleted) broadcastStats(io);
  }

  io.on('connection', (socket) => {
    if (socket.recovered) {
      // Returned within the grace window (spec §7) — cancel the pending
      // removal. The socket keeps its id, its rooms, and any missed events.
      const pending = disconnectTimers.get(socket.id);
      if (pending) {
        clearTimeout(pending);
        disconnectTimers.delete(socket.id);
      }
      fastify.log.info({ socketId: socket.id }, 'socket recovered');
    } else {
      fastify.log.info({ socketId: socket.id }, 'socket connected');
    }

    socket.on('room:create', (payload, ack) => {
      const v = validateNickname(payload?.nickname);
      if (!v.ok) {
        socket.emit('error', { code: 'INVALID_NICKNAME', message: v.message });
        return;
      }
      if (!isValidLanguage(payload?.language)) {
        socket.emit('error', { code: 'INVALID_NICKNAME', message: 'Invalid language.' });
        return;
      }
      try {
        const engine = payload?.wobbleEngine === 'lottie' ? 'lottie' : 'css';
        const room = createRoom(v.nickname, payload.language, socket.id, engine);
        socket.join(room.code);
        ack({ roomCode: room.code, socketId: socket.id });
        broadcastLobby(room);
        broadcastStats(io);
      } catch (err) {
        if (err instanceof RoomError) {
          socket.emit('error', { code: err.code, message: err.message });
        } else {
          fastify.log.error(err);
          socket.emit('error', { code: 'SERVER_BUSY', message: 'Unexpected error.' });
        }
      }
    });

    socket.on('room:join', (payload, ack) => {
      const v = validateNickname(payload?.nickname);
      if (!v.ok) {
        ack({ error: { code: 'INVALID_NICKNAME', message: v.message } });
        return;
      }
      try {
        const room = joinRoom(payload?.roomCode, v.nickname, socket.id);
        socket.join(room.code);
        ack({
          socketId: socket.id,
          players: room.players,
          language: room.language,
          hostId: room.hostId,
        });
        broadcastLobby(room);
      } catch (err) {
        if (err instanceof RoomError) {
          ack({ error: { code: err.code, message: err.message } });
        } else {
          fastify.log.error(err);
          ack({ error: { code: 'SERVER_BUSY', message: 'Unexpected error.' } });
        }
      }
    });

    socket.on('room:leave', () => {
      const result = removePlayer(socket.id);
      if (!result) return;
      socket.leave(result.room.code);
      if (!result.deleted) broadcastLobby(result.room);
      if (result.deleted) broadcastStats(io);
    });

    socket.on('game:start', () => {
      const room = findRoomForSocket(socket.id);
      if (!room) {
        socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'No room.' });
        return;
      }
      if (room.hostId !== socket.id) {
        socket.emit('error', { code: 'NOT_HOST', message: 'Only the host can start.' });
        return;
      }
      if (room.phase !== 'lobby') {
        socket.emit('error', { code: 'ROOM_LOCKED', message: 'Game already started.' });
        return;
      }
      if (room.players.length < 3) {
        socket.emit('error', {
          code: 'NOT_ENOUGH_PLAYERS',
          message: 'Need at least 3 players.',
        });
        return;
      }
      startGame(room, io);
    });

    socket.on('round:submit', (payload) => {
      const room = findRoomForSocket(socket.id);
      if (!room) return;
      submitAnswer(room, socket.id, payload?.answer ?? '', io);
    });

    // reveal:requestPicture and reveal:retryPicture share one handler (spec §11).
    const onPictureRequest = (): void => {
      const room = findRoomForSocket(socket.id);
      if (!room) return;
      void handlePictureRequest(room, socket.id, io);
    };
    socket.on('reveal:requestPicture', onPictureRequest);
    socket.on('reveal:retryPicture', onPictureRequest);

    socket.on('game:ready', (payload) => {
      const room = findRoomForSocket(socket.id);
      if (!room) return;
      handleReadyToggle(room, socket.id, payload?.ready === true, io);
    });

    socket.on('game:restart', () => {
      const room = findRoomForSocket(socket.id);
      if (!room) {
        socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'No room.' });
        return;
      }
      const result = prepareRestart(room, socket.id);
      if (!result.ok) {
        socket.emit('error', result.error);
        return;
      }
      broadcastLobby(room);
      startGame(room, io);
    });

    socket.on('game:end', () => {
      const room = findRoomForSocket(socket.id);
      if (!room) return;
      if (room.hostId !== socket.id) {
        socket.emit('error', { code: 'NOT_HOST', message: 'Only the host can end the game.' });
        return;
      }
      room.phase = 'ended';
      io.to(room.code).emit('game:over');
      deleteRoom(room.code);
      broadcastStats(io);
    });

    socket.on('gallery:share', () => {
      const room = findRoomForSocket(socket.id);
      if (!room) return;
      shareGallery(room, socket.id, io);
    });

    socket.on('stats:get', async (ack) => {
      // Refresh the Worker-side counter if our cached value is stale
      // (~30 s TTL). Survives Render free-tier spin-down so the host's
      // Home-screen "Images today" reflects today's real usage rather
      // than this process's lifetime counter. Vol02 follow-up to
      // BUGS_AND_IMPROVEMENTS_01.md item 22.
      await maybeSyncImageCounter();
      ack(buildStats());
    });

    socket.on('disconnect', (reason) => {
      fastify.log.info({ socketId: socket.id, reason }, 'socket disconnected');
      // Defer removal: a client that returns within the grace window keeps its
      // slot via connection-state recovery (spec §7). Only a window that
      // elapses with no return botifies/removes the player. An explicit
      // room:leave is intentional and is handled immediately, not here.
      const existing = disconnectTimers.get(socket.id);
      if (existing) clearTimeout(existing);
      disconnectTimers.set(
        socket.id,
        setTimeout(() => finalizePlayerRemoval(socket.id), DISCONNECT_GRACE_MS),
      );
    });
  });

  await fastify.listen({ port: PORT, host: '0.0.0.0' });

  // Eager initial sync of the Worker-side daily counter. Fire-and-forget:
  // a Worker that's unreachable at startup must not block the server from
  // accepting connections. The first `stats:get` will retry via the TTL
  // path. Vol02 follow-up to BUGS_AND_IMPROVEMENTS_01.md item 22.
  void syncImageCounterFromWorker();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
