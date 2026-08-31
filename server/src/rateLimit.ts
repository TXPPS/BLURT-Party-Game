/**
 * BLURT — per-socket rate limiting.
 *
 * A token bucket: `RATE_LIMIT_BURST` messages available immediately, refilling at
 * `RATE_LIMIT_SUSTAINED_PER_SEC`. That shape is deliberate — a player tapping a vote
 * button four times in a second is normal, and a script sending four hundred is not.
 *
 * State lives in memory rather than in Durable Object storage. If the object
 * hibernates the buckets reset, which is harmless: hibernation only happens after a
 * period of inactivity, which is exactly when a bucket would have refilled anyway.
 */

import {
  RATE_LIMIT_BURST,
  RATE_LIMIT_STRIKES,
  RATE_LIMIT_SUSTAINED_PER_SEC,
} from '../../shared/constants.js';

interface Bucket {
  tokens: number;
  lastRefillAt: number;
  strikes: number;
}

export type RateVerdict = 'ok' | 'throttled' | 'disconnect';

export class RateLimiter {
  private readonly buckets = new WeakMap<WebSocket, Bucket>();

  /**
   * Charge one message against a socket's bucket.
   *
   * Returns `throttled` for a single overrun (the client gets a friendly error and
   * the message is dropped), and `disconnect` once a socket has been throttled
   * `RATE_LIMIT_STRIKES` times in a row without recovering.
   */
  check(socket: WebSocket, now: number): RateVerdict {
    let bucket = this.buckets.get(socket);
    if (bucket === undefined) {
      bucket = { tokens: RATE_LIMIT_BURST, lastRefillAt: now, strikes: 0 };
      this.buckets.set(socket, bucket);
    }

    const elapsedSeconds = Math.max(0, now - bucket.lastRefillAt) / 1000;
    bucket.tokens = Math.min(
      RATE_LIMIT_BURST,
      bucket.tokens + elapsedSeconds * RATE_LIMIT_SUSTAINED_PER_SEC,
    );
    bucket.lastRefillAt = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      bucket.strikes = 0;
      return 'ok';
    }

    bucket.strikes += 1;
    return bucket.strikes >= RATE_LIMIT_STRIKES ? 'disconnect' : 'throttled';
  }

  forget(socket: WebSocket): void {
    this.buckets.delete(socket);
  }
}
