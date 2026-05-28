// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest';
import { storyIndex } from './game.js';

describe('storyIndex — spec §4 rotation formula', () => {
  it('N=3, R=0 — initial round, each player gets their own story', () => {
    expect(storyIndex(0, 0, 3)).toBe(0);
    expect(storyIndex(1, 0, 3)).toBe(1);
    expect(storyIndex(2, 0, 3)).toBe(2);
  });

  it('N=3, R=1 — matches the spec example: P0→S2, P1→S0, P2→S1', () => {
    expect(storyIndex(0, 1, 3)).toBe(2);
    expect(storyIndex(1, 1, 3)).toBe(0);
    expect(storyIndex(2, 1, 3)).toBe(1);
  });

  it('N=3, R=2 — second rotation', () => {
    expect(storyIndex(0, 2, 3)).toBe(1);
    expect(storyIndex(1, 2, 3)).toBe(2);
    expect(storyIndex(2, 2, 3)).toBe(0);
  });

  it('N=3, R=3 — wraps cleanly back to the identity assignment', () => {
    expect(storyIndex(0, 3, 3)).toBe(0);
    expect(storyIndex(1, 3, 3)).toBe(1);
    expect(storyIndex(2, 3, 3)).toBe(2);
  });

  it('N=7, R∈[0..6] — every player touches every story exactly once', () => {
    for (let p = 0; p < 7; p++) {
      const visited = new Set<number>();
      for (let r = 0; r < 7; r++) {
        visited.add(storyIndex(p, r, 7));
      }
      expect(visited.size).toBe(7);
    }
  });

  it('N=7, R∈[0..6] — every round is a bijection (no two players share a story)', () => {
    for (let r = 0; r < 7; r++) {
      const stories = new Set<number>();
      for (let p = 0; p < 7; p++) {
        stories.add(storyIndex(p, r, 7));
      }
      expect(stories.size).toBe(7);
    }
  });

  it('N=5, R=6 — round count > player count, spec §1 says some repeats are intentional', () => {
    // (P - R) mod N with double-modulo to stay non-negative in JS.
    // P=0, R=6, N=5 → (-6 mod 5 + 5) mod 5 = (-1 + 5) mod 5 = 4
    expect(storyIndex(0, 6, 5)).toBe(4);
    expect(storyIndex(1, 6, 5)).toBe(0);
    expect(storyIndex(4, 6, 5)).toBe(3);
  });

  it('N=4 over a full 7-round game — each story receives every player at least once', () => {
    // With 4 players and 7 rounds, some stories see the same player twice.
    // The invariant we care about: every player visits every story at least once.
    for (let p = 0; p < 4; p++) {
      const visited = new Set<number>();
      for (let r = 0; r < 7; r++) {
        visited.add(storyIndex(p, r, 4));
      }
      expect(visited.size).toBe(4);
    }
  });

  it('rejects invalid inputs', () => {
    expect(() => storyIndex(0, 0, 0)).toThrow(RangeError);
    expect(() => storyIndex(0, 0, -1)).toThrow(RangeError);
    expect(() => storyIndex(-1, 0, 3)).toThrow(RangeError);
    expect(() => storyIndex(0, -1, 3)).toThrow(RangeError);
    expect(() => storyIndex(1.5, 0, 3)).toThrow(RangeError);
  });
});
