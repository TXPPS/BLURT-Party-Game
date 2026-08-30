/**
 * BLURT — room codes.
 *
 * A code has to survive being shouted across a room, typed by someone holding a
 * drink, and read off a TV from the sofa. Four letters that spell a real word beat
 * four random letters on every one of those axes, so the generator draws from a
 * curated wordlist and only falls back to random letters when the room happens to
 * collide eight times in a row.
 */

import { ROOM_CODE_LENGTH, ROOM_CODE_MAX_ATTEMPTS } from './constants.js';
import { isClean } from './blocklist.js';
import { ROOM_WORDS } from './roomWords.js';
import { normalizeRoomCode } from './sanitize.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface RoomCodeSource {
  /** Returns an integer in [0, maxExclusive). Backed by crypto on the server. */
  randomInt(maxExclusive: number): number;
}

/** Crypto-backed source. Room codes are guessable by design (4 letters), but the
 *  draw should still not be predictable from a previous code. */
export function cryptoCodeSource(): RoomCodeSource {
  return {
    randomInt(maxExclusive: number): number {
      if (maxExclusive <= 0) return 0;
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return (buf[0] as number) % maxExclusive;
    },
  };
}

/** True when `code` is exactly four A–Z characters. */
export function isValidRoomCode(code: string): boolean {
  return new RegExp(`^[A-Z]{${ROOM_CODE_LENGTH}}$`).test(code);
}

/**
 * Draw a word code, avoiding anything in `taken`.
 * Returns `null` when every attempt collided — callers then use `randomLetterCode`.
 */
export function pickWordCode(source: RoomCodeSource, taken: ReadonlySet<string>): string | null {
  for (let attempt = 0; attempt < ROOM_CODE_MAX_ATTEMPTS; attempt += 1) {
    const word = ROOM_WORDS[source.randomInt(ROOM_WORDS.length)];
    if (word !== undefined && !taken.has(word)) return word;
  }
  return null;
}

/** Last-resort code: four random letters, still checked against the blocklist. */
export function randomLetterCode(source: RoomCodeSource): string {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
      code += LETTERS[source.randomInt(LETTERS.length)] ?? 'X';
    }
    if (isClean(code)) return code;
  }
  return 'BLRT';
}

/**
 * Full generation strategy: prefer a real word, degrade to random letters.
 * `taken` is supplied by the caller, which probes for a live Durable Object per
 * candidate — see `server/src/worker.ts`.
 */
export function generateRoomCode(source: RoomCodeSource, taken: ReadonlySet<string>): string {
  return pickWordCode(source, taken) ?? randomLetterCode(source);
}

/**
 * Parse whatever the player typed into a code, or explain why it is not one.
 * Players paste "room joke", "j-o-k-e" and "Joke"; all three should just work.
 */
export function parseRoomCode(input: unknown): { ok: true; code: string } | { ok: false; reason: string } {
  const code = normalizeRoomCode(input);
  if (code.length === 0) return { ok: false, reason: 'Enter the 4-letter code from the big screen.' };
  if (code.length < ROOM_CODE_LENGTH) return { ok: false, reason: 'Room codes are 4 letters long.' };
  return { ok: true, code };
}

/** Exposed so the content linter can assert the wordlist is big and clean enough. */
export { ROOM_WORDS };
