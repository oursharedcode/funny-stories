// SPDX-License-Identifier: AGPL-3.0-only

// Item 4 of BUGS_AND_IMPROVEMENTS_02.md — handlePictureRequest's
// reveal:pictureError payload now carries a `code` discriminator so the
// client can switch to the i18n'd "oven is full, new cartoons in ~N
// hours" caption on CAP_REACHED and keep the generic "Generation failed"
// UX otherwise. These tests pin the wire shape on both error paths.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./image.js', () => {
  let slotAvailable = true;
  let imageResult: Promise<string> = Promise.resolve('data:image/png;base64,FAKE');
  return {
    reserveImageSlot: vi.fn(() => slotAvailable),
    generateImage: vi.fn(() => imageResult),
    imagesGeneratedToday: () => 0,
    maxImagesPerDay: () => 25,
    __setSlotAvailable: (v: boolean) => {
      slotAvailable = v;
    },
    __setImageResult: (p: Promise<string>) => {
      imageResult = p;
    },
  };
});

vi.mock('./stats.js', () => ({
  broadcastStats: vi.fn(),
  buildStats: () => ({ openRooms: 0, imagesGeneratedToday: 0, imagesLimit: 25 }),
}));

import { handlePictureRequest } from './game.js';
import type { Player, Room, Story } from './types.js';
import * as imageModule from './image.js';

type ImageMockExtras = {
  __setSlotAvailable: (v: boolean) => void;
  __setImageResult: (p: Promise<string>) => void;
};
const imageMock = imageModule as unknown as typeof imageModule & ImageMockExtras;

function story(answers: (string | null)[]): Story {
  return { answers, pictureUrl: null };
}

function makeRoom(players: Player[], stories: Story[]): Room {
  return {
    code: 'ABCDEF',
    hostId: players[0]!.id,
    language: 'en',
    players,
    phase: 'reveal',
    currentRound: 7,
    stories,
    submittedThisRound: new Set(),
    roundDeadline: null,
    roundTimer: null,
    readyForRestart: new Set(),
    galleryShared: false,
  };
}

// Captures `(event, payload)` pairs emitted to specific socket ids via
// io.to(id).emit(...). Bare io.emit(...) goes into a separate bucket but
// handlePictureRequest only uses io.to(socketId).
function makeIo() {
  const targeted: Array<{ to: string; event: string; payload: unknown }> = [];
  const io = {
    to: vi.fn((id: string) => ({
      emit: vi.fn((event: string, payload: unknown) => {
        targeted.push({ to: id, event, payload });
      }),
    })),
    emit: vi.fn(),
  };
  return { io: io as unknown as Parameters<typeof handlePictureRequest>[2], targeted };
}

const aSeven = ['who', 'with whom', 'where', 'when', 'action', 'why', 'ending'];

beforeEach(() => {
  vi.clearAllMocks();
  imageMock.__setSlotAvailable(true);
  imageMock.__setImageResult(Promise.resolve('data:image/png;base64,FAKE'));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('handlePictureRequest error payloads — item 4 of BUGS_AND_IMPROVEMENTS_02.md', () => {
  it('emits code "CAP_REACHED" when the daily slot reservation fails', async () => {
    imageMock.__setSlotAvailable(false);
    const room = makeRoom(
      [{ id: 's1', nickname: 'Alice', isBot: false }],
      [story(aSeven)],
    );
    const { io, targeted } = makeIo();

    await handlePictureRequest(room, 's1', io);

    const errors = targeted.filter((e) => e.event === 'reveal:pictureError');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.to).toBe('s1');
    expect(errors[0]!.payload).toMatchObject({ code: 'CAP_REACHED' });
    // Wire fallback `message` stays for older clients that don't read `code`.
    expect(errors[0]!.payload).toHaveProperty('message');
  });

  it('emits code "GENERIC" when the Worker call throws', async () => {
    imageMock.__setImageResult(Promise.reject(new Error('boom')));
    const room = makeRoom(
      [{ id: 's1', nickname: 'Alice', isBot: false }],
      [story(aSeven)],
    );
    const { io, targeted } = makeIo();

    await handlePictureRequest(room, 's1', io);

    const errors = targeted.filter((e) => e.event === 'reveal:pictureError');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.payload).toMatchObject({ code: 'GENERIC' });
  });

  it('emits no error and includes the picture URL when generation succeeds', async () => {
    const room = makeRoom(
      [{ id: 's1', nickname: 'Alice', isBot: false }],
      [story(aSeven)],
    );
    const { io, targeted } = makeIo();

    await handlePictureRequest(room, 's1', io);

    const errors = targeted.filter((e) => e.event === 'reveal:pictureError');
    const readys = targeted.filter((e) => e.event === 'reveal:pictureReady');
    expect(errors).toHaveLength(0);
    expect(readys).toHaveLength(1);
    expect(readys[0]!.payload).toMatchObject({ pictureUrl: 'data:image/png;base64,FAKE' });
  });
});
