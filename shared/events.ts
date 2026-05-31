// SPDX-License-Identifier: AGPL-3.0-only

// ============================================================================
// Core data model (spec §4)
// ============================================================================

export type RoomPhase = 'lobby' | 'playing' | 'reveal' | 'ended';

// Language identity (the union) and the human-facing registry both live in
// shared/languages.ts so adding a language is a one-file edit. Re-exported
// here for consumers that already import everything from 'shared'.
export { LANGUAGES, isLanguage } from './languages.js';
export type { Language, LanguageOption } from './languages.js';
import type { Language } from './languages.js';

export interface Player {
  // socket.id — rotates on each connection; no stable identity across reconnects.
  id: string;
  nickname: string;
  // True when this slot's real player disconnected mid-game.
  isBot: boolean;
}

export interface Story {
  // Length 7; index = question number (0–6); null = not answered yet.
  answers: (string | null)[];
  // Base64 data URL; set once, never overwritten.
  pictureUrl: string | null;
}

// Opaque server-side timer handle. Treat as unknown on the client;
// cast to NodeJS.Timeout on the server where @types/node is available.
export type ServerTimerHandle = unknown;

// Animation engine for the Share-as-video recorder. Chosen by the host at
// room creation and broadcast to all joiners so every player's recording
// uses the same engine the host picked. Per-device localStorage is still
// the default for the host's own toggle.
export type WobbleEngine = 'css' | 'lottie';

export interface Room {
  // 6-char nanoid from the unambiguous alphabet, uppercase. See spec §17.
  code: string;
  // socket.id of current host.
  hostId: string;
  language: Language;
  // Host's recording-engine choice, applied to every player's WebM export.
  wobbleEngine: WobbleEngine;
  // Locked at game:start; order drives rotation.
  players: Player[];
  phase: RoomPhase;
  // 0–6 = writing rounds; 7 = reveal.
  currentRound: number;
  // stories[i] belongs to players[i] at round 0.
  stories: Story[];
  // socket.ids that have submitted this round.
  submittedThisRound: Set<string>;
  // Epoch ms.
  roundDeadline: number | null;
  roundTimer: ServerTimerHandle | null;
  // socket.ids of non-bot players who toggled "ready" on the end screen
  // (spec §5 game:ready / game:restartReady). Cleared on restart.
  readyForRestart: Set<string>;
  // True once the host has shared the room gallery (spec §24). While set, a
  // late-arriving picture re-broadcasts gallery:ready so the gallery self-heals.
  galleryShared: boolean;
}

// ============================================================================
// Error codes (spec §5)
// ============================================================================

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_LOCKED'
  | 'ROOM_FULL'
  | 'NOT_HOST'
  | 'NOT_ENOUGH_PLAYERS'
  | 'INVALID_NICKNAME'
  | 'RATE_LIMITED'
  | 'SERVER_BUSY';

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
}

// ============================================================================
// Client → Server event payloads (spec §5)
// ============================================================================

export interface RoomCreatePayload {
  nickname: string;
  language: Language;
}

export interface GameStartPayload {
  // Host's recording-engine choice at the moment of pressing Start Game.
  // The server stores it on the room and re-broadcasts via lobby:update so
  // every joiner records with the same engine.
  wobbleEngine?: WobbleEngine;
}

export interface RoomCreateAck {
  roomCode: string;
  socketId: string;
}

export interface RoomJoinPayload {
  roomCode: string;
  nickname: string;
}

// Discriminated union: error branch when join fails, success branch otherwise.
export type RoomJoinAck =
  | { error: ErrorPayload }
  | {
      socketId: string;
      players: Player[];
      language: Language;
      hostId: string;
    };

export interface RoundSubmitPayload {
  // Empty string allowed; treated as auto-fill (per spec §1, §17).
  answer: string;
}

export interface GameReadyPayload {
  ready: boolean;
}

// ============================================================================
// Server → Client event payloads (spec §5)
// ============================================================================

export interface LobbyUpdatePayload {
  players: Player[];
  hostId: string;
  // Deployer's DEPLOYER_DONATE_URL env var value, or null when unset (spec §18, §20).
  donateUrl: string | null;
  // Host's recording-engine choice, broadcast so joiners record with the same engine.
  wobbleEngine: WobbleEngine;
}

export interface RoundStartPayload {
  roundNumber: number;
  // Question text in the room's language.
  question: string;
  // Epoch ms; client computes remaining time from its own Date.now().
  deadline: number;
}

export interface RoundWaitingPayload {
  submitted: number;
  total: number;
}

