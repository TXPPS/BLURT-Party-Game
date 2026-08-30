/**
 * BLURT — deterministic pseudo-random numbers.
 *
 * Matchmaking, tie-breaks and coin flips all need randomness that a test can
 * reproduce exactly. Every such call site takes an `Rng` rather than reaching for
 * `Math.random()`, so a seeded run replays identically on the server, in the bot
 * harness and inside vitest.
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
}

/**
 * mulberry32 — small, fast, and good enough for shuffling party-game answers.
 * Not cryptographic; secrets use `crypto.getRandomValues` instead (see `token.ts`).
 */
export function makeRng(seed: number): Rng {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Hash an arbitrary string to a 32-bit seed (FNV-1a). */
export function seedFromString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Seed derived from room + round + purpose, so every draw is reproducible. */
export function roundSeed(roomCode: string, roundIndex: number, purpose: string): number {
  return seedFromString(`${roomCode}:${roundIndex}:${purpose}`);
}

/** Integer in [0, maxExclusive). */
export function randomInt(rng: Rng, maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  return Math.floor(rng.next() * maxExclusive) % maxExclusive;
}

/** Uniformly pick one item. Returns undefined only for an empty list. */
export function pick<T>(rng: Rng, items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[randomInt(rng, items.length)];
}

/** Fisher–Yates. Returns a new array; the input is never mutated. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(rng, i + 1);
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}
