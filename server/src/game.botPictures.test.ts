// SPDX-License-Identifier: AGPL-3.0-only

// Item 3 of BUGS_AND_IMPROVEMENTS_02.md — server-side picture generation
// for bot-owned stories. Until this fix, only humans triggered picture
// generation (via reveal:requestPicture on receipt of reveal:start), so a
// disconnected/botified player's story stayed picture-less and the gallery
// showed a gap. The new generateBotStoryPictures helper closes that gap.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the image and stats modules before importing game.ts so its
// internal references bind to the mocks. The image module must export
// the same surface the real one does (reserveImageSlot, generateImage,
// imagesGeneratedToday, maxImagesPerDay) — the stats module imports the
// latter two.
vi.mock('./image.js', () => {
  let slotAvailable = true;
  let imageResult: Promise<string> = Promise.resolve('data:image/png;base64,FAKE');
  return {
    reserveImageSlot: vi.fn(() => {
      if (!slotAvailable) return false;
      return true;
    }),
    generateImage: vi.fn(() => imageResult),
    imagesGeneratedToday: () => 0,
    maxImagesPerDay: () => 25,
    // Test-only helpers.
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

import { generateBotStoryPictures } from './game.js';
import type { Player, Room, Story } from './types.js';
import * as imageModule from './image.js';

type ImageMockExtras = {
  __setSlotAvailable: (v: boolean) => void;
  __setImageResult: (p: Promise<string>) => void;
};
const imageMock = imageModule as unknown as typeof imageModule & ImageMockExtras;

function story(answers: (string | null)[], pictureUrl: string | null = null): Story {
  return { answers, pictureUrl };
}

function player(id: string, nickname: string, isBot: boolean): Player {
  return { id, nickname, isBot };
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

// Minimal IO stub matching the surface generateBotStoryPictures touches:
// .to(...).emit(...). We don't assert on the emitted events here — the
// outcome we care about is `story.pictureUrl` getting populated.
function makeIo() {
  const emit = vi.fn();
  return {
    to: vi.fn(() => ({ emit })),
    emit: vi.fn(),
    // The real Server has many more methods, but the helper only uses .to.
  } as unknown as Parameters<typeof generateBotStoryPictures>[1];
}

const aSeven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

beforeEach(() => {
  vi.clearAllMocks();
  imageMock.__setSlotAvailable(true);
  imageMock.__setImageResult(Promise.resolve('data:image/png;base64,FAKE'));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('generateBotStoryPictures — item 3 of BUGS_AND_IMPROVEMENTS_02.md', () => {
  it('does nothing when every player is human', async () => {
    const room = makeRoom(
      [player('s1', 'Alice', false), player('s2', 'Bob', false), player('s3', 'Carol', false)],
      [story(aSeven), story(aSeven), story(aSeven)],
    );
    await generateBotStoryPictures(room, makeIo());
    expect(imageMock.generateImage).not.toHaveBeenCalled();
    for (const s of room.stories) expect(s.pictureUrl).toBeNull();
  });

  it('generates a picture for a single bot-owned story', async () => {
    const room = makeRoom(
      [player('s1', 'Alice', false), player('s2', 'Bob', true), player('s3', 'Carol', false)],
      [story(aSeven), story(aSeven), story(aSeven)],
    );
    await generateBotStoryPictures(room, makeIo());
    expect(imageMock.generateImage).toHaveBeenCalledTimes(1);
    expect(room.stories[1]!.pictureUrl).toBe('data:image/png;base64,FAKE');
    expect(room.stories[0]!.pictureUrl).toBeNull();
    expect(room.stories[2]!.pictureUrl).toBeNull();
  });

  it('skips bot stories that already have a picture (write-once cache)', async () => {
    const room = makeRoom(
      [player('s1', 'Alice', false), player('s2', 'Bob', true)],
      [story(aSeven), story(aSeven, 'data:image/png;base64,EXISTING')],
    );
    await generateBotStoryPictures(room, makeIo());
    expect(imageMock.generateImage).not.toHaveBeenCalled();
    expect(room.stories[1]!.pictureUrl).toBe('data:image/png;base64,EXISTING');
  });

  it('stops after the daily cap is hit and does not retry further bot stories', async () => {
    imageMock.__setSlotAvailable(false);
    const room = makeRoom(
      [player('s1', 'Alice', true), player('s2', 'Bob', true), player('s3', 'Carol', true)],
      [story(aSeven), story(aSeven), story(aSeven)],
    );
    // All three are bots; reservation declines immediately for the first.
    // The helper should bail out without touching generateImage.
    // (Note: a truly all-bots room is deleted by removePlayer, but this
    // confirms the early-return behaviour on cap exhaustion regardless.)
    await generateBotStoryPictures(room, makeIo());
    expect(imageMock.generateImage).not.toHaveBeenCalled();
    for (const s of room.stories) expect(s.pictureUrl).toBeNull();
  });

  it('does not run when the room is no longer in reveal phase', async () => {
    const room = makeRoom(
      [player('s1', 'Alice', false), player('s2', 'Bob', true)],
      [story(aSeven), story(aSeven)],
    );
    room.phase = 'lobby';
    await generateBotStoryPictures(room, makeIo());
    expect(imageMock.generateImage).not.toHaveBeenCalled();
    expect(room.stories[1]!.pictureUrl).toBeNull();
  });

  it('silently absorbs Worker failures and leaves pictureUrl null', async () => {
    imageMock.__setImageResult(Promise.reject(new Error('boom')));
    const room = makeRoom(
      [player('s1', 'Alice', false), player('s2', 'Bob', true)],
      [story(aSeven), story(aSeven)],
    );
    await expect(generateBotStoryPictures(room, makeIo())).resolves.toBeUndefined();
    expect(room.stories[1]!.pictureUrl).toBeNull();
  });

  it('is idempotent — running twice generates only one picture per bot story', async () => {
    const room = makeRoom(
      [player('s1', 'Alice', false), player('s2', 'Bob', true)],
      [story(aSeven), story(aSeven)],
    );
    await generateBotStoryPictures(room, makeIo());
    await generateBotStoryPictures(room, makeIo());
    expect(imageMock.generateImage).toHaveBeenCalledTimes(1);
    expect(room.stories[1]!.pictureUrl).toBe('data:image/png;base64,FAKE');
  });
});
