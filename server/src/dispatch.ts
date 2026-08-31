/**
 * BLURT — the message dispatcher.
 *
 * The order of checks here is the security model:
 *
 *   1. Does the frame parse, and is it a message in the schema?
 *   2. Is this socket bound to a seat yet? If not, only the three handshake
 *      messages exist.
 *   3. Is the message legal in the current phase?
 *   4. If it is host-only, is the sender the host *according to the server*?
 *
 * A message that fails any of these is answered with a friendly error and mutates
 * nothing. There is no path from a rejected message to a state change.
 */

import { PROTOCOL_VERSION } from '../../shared/constants.js';
import type { ErrorCode } from '../../shared/protocol.js';
import { ERROR_COPY } from '../../shared/protocol.js';
import { normalizeRoomCode, sanitizeText } from '../../shared/sanitize.js';
import { NAME_MAX_LENGTH } from '../../shared/constants.js';
import { hasRoomFor } from './handlers.js';
import { findPlayer } from './roomState.js';
import { parseClientMessage } from './validate.js';
import type { RoomDO } from './RoomDO.js';

function fail(room: RoomDO, socket: WebSocket, code: ErrorCode, fatal: boolean, override?: string): void {
  const preset = ERROR_COPY[code];
  room.send(socket, {
    t: 'error',
    code,
    // The client supplies the title from ERROR_COPY; sending it again here made
    // every error screen repeat itself.
    message: override ?? preset.body,
    fatal,
  });
  if (fatal) room.closeSocket(socket, code);
}

export function dispatch(room: RoomDO, socket: WebSocket, raw: string | ArrayBuffer, now: number): void {
  const parsed = parseClientMessage(raw);
  if (!parsed.ok) {
    const code: ErrorCode = parsed.reason === 'too_large' ? 'PAYLOAD_TOO_LARGE' : 'INVALID_MESSAGE';
    fail(room, socket, code, false);
    console.warn(`[blurt] rejected frame (${parsed.reason}): ${parsed.detail}`);
    return;
  }

  const message = parsed.message;
  const meta = room.metaOf(socket);

  /* ---- Handshake: this socket has no seat yet ---------------------- */
  if (meta.playerId === null) {
    if (message.t === 'ping') {
      room.send(socket, { t: 'pong', sentAt: message.sentAt, serverTime: now });
      return;
    }

    if (message.t === 'create_room' || message.t === 'join_room' || message.t === 'reconnect') {
      if (message.protocolVersion !== PROTOCOL_VERSION) {
        fail(room, socket, 'VERSION_MISMATCH', true);
        return;
      }
    }

    switch (message.t) {
      case 'create_room': {
        const state = room.liveRoom();
        if (state === null) {
          fail(room, socket, 'ROOM_NOT_FOUND', true);
          return;
        }
        const player = room.addPlayer(now);
        room.bindSocket(socket, player.id);
        if (state.hostId === null) {
          state.hostId = player.id;
          player.isHost = true;
        }
        // Set before the host is told anything, so the very first state they see
        // already carries the mode their name and avatar pickers depend on.
        if (message.mode !== undefined) {
          state.settings.mode = message.mode;
          // They cleared the 18+ gate on the home screen to get here; showing it
          // again the moment they arrive is the same question twice.
          if (message.mode === 'crude') player.adultAcknowledged = true;
        }
        if (message.hostName !== undefined) {
          const clean = sanitizeText(message.hostName, { maxLength: NAME_MAX_LENGTH });
          if (clean.ok) player.name = clean.value;
        }
        room.hello(socket, player.id, player.token, state.code);
        room.markDirty();
        return;
      }

      case 'join_room': {
        const state = room.liveRoom();
        const code = normalizeRoomCode(message.code);
        if (state === null) {
          fail(room, socket, 'ROOM_NOT_FOUND', true);
          return;
        }
        if (code !== state.code) {
          fail(room, socket, 'INVALID_ROOM_CODE', true);
          return;
        }
        if (state.phase !== 'LOBBY') {
          fail(room, socket, 'GAME_ALREADY_STARTED', true);
          return;
        }
        if (!hasRoomFor(state, now)) {
          fail(room, socket, 'ROOM_FULL', true);
          return;
        }
        const player = room.addPlayer(now);
        room.bindSocket(socket, player.id);
        room.hello(socket, player.id, player.token, state.code);
        room.markDirty();
        return;
      }

      case 'reconnect': {
        const state = room.liveRoom();
        if (state === null || normalizeRoomCode(message.roomCode) !== state.code) {
          fail(room, socket, 'ROOM_NOT_FOUND', true);
          return;
        }
        if (!room.restoreSession(socket, message.playerId, message.token)) {
          fail(room, socket, 'SESSION_NOT_RESTORED', true);
          return;
        }
        const player = findPlayer(state, message.playerId);
        if (player === undefined) {
          fail(room, socket, 'SESSION_NOT_RESTORED', true);
          return;
        }
        room.hello(socket, player.id, player.token, state.code);
        room.markDirty();
        return;
      }

      default:
        // Anything else before a seat exists is a client bug or a probe.
        fail(room, socket, 'INVALID_MESSAGE', true, 'Join a room before doing that.');
        return;
    }
  }

  /* ---- Seated: normal gameplay traffic ----------------------------- */

  if (message.t === 'ping') {
    room.send(socket, { t: 'pong', sentAt: message.sentAt, serverTime: now });
    return;
  }

  const state = room.liveRoom();
  if (state === null) {
    fail(room, socket, 'ROOM_CLOSED', true);
    return;
  }

  const player = findPlayer(state, meta.playerId);
  if (player === undefined || player.kicked) {
    fail(room, socket, 'KICKED', true);
    return;
  }

  // A create/join/reconnect on an already-seated socket is a no-op, not an error:
  // a client that retries its handshake after a flaky reconnect should not be
  // punished for it.
  if (message.t === 'create_room' || message.t === 'join_room' || message.t === 'reconnect') {
    room.hello(socket, player.id, player.token, state.code);
    return;
  }

  const blocked = room.guard(message, player.id);
  if (blocked !== null) {
    fail(room, socket, blocked, false);
    console.warn(`[blurt] ${state.code}: refused ${message.t} in ${state.phase} (${blocked})`);
    return;
  }

  room.applyMessage(player, message, now);
}
