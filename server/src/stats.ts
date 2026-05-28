// SPDX-License-Identifier: AGPL-3.0-only

import type { Server as SocketIOServer } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  StatsPayload,
} from './types.js';
import { roomCount } from './rooms.js';
import { imagesGeneratedToday, maxImagesPerDay } from './image.js';

type IO = SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

// Builds the StatsPayload from the live process-global counters
// (spec §26). Same shape used by the one-shot `stats:get` ack and the
// live `stats:update` broadcast.
export function buildStats(): StatsPayload {
  return {
    openRooms: roomCount(),
    imagesGeneratedToday: imagesGeneratedToday(),
    imagesLimit: maxImagesPerDay(),
  };
}

// Broadcasts the current stats to every connected socket. Called
// whenever an action changes either counter (room created / destroyed,
// image slot reserved). Item 22 of BUGS_AND_IMPROVEMENTS_01.md: pairs
// with the one-shot stats:get fetch so the host's Home-screen counter
// reflects the live process state, not just the snapshot at mount
// time. Non-Home-screen clients receive the event but ignore it.
//
// Note: this does NOT survive a Render free-tier spin-down. The
// in-memory counter resets to 0 on each container start; a full fix
// requires persistence (Cloudflare KV via the Worker — option B in
// the item 22 analysis), which is left as a follow-up.
export function broadcastStats(io: IO): void {
  io.emit('stats:update', buildStats());
}
