/**
 * BLURT — the Worker.
 *
 * Two jobs, and deliberately nothing else:
 *   • allocate a room code and claim the Durable Object that owns it
 *   • route a WebSocket upgrade to the Durable Object for a code
 *
 * All game state and all authority live in the Durable Object. The Worker is
 * stateless, so it can be a plain edge function with no coordination of any kind.
 *
 * In production the same Worker also serves the built client from `[assets]`;
 * `run_worker_first` in `wrangler.toml` keeps `/ws` and `/api/*` away from the
 * single-page-application fallback.
 */

import { ROOM_CODE_MAX_ATTEMPTS } from '../../shared/constants.js';
import { NEW_ROOM_SENTINEL } from '../../shared/protocol.js';
import { cryptoCodeSource, isValidRoomCode, pickWordCode, randomLetterCode } from '../../shared/roomCode.js';
import { normalizeRoomCode } from '../../shared/sanitize.js';
import { RoomDO } from './RoomDO.js';

export { RoomDO };

export interface Env {
  ROOMS: DurableObjectNamespace;
  ASSETS?: Fetcher;
}

interface ProbeResult {
  exists: boolean;
  started: boolean;
  full: boolean;
  players: number;
}

function stubFor(env: Env, code: string): DurableObjectStub {
  // The object's id is derived from the code, so a code maps to exactly one room
  // everywhere in the world, with no registry and no coordination.
  return env.ROOMS.get(env.ROOMS.idFromName(`room:${code}`));
}

async function probe(env: Env, code: string): Promise<ProbeResult> {
  const response = await stubFor(env, code).fetch('https://room/probe');
  return (await response.json()) as ProbeResult;
}

/**
 * Allocate a room code.
 *
 * Claiming happens *inside* the Durable Object, which is single-threaded, so two
 * simultaneous creators asking for the same word cannot both win: the loser gets a
 * 409 and tries the next candidate. After `ROOM_CODE_MAX_ATTEMPTS` word codes it
 * falls back to random letters, which is effectively unreachable at any plausible
 * concurrency but keeps the failure mode "an uglier code" rather than "an error".
 */
async function allocateRoom(env: Env): Promise<string | null> {
  const source = cryptoCodeSource();
  const tried = new Set<string>();

  for (let attempt = 0; attempt < ROOM_CODE_MAX_ATTEMPTS; attempt += 1) {
    const candidate = pickWordCode(source, tried) ?? randomLetterCode(source);
    tried.add(candidate);

    const existing = await probe(env, candidate);
    if (existing.exists) continue;

    const claim = await stubFor(env, candidate).fetch(
      `https://room/claim?code=${encodeURIComponent(candidate)}`,
      { method: 'POST' },
    );
    if (claim.ok) return candidate;
  }

  for (let attempt = 0; attempt < ROOM_CODE_MAX_ATTEMPTS; attempt += 1) {
    const candidate = randomLetterCode(source);
    if (tried.has(candidate)) continue;
    tried.add(candidate);
    const claim = await stubFor(env, candidate).fetch(
      `https://room/claim?code=${encodeURIComponent(candidate)}`,
      { method: 'POST' },
    );
    if (claim.ok) return candidate;
  }

  return null;
}

const json = (body: unknown, status = 200): Response =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'blurt' });
    }

    // Create a room. POST only — a room should never be created by a link preview.
    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const code = await allocateRoom(env);
      if (code === null) return json({ error: 'could not allocate a room code' }, 503);
      return json({ code });
    }

    // Look a room up before joining, so the join screen can say "no such room"
    // without opening a socket.
    const roomLookup = /^\/api\/rooms\/([A-Za-z]{1,8})$/.exec(url.pathname);
    if (roomLookup !== null && request.method === 'GET') {
      const code = normalizeRoomCode(roomLookup[1]);
      if (!isValidRoomCode(code)) return json({ exists: false, reason: 'INVALID_ROOM_CODE' }, 400);
      return json({ code, ...(await probe(env, code)) });
    }

    // Drawings, served from the room that owns them. Kept on /api/* so the
    // single-page-application fallback never swallows it.
    const drawingLookup = /^\/api\/rooms\/([A-Za-z]{4})\/drawing\/(\d{1,3})$/.exec(url.pathname);
    if (drawingLookup !== null && request.method === 'GET') {
      const code = normalizeRoomCode(drawingLookup[1]);
      if (!isValidRoomCode(code)) return new Response('invalid room code', { status: 400 });
      const forward = new URL('https://room/drawing');
      forward.searchParams.set('index', drawingLookup[2] ?? '0');
      return stubFor(env, code).fetch(forward);
    }

    if (url.pathname === '/ws') {
      const requested = url.searchParams.get('code') ?? '';
      let code = normalizeRoomCode(requested);

      if (requested.toUpperCase() === NEW_ROOM_SENTINEL) {
        const allocated = await allocateRoom(env);
        if (allocated === null) return new Response('no room codes available', { status: 503 });
        code = allocated;
      } else if (!isValidRoomCode(code)) {
        return new Response('invalid room code', { status: 400 });
      }

      const forward = new URL('https://room/ws');
      forward.searchParams.set('origin', url.origin);
      return stubFor(env, code).fetch(new Request(forward, request));
    }

    if (env.ASSETS !== undefined) return env.ASSETS.fetch(request);
    return new Response('not found', { status: 404 });
  },
};
