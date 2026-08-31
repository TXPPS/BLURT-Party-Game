/**
 * BLURT — the WebSocket client.
 *
 * Plain `WebSocket` with three jobs beyond send/receive:
 *
 *   • **Clock skew.** Deadlines arrive as absolute server timestamps. This measures
 *     the offset between the two clocks at `hello` and refines it on every `pong`,
 *     so a phone with a wrong clock still shows the right countdown — and the client
 *     never polls the server for the time remaining.
 *   • **Reconnect.** Exponential backoff with jitter, replaying the stored token.
 *     Designed for hotel wifi: a socket that drops is not a lost game.
 *   • **Heartbeat.** A ping every 20s, which both measures skew and keeps
 *     intermediaries from idling the connection out.
 */

import { PING_INTERVAL_MS, PROTOCOL_VERSION } from '@shared/constants.js';
import type { ClientMessage, ServerMessage } from '@shared/protocol.js';
import { NEW_ROOM_SENTINEL } from '@shared/protocol.js';
import { clearSession, loadSession, saveSession } from './session.js';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface SocketHandlers {
  onMessage(message: ServerMessage): void;
  onStatus(status: ConnectionStatus): void;
}

/** Backoff schedule, in milliseconds. The last value repeats. */
const BACKOFF_MS = [400, 900, 1800, 3200, 5000, 8000];

/** Close codes the server uses for "do not come back". */
const FATAL_CLOSE_CODES = new Set([4001, 4003, 4004]);

export class RoomSocket {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private fatal = false;

  /** serverNow ≈ Date.now() + offsetMs. */
  private offsetMs = 0;
  private bestRoundTrip = Number.POSITIVE_INFINITY;

  constructor(
    private readonly code: string,
    private readonly intent: 'create' | 'join',
    private readonly handlers: SocketHandlers,
  ) {}

  /** Server time in epoch milliseconds, corrected for this device's clock skew. */
  now(): number {
    return Date.now() + this.offsetMs;
  }

  connect(): void {
    if (this.disposed || this.fatal) return;
    this.handlers.onStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}/ws?code=${encodeURIComponent(this.code)}`);
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.attempt = 0;
      this.handlers.onStatus('open');
      this.handshake();
      this.startHeartbeat();
    });

    ws.addEventListener('message', (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      this.absorb(message);
      this.handlers.onMessage(message);
    });

    ws.addEventListener('close', (event) => {
      this.stopHeartbeat();
      if (this.disposed) return;
      if (FATAL_CLOSE_CODES.has(event.code)) {
        this.fatal = true;
        this.handlers.onStatus('closed');
        return;
      }
      this.scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      // 'close' always follows; reconnect is handled there so it happens once.
    });
  }

  /**
   * First message on a fresh socket. A stored session for this room is replayed as a
   * `reconnect`; otherwise this is a create or a join.
   */
  private handshake(): void {
    const stored = loadSession();
    if (stored !== null && stored.roomCode === this.code) {
      this.send({
        t: 'reconnect',
        protocolVersion: PROTOCOL_VERSION,
        roomCode: stored.roomCode,
        playerId: stored.playerId,
        token: stored.token,
      });
      return;
    }
    this.send(
      this.intent === 'create' || this.code === NEW_ROOM_SENTINEL
        ? { t: 'create_room', protocolVersion: PROTOCOL_VERSION }
        : { t: 'join_room', protocolVersion: PROTOCOL_VERSION, code: this.code },
    );
  }

  /** Pull the clock offset and the session token out of the messages that carry them. */
  private absorb(message: ServerMessage): void {
    if (message.t === 'hello') {
      // A single sample, but taken at handshake time when there is no queueing.
      this.offsetMs = message.serverTime - Date.now();
      saveSession({
        roomCode: message.roomCode,
        playerId: message.playerId,
        token: message.token,
      });
      return;
    }

    if (message.t === 'pong') {
      const roundTrip = Date.now() - message.sentAt;
      // Keep the offset from the *fastest* exchange seen: a slow round trip carries
      // more queueing error, so a later, worse sample must not overwrite a good one.
      if (roundTrip <= this.bestRoundTrip) {
        this.bestRoundTrip = roundTrip;
        this.offsetMs = message.serverTime + roundTrip / 2 - Date.now();
      }
      return;
    }

    if (message.t === 'error' && message.fatal) {
      // A refused session must not be retried in a loop with the same bad token.
      if (message.code === 'SESSION_NOT_RESTORED' || message.code === 'KICKED') clearSession();
      this.fatal = true;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => {
      this.send({ t: 'ping', sentAt: Date.now() });
    }, PING_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat !== null) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private scheduleReconnect(): void {
    this.handlers.onStatus('reconnecting');
    const base = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)] ?? 8000;
    // Jitter stops a whole room reconnecting in lockstep after a wifi blip.
    const delay = base + Math.random() * base * 0.4;
    this.attempt += 1;
    if (this.retry !== null) clearTimeout(this.retry);
    this.retry = setTimeout(() => this.connect(), delay);
  }

  send(message: ClientMessage): boolean {
    if (this.ws === null || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(message));
    return true;
  }

  close(): void {
    this.disposed = true;
    this.stopHeartbeat();
    if (this.retry !== null) clearTimeout(this.retry);
    this.ws?.close();
    this.ws = null;
  }
}

/** Ask the server whether a room exists before opening a socket to it. */
export async function lookupRoom(code: string): Promise<{
  exists: boolean;
  started: boolean;
  full: boolean;
  players: number;
}> {
  try {
    const response = await fetch(`/api/rooms/${encodeURIComponent(code)}`);
    if (!response.ok) return { exists: false, started: false, full: false, players: 0 };
    return (await response.json()) as { exists: boolean; started: boolean; full: boolean; players: number };
  } catch {
    return { exists: false, started: false, full: false, players: 0 };
  }
}
