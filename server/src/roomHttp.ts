/**
 * BLURT — the room's HTTP responses.
 *
 * A room answers three plain HTTP requests alongside its WebSocket: a probe the
 * lobby uses to tell "no such room" from "that room has started", a claim that
 * creates it, and the drawings. Shaping those responses is separable from deciding
 * whether to make them, so the shaping lives here and `RoomDO.fetch` stays a router.
 */

import { hasRoomFor } from './handlers.js';
import type { RoomState } from './types.js';

/** What the lobby needs to know before it lets somebody type a name. */
export function probeResponse(room: RoomState | null, now: number): Response {
  return Response.json({
    exists: room !== null,
    started: room !== null && room.phase !== 'LOBBY',
    full: room !== null && !hasRoomFor(room, now),
    players: room?.players.filter((p) => !p.kicked && p.identified).length ?? 0,
  });
}

/**
 * One drawing's bytes.
 *
 * Immutable caching is safe because the URL carries the match's start time, so a
 * PLAY AGAIN reusing drawing index 0 is a different URL. See `roomWire.drawingUrl`.
 */
export function drawingResponse(bytes: Uint8Array | null): Response {
  if (bytes === null) return new Response('not found', { status: 404 });
  return new Response(bytes, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=3600, immutable',
    },
  });
}

/** The room code is taken; whoever asked should roll another one. */
export function conflictResponse(): Response {
  return Response.json({ ok: false }, { status: 409 });
}

export function notFoundResponse(): Response {
  return new Response('not found', { status: 404 });
}
