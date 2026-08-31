/**
 * BLURT — identifier and secret generation.
 *
 * Player ids are public and only need to be unique. Tokens are the reconnect
 * secret: they are the *only* thing that proves identity, so they come from
 * `crypto.getRandomValues`, never from a counter or a name.
 */

const TOKEN_BYTES = 32;

/** Public, non-secret player identifier. */
export function newPlayerId(): string {
  return crypto.randomUUID();
}

/** 32 bytes of cryptographic randomness, hex-encoded. Never broadcast. */
export function newToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Short opaque id for answers, options, rounds — unique within a room, not secret. */
export function shortId(prefix: string, seq: number): string {
  return `${prefix}_${seq.toString(36)}`;
}

/**
 * Constant-time string comparison, so a token check cannot be narrowed by timing.
 * Both strings are hex of a known length, which keeps this simple and correct.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
