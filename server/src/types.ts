// SPDX-License-Identifier: AGPL-3.0-only

// Re-exports of the core data model. Canonical definitions live in
// shared/events.ts so the client can typecheck against the same shapes.
// Server-internal helpers may augment these with narrower types as needed.

export type {
  ClientToServerEvents,
  ErrorCode,
  ErrorPayload,
  GalleryEntry,
  GalleryReadyPayload,
  Language,
  LobbyUpdatePayload,
  Player,
  PlayerLostPayload,
  Room,
  RoomPhase,
  ServerToClientEvents,
  StatsPayload,
  Story,
} from 'shared';
