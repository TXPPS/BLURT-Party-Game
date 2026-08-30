import { describe, expect, it } from 'vitest';
import {
  generateRoomCode,
  isValidRoomCode,
  parseRoomCode,
  pickWordCode,
  randomLetterCode,
} from '../shared/roomCode.js';
import { ROOM_WORDS, MIN_ROOM_WORDS } from '../shared/roomWords.js';
import { isClean } from '../shared/blocklist.js';
import { makeRng, randomInt } from '../shared/rng.js';
import { ROOM_CODE_MAX_ATTEMPTS } from '../shared/constants.js';

function seededSource(seed: number) {
  const rng = makeRng(seed);
  return { randomInt: (max: number) => randomInt(rng, max) };
}

describe('room-code wordlist', () => {
  it('is large enough to make collisions rare', () => {
    expect(ROOM_WORDS.length).toBeGreaterThanOrEqual(MIN_ROOM_WORDS);
  });

  it('is exactly four uppercase letters, everywhere', () => {
    for (const word of ROOM_WORDS) expect(word).toMatch(/^[A-Z]{4}$/);
  });

  it('has no duplicates', () => {
    expect(new Set(ROOM_WORDS).size).toBe(ROOM_WORDS.length);
  });

  it('contains nothing on the blocklist', () => {
    for (const word of ROOM_WORDS) expect(isClean(word), word).toBe(true);
  });
});

describe('generateRoomCode', () => {
  it('produces a valid code', () => {
    const code = generateRoomCode(seededSource(1), new Set());
    expect(isValidRoomCode(code)).toBe(true);
    expect(ROOM_WORDS).toContain(code);
  });

  it('never returns a code that is already taken', () => {
    const taken = new Set(ROOM_WORDS.slice(0, 100));
    for (let seed = 0; seed < 200; seed += 1) {
      const code = generateRoomCode(seededSource(seed), taken);
      expect(taken.has(code)).toBe(false);
    }
  });

  it('falls back to random letters when every word is taken', () => {
    const allTaken = new Set(ROOM_WORDS);
    const code = generateRoomCode(seededSource(7), allTaken);
    expect(isValidRoomCode(code)).toBe(true);
    expect(isClean(code)).toBe(true);
  });

  it('gives up on words after the documented number of attempts', () => {
    let calls = 0;
    const source = {
      randomInt: (max: number) => {
        calls += 1;
        return max - 1; // always the same word
      },
    };
    const lastWord = ROOM_WORDS[ROOM_WORDS.length - 1] as string;
    expect(pickWordCode(source, new Set([lastWord]))).toBeNull();
    expect(calls).toBe(ROOM_CODE_MAX_ATTEMPTS);
  });

  it('spreads across the list rather than favouring one word', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 400; seed += 1) seen.add(generateRoomCode(seededSource(seed), new Set()));
    expect(seen.size).toBeGreaterThan(200);
  });
});

describe('randomLetterCode', () => {
  it('always returns four clean letters', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const code = randomLetterCode(seededSource(seed));
      expect(code).toMatch(/^[A-Z]{4}$/);
      expect(isClean(code)).toBe(true);
    }
  });
});

describe('parseRoomCode', () => {
  it('accepts what a human actually types', () => {
    expect(parseRoomCode('beef')).toEqual({ ok: true, code: 'BEEF' });
    expect(parseRoomCode(' b e e f ')).toEqual({ ok: true, code: 'BEEF' });
    expect(parseRoomCode('BEEF')).toEqual({ ok: true, code: 'BEEF' });
  });

  it('explains itself when the code is wrong', () => {
    const empty = parseRoomCode('');
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.reason).toMatch(/4-letter/i);

    const short = parseRoomCode('BEE');
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.reason).toMatch(/4 letters/i);
  });
});
