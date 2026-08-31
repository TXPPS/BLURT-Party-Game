/**
 * BLURT — assembling what goes out on the wire.
 *
 * The Durable Object decides *when* to broadcast; this module decides *what* a
 * broadcast contains. Keeping the two apart means the shape of a `state` message can
 * be checked without a socket, and the room is left holding only the parts that need
 * a socket to make sense.
 */

import type { ServerMessage, StateMessage } from '../../shared/protocol.js';
import { toPublicPlayer } from './roomState.js';
import type { RoomState, ServerPlayer } from './types.js';
import { buildPrivate, buildPublicRoom, buildPublicView, buildSelfView } from './views.js';

/** The part of a broadcast that is identical for everybody in the room. */
export interface SharedState {
  room: StateMessage['room'];
  players: StateMessage['players'];
  view: StateMessage['view'];
  serverTime: number;
}

/** Built once per broadcast, then stamped with each player's own self view. */
export function sharedState(
  room: RoomState,
  now: number,
  imageUrl: (index: number) => string,
  joinUrl: string,
): SharedState {
  return {
    room: buildPublicRoom(room),
    players: room.players.filter((p) => !p.kicked).map((p) => toPublicPlayer(p, now)),
    view: buildPublicView(room, now, imageUrl, joinUrl),
    serverTime: now,
  };
}

/** The two messages one player receives: the shared state, and anything private. */
export function messagesFor(
  room: RoomState,
  player: ServerPlayer,
  shared: SharedState,
): ServerMessage[] {
  const state: StateMessage = {
    t: 'state',
    phase: room.phase,
    room: shared.room,
    players: shared.players,
    view: shared.view,
    you: buildSelfView(room, player),
    serverTime: shared.serverTime,
  };
  const priv = buildPrivate(room, player);
  return priv === null ? [state] : [state, priv];
}

/** The address a player types in. Empty until a client has told us its origin. */
export function joinUrl(origin: string, code: string): string {
  return origin.length > 0 ? `${origin}/?room=${code}` : '';
}

/**
 * A cacheable URL for one drawing. The match start time is in the query so that a
 * PLAY AGAIN reusing drawing index 0 never serves the previous match's picture out of
 * the browser cache.
 */
export function drawingUrl(room: RoomState, index: number): string {
  const version = room.match?.startedAt ?? 0;
  return `/api/rooms/${room.code}/drawing/${index}?v=${version}`;
}