export interface RevealStartPayload {
  // This player's 7 answers, for inline highlighting in the prose.
  answers: string[];
  // Rendered story in the room's language.
  prose: string;
}

export interface RevealPictureReadyPayload {
  // Base64 data URL.
  pictureUrl: string;
  // The exact prompt sent to the image Worker — displayed under the
  // picture for debugging which slots the model honored.
  imagePrompt: string;
}

// Discriminator for the reveal:pictureError UX (item 4 of
// BUGS_AND_IMPROVEMENTS_02.md). `CAP_REACHED` lets the client switch to
// the i18n-friendly "oven is full, new cartoons in ~N hours" caption and
// compute the hours-until-reset locally. `GENERIC` (the default when the
// field is absent) keeps the legacy "Generation failed" UX. The wire
// `message` field stays as an English fallback so older clients that
// don't know about `code` still show something sensible.
export type RevealPictureErrorCode = 'CAP_REACHED' | 'GENERIC';

export interface RevealPictureErrorPayload {
  message: string;
  code?: RevealPictureErrorCode;
}

export interface GameRestartReadyPayload {
  readyIds: string[];
}

// Sent to the host when a player is lost — i.e. botified after the §7 grace
// window elapsed with no return (spec §12 host notice).
export interface PlayerLostPayload {
  nickname: string;
}

// Server stats fetched by the Home screen via stats:get (spec §13, §15, §26).
export interface StatsPayload {
  // Number of rooms currently open on this server.
  openRooms: number;
  // AI pictures generated since 00:00 UTC, process-global counter (§11, §17).
  imagesGeneratedToday: number;
  // Daily image cap (`MAX_IMAGES_PER_DAY`); the host can derive "remaining"
  // as imagesLimit - imagesGeneratedToday.
  imagesLimit: number;
}

// One story + its generated picture, for the shared room gallery (spec §24).
export interface GalleryEntry {
  nickname: string;
  isBot: boolean;
  // This story's 7 answers, for inline phrase highlighting (as in reveal:start).
  answers: string[];
  // Rendered story in the room's language.
  prose: string;
  // Base64 data URL, or null when no picture exists — a bot slot, or a human
  // whose generation was skipped or failed.
  pictureUrl: string | null;
}

export interface GalleryReadyPayload {
  // One entry per player slot, in players[] order.
  entries: GalleryEntry[];
}

// ============================================================================
// Socket event name maps (for typed socket.io on both sides)
// ============================================================================

export interface ClientToServerEvents {
  'room:create': (payload: RoomCreatePayload, ack: (response: RoomCreateAck) => void) => void;
  'room:join': (payload: RoomJoinPayload, ack: (response: RoomJoinAck) => void) => void;
  'room:leave': () => void;
  'game:start': (payload?: GameStartPayload) => void;
  'round:submit': (payload: RoundSubmitPayload) => void;
  'reveal:requestPicture': () => void;
  'reveal:retryPicture': () => void;
  'game:ready': (payload: GameReadyPayload) => void;
  'game:restart': () => void;
  'game:end': () => void;
  // Host only; broadcasts the room gallery to every player (spec §24).
  'gallery:share': () => void;
  // One-shot fetch of server stats for the Home screen (spec §13).
  'stats:get': (ack: (response: StatsPayload) => void) => void;
}

export interface ServerToClientEvents {
  'lobby:update': (payload: LobbyUpdatePayload) => void;
  'round:start': (payload: RoundStartPayload) => void;
  'round:waiting': (payload: RoundWaitingPayload) => void;
  'reveal:start': (payload: RevealStartPayload) => void;
  'reveal:pictureReady': (payload: RevealPictureReadyPayload) => void;
  'reveal:pictureError': (payload: RevealPictureErrorPayload) => void;
  'game:restartReady': (payload: GameRestartReadyPayload) => void;
  'game:over': () => void;
  // Host-only: a player was lost (botified after the grace window — spec §12).
  'player:lost': (payload: PlayerLostPayload) => void;
  // The shared room gallery — sent to every player after the host shares, and
  // re-sent when a late picture arrives (spec §24).
  'gallery:ready': (payload: GalleryReadyPayload) => void;
  // Live broadcast of the server-stats payload (spec §26). Fired whenever
  // openRooms or imagesGeneratedToday changes — pairs with the one-shot
  // stats:get fetch so the host's Home-screen counter ticks visibly
  // rather than only updating on remount (item 22 of
  // BUGS_AND_IMPROVEMENTS_01.md). Broadcast to every connected socket;
  // non-Home-screen clients simply ignore it.
  'stats:update': (payload: StatsPayload) => void;
  error: (payload: ErrorPayload) => void;
}
