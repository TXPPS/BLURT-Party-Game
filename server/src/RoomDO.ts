/**
 * BLURT — the room.
 *
 * One Durable Object per room code. Because a Durable Object is single-threaded and
 * handles its messages serially, "two people voted at the same time" is not a race
 * this code has to think about — it is two sequential calls into the same object.
 *
 * WebSocket hibernation is used, so the object may be evicted while sockets stay
 * open. Everything authoritative is therefore persisted to storage on every
 * mutation, and the socket→player mapping rides along in each socket's attachment.
 */

import {
  MAX_PLAYERS,
  BROADCAST_COALESCE_MS,
  HANDSHAKE_TIMEOUT_MS,
  MAX_CONNECTIONS_PER_ROOM,
  PROTOCOL_VERSION,
} from '../../shared/constants.js';
import type { ClientMessage, ErrorCode, ServerMessage } from '../../shared/protocol.js';
import { ERROR_COPY } from '../../shared/protocol.js';
import { isLegalTransition, type Phase } from '../../shared/types.js';
import { dispatch } from './dispatch.js';
import { DrawingStore } from './drawingStore.js';
import { handleMessage, type HandlerContext } from './handlers.js';
import { safeEqual } from './ids.js';
import { HOST_ONLY, PHASE_HANDLERS, isMessageAllowedInPhase } from './phases/index.js';
import { RateLimiter } from './rateLimit.js';
import {
  logMatchEnd,
  logPhaseEnter,
  logPhaseExit,
  type PhaseExitReason,
} from './pacingLog.js';
import { addBots, autoplayBots, QA_PHASES, removeBots } from './qa.js';
import { migrateHost, sweepGrace, type UpkeepPorts } from './roomUpkeep.js';
import {
  conflictResponse,
  drawingResponse,
  notFoundResponse,
  probeResponse,
} from './roomHttp.js';
import { drawingUrl, joinUrl, messagesFor, sharedState } from './roomWire.js';
import {
  assignHost,
  clearTimer,
  connectedPlayers,
  createPlayer,
  createRoomState,
  findPlayer,
  hostPlayer,
  nextAlarmAt,
  refreshDerivedTimers,
} from './roomState.js';
import type { PhaseEffects, RoomState } from './types.js';

const STORAGE_KEY = 'room';
/** Guard against a phase graph that somehow loops without consuming time. */
const MAX_TRANSITIONS_PER_EVENT = 24;

interface SocketMeta {
  playerId: string | null;
  /** When the socket was accepted, so one that never handshakes can be reclaimed. */
  openedAt?: number;
}

export interface Env {
  ROOMS: DurableObjectNamespace;
  /**
   * Secret that unlocks the manual-QA routes. A Worker *secret*, never a var, so it
   * is not in the config file and not in the client bundle.
   *
   * Optional on purpose: when it is unset every QA route 404s and the feature does
   * not exist. That is the default, and the state of any deploy where nobody has
   * deliberately turned this on.
   */
  QA_TOKEN?: string;
}

export class RoomDO implements DurableObject {
  private room: RoomState | null = null;
  private readonly drawings: DrawingStore;
  private readonly limiter = new RateLimiter();

  /** Best-effort public origin, refreshed on every upgrade. Used for the join URL. */
  private origin = '';
  private dirty = false;
  private broadcastPending = false;
  /**
   * When the current phase began, for the pacing log only. In memory on purpose:
   * the log is diagnostic, and adding a field to persisted room state to serve it
   * would be the tail wagging the dog. Hibernation resets it to null and the log
   * prints `after=?` for that one transition.
   */
  private phaseEnteredAt: number | null = null;
  private queuedSfx: string[] = [];
  private queuedToasts: { kind: 'info' | 'good' | 'bad' | 'host'; message: string }[] = [];

  constructor(
    private readonly ctx: DurableObjectState,
    _env: Env,
  ) {
    this.drawings = new DrawingStore(ctx.storage);
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomState>(STORAGE_KEY)) ?? null;
      const count = this.room?.match?.drawings.length ?? 0;
      if (count > 0) await this.drawings.warm(count);
    });
  }

  /* ---------------------------------------------------------------- *
   * HTTP surface (internal — only the Worker calls these)
   * ---------------------------------------------------------------- */

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const now = Date.now();

    switch (url.pathname) {
      case '/probe':
        return probeResponse(this.liveRoom(), now);

      case '/claim': {
        if (this.liveRoom() !== null) return conflictResponse();
        const code = url.searchParams.get('code') ?? '';
        this.room = createRoomState(code, now);
        this.dirty = true;
        await this.flush();
        return Response.json({ ok: true, code });
      }

      // Drawings are served over HTTP rather than pushed through every broadcast.
      case '/drawing': {
        const index = Number(url.searchParams.get('index') ?? '-1');
        return drawingResponse(
          Number.isInteger(index) && index >= 0 ? this.drawings.toBytes(index) : null,
        );
      }

      case '/qa':
        return this.qa(url, now);

      case '/ws':
        return this.openSocket(request, url, now);

      default:
        return notFoundResponse();
    }
  }

  /**
   * The manual-QA surface. Only ever reached when the Worker has already checked the
   * secret — the DO is not publicly addressable, so this is the second gate, not the
   * first.
   */
  private async qa(url: URL, now: number): Promise<Response> {
    const room = this.liveRoom();
    if (room === null) return notFoundResponse();
    const action = url.searchParams.get('action') ?? '';

    switch (action) {
      case 'bots': {
        const count = Number(url.searchParams.get('count') ?? '3');
        const added = addBots(room, Number.isFinite(count) ? count : 3, now, MAX_PLAYERS);
        this.settlePhase(now);
        this.markDirty();
        await this.flush();
        return Response.json({ ok: true, added, players: room.players.length });
      }

      case 'clear-bots': {
        const removed = removeBots(room);
        this.settlePhase(now);
        this.markDirty();
        await this.flush();
        return Response.json({ ok: true, removed });
      }

      case 'phase': {
        const target = url.searchParams.get('to') ?? '';
        if (!(QA_PHASES as readonly string[]).includes(target)) {
          return Response.json({ ok: false, error: 'unknown phase' }, { status: 400 });
        }
        // Deliberately bypasses the legal-transition table: jumping is the entire
        // point, and refusing an "illegal" jump would make the tool useless for
        // reaching exactly the screens that are hard to reach.
        room.phase = target as Phase;
        room.readyToAdvance = [];
        clearTimer(room, 'phase');
        this.runTransitions(now, 'host', () => undefined);
        this.markDirty();
        await this.flush();
        return Response.json({ ok: true, phase: room.phase });
      }

      default:
        return Response.json({ ok: false, error: 'unknown action' }, { status: 400 });
    }
  }

  /** Upgrade to a WebSocket, if the room has room. */
  private openSocket(request: Request, url: URL, now: number): Response {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    // Reclaim squatters *before* counting, or somebody who knows the room code could
    // hold every slot open without ever identifying themselves.
    this.sweepUnboundSockets(now);

    // Ten players plus a couple of spare display sockets.
    if (this.ctx.getWebSockets().length >= MAX_CONNECTIONS_PER_ROOM) {
      return new Response('room is at its connection limit', { status: 503 });
    }
    this.origin = url.searchParams.get('origin') ?? this.origin;

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ playerId: null, openedAt: now } satisfies SocketMeta);
    return new Response(null, { status: 101, webSocket: client });
  }

  /* ---------------------------------------------------------------- *
   * WebSocket lifecycle
   * ---------------------------------------------------------------- */

  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const now = Date.now();
    const verdict = this.limiter.check(socket, now);
    if (verdict !== 'ok') {
      this.send(socket, { t: 'error', code: 'RATE_LIMITED', ...copy('RATE_LIMITED'), fatal: verdict === 'disconnect' });
      if (verdict === 'disconnect') this.closeSocket(socket, 'RATE_LIMITED');
      return;
    }

    dispatch(this, socket, raw, now);
    await this.flush();
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    this.onSocketGone(socket);
    await this.flush();
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    this.onSocketGone(socket);
    await this.flush();
  }

  private onSocketGone(socket: WebSocket): void {
    this.limiter.forget(socket);
    const room = this.room;
    const meta = this.metaOf(socket);
    if (room === null || meta.playerId === null) return;

    // Another live socket for the same player means this was a replaced tab.
    const stillConnected = this.socketsFor(meta.playerId).some((s) => s !== socket);
    if (stillConnected) return;

    const player = findPlayer(room, meta.playerId);
    if (player === undefined) return;
    const now = Date.now();
    player.connected = false;
    player.disconnectedAt = now;
    refreshDerivedTimers(room, now);
    this.dirty = true;
    // The person who just vanished may have been the last one the phase was
    // waiting on — check before making everybody else sit out the timer.
    this.settlePhase(now);
  }

  /* ---------------------------------------------------------------- *
   * Alarms — every server timer in the game
   * ---------------------------------------------------------------- */

  async alarm(): Promise<void> {
    const room = this.room;
    if (room === null) return;
    const now = Date.now();

    if ((room.timers.roomExpiry ?? Infinity) <= now || (room.timers.idleExpiry ?? Infinity) <= now) {
      await this.destroyRoom();
      return;
    }

    this.sweepUnboundSockets(now);
    if ((room.timers.grace ?? Infinity) <= now) this.sweepGrace(now);
    if ((room.timers.hostMigration ?? Infinity) <= now) this.migrateHost();

    if ((room.timers.phase ?? Infinity) <= now) {
      clearTimer(room, 'phase');
      this.runTransitions(now, 'timeout', (ctx) => PHASE_HANDLERS[room.phase].onTimeout(ctx));
    } else {
      // Someone may have just been swept out of the round the room was waiting on.
      this.settlePhase(now);
    }

    refreshDerivedTimers(room, now);
    this.dirty = true;
    await this.flush();
  }

  /**
   * Apply the grace sweep, then let the room settle. The rule itself lives in
   * `roomUpkeep.ts` so it can be tested without a running worker.
   */
  private sweepGrace(now: number): void {
    const room = this.room;
    if (room === null) return;
    if (sweepGrace(room, now, this.upkeepPorts())) this.dirty = true;
  }

  /**
   * Close any socket that has been open past the handshake window without binding to
   * a player. A real client sends create/join/reconnect the instant it opens.
   */
  private sweepUnboundSockets(now: number): void {
    for (const socket of this.ctx.getWebSockets()) {
      const meta = this.metaOf(socket);
      if (meta.playerId !== null) continue;
      if (now - (meta.openedAt ?? now) < HANDSHAKE_TIMEOUT_MS) continue;
      this.send(socket, {
        t: 'error',
        code: 'INVALID_MESSAGE',
        ...copy('INVALID_MESSAGE', 'Join a room before doing that.'),
        fatal: true,
      });
      this.closeSocket(socket, 'HANDSHAKE_TIMEOUT');
    }
  }

  /** Never let a room become unrecoverable: authority moves to whoever is present. */
  private migrateHost(): void {
    const room = this.room;
    if (room === null) return;
    if (migrateHost(room, Date.now(), this.upkeepPorts())) this.dirty = true;
  }

  /** The narrow surface `roomUpkeep` is allowed to reach back through. */
  private upkeepPorts(): UpkeepPorts {
    return {
      toast: (kind, message) => this.queuedToasts.push({ kind, message }),
      goTo: (now, phase) => this.runTransitions(now, 'reset', (ctx) => ctx.goTo(phase)),
    };
  }

  private async destroyRoom(): Promise<void> {
    const room = this.room;
    if (room !== null) room.closed = true;
    for (const socket of this.ctx.getWebSockets()) {
      this.send(socket, { t: 'error', code: 'ROOM_CLOSED', ...copy('ROOM_CLOSED'), fatal: true });
      try {
        socket.close(4004, 'room closed');
      } catch {
        // Already gone; nothing to do.
      }
    }
    this.room = null;
    this.dirty = false;
    await this.drawings.clear();
    await this.ctx.storage.deleteAll();
  }

  /* ---------------------------------------------------------------- *
   * Transitions
   * ---------------------------------------------------------------- */

  /**
   * Run a mutation and then settle the machine: apply the requested transition, call
   * `onEnter`, and keep going while the new phase reports itself already complete.
   * That is what lets a round with no eligible competitors fall straight through to
   * the next one instead of stalling on a deadline nobody will meet.
   */
  runTransitions(now: number, reason: PhaseExitReason, mutate: (ctx: PhaseControl) => void): void {
    const room = this.room;
    if (room === null) return;

    // A box rather than a bare local: handlers request transitions through the
    // closure, and TypeScript cannot follow a closure write on a plain variable.
    const box: { pending: Phase | null } = { pending: null };
    const control: PhaseControl = {
      state: room,
      now,
      effects: this.effects(),
      goTo: (phase) => {
        box.pending = phase;
      },
    };

    mutate(control);

    for (let step = 0; step < MAX_TRANSITIONS_PER_EVENT; step += 1) {
      const target = box.pending;
      if (target === null) break;
      box.pending = null;

      if (!isLegalTransition(room.phase, target)) {
        console.error(`[blurt] refused illegal transition ${room.phase} → ${target}`);
        break;
      }

      // Chained transitions inside one event are the machine falling through a phase
      // nobody was eligible to act in, not the original cause repeating.
      logPhaseExit(room, room.phase, step === 0 ? reason : 'auto', now, this.phaseEnteredAt);

      room.phase = target;
      // Readiness is per screen. Carrying it across would let a player who pressed
      // READY on the reveal silently skip the results as well.
      room.readyToAdvance = [];
      clearTimer(room, 'phase');
      PHASE_HANDLERS[target].onEnter(control);
      // QA stand-ins take their turn the moment the phase opens, so a room being
      // tested by one person advances on that person rather than on a deadline.
      autoplayBots(room, now);
      this.phaseEnteredAt = now;
      logPhaseEnter(room, target, now);
      if (target === 'FINAL_RESULTS') logMatchEnd(room, now);

      // A phase can *begin* already blocked on somebody who is offline — they left
      // during the previous phase, so no disconnect event will arrive to shorten it.
      PHASE_HANDLERS[target].onPresenceChange?.(control);

      // A phase that is already satisfied on entry falls straight through, which is
      // how a round with no eligible competitors skips instead of stalling.
      if (box.pending === null && PHASE_HANDLERS[target].isComplete(control)) {
        PHASE_HANDLERS[target].onTimeout(control);
      }
    }

    this.dirty = true;
  }

  /** The advance path a phase would take on its own deadline. */
  advanceCurrentPhase(now: number): void {
    const room = this.room;
    if (room === null) return;
    this.runTransitions(now, 'host', (ctx) => PHASE_HANDLERS[room.phase].onTimeout(ctx));
  }

  /**
   * Re-ask the current phase whether it is finished.
   *
   * Completion does not only change when a message arrives — it also changes when
   * *who is present* changes. A player leaving can be the last thing a phase was
   * waiting for, and without this the room would sit out the whole deadline waiting
   * for somebody who is not coming back.
   */
  settlePhase(now: number): void {
    const room = this.room;
    if (room === null) return;
    this.runTransitions(now, 'presence', (ctx) => {
      const handler = PHASE_HANDLERS[room.phase];
      handler.onPresenceChange?.(ctx);
      if (handler.isComplete(ctx)) handler.onTimeout(ctx);
    });
  }

  private effects(): PhaseEffects {
    return {
      sfx: (eventId) => this.queuedSfx.push(eventId),
      toast: (kind, message) => this.queuedToasts.push({ kind, message }),
    };
  }

  /* ---------------------------------------------------------------- *
   * Accessors used by the dispatcher
   * ---------------------------------------------------------------- */

  get state(): RoomState | null {
    return this.room;
  }

  liveRoom(): RoomState | null {
    return this.room !== null && !this.room.closed ? this.room : null;
  }

  metaOf(socket: WebSocket): SocketMeta {
    const raw = socket.deserializeAttachment() as SocketMeta | null;
    return raw ?? { playerId: null };
  }

  bindSocket(socket: WebSocket, playerId: string): void {
    socket.serializeAttachment({ playerId } satisfies SocketMeta);
  }

  socketsFor(playerId: string): WebSocket[] {
    return this.ctx
      .getWebSockets()
      .filter((socket) => this.metaOf(socket).playerId === playerId);
  }

  markDirty(): void {
    this.dirty = true;
  }

  createRoomIfMissing(code: string, now: number): RoomState {
    this.room ??= createRoomState(code, now);
    this.dirty = true;
    return this.room;
  }

  addPlayer(now: number): ReturnType<typeof createPlayer> {
    const room = this.room;
    if (room === null) throw new Error('no room');
    const player = createPlayer(now, room.hostId === null);
    room.players.push(player);
    this.dirty = true;
    return player;
  }

  handlerContext(player: ReturnType<typeof createPlayer>, now: number): HandlerContext {
    const room = this.room as RoomState;
    return {
      state: room,
      now,
      player,
      effects: this.effects(),
      goTo: (phase) => this.runTransitions(now, 'host', (ctx) => ctx.goTo(phase)),
      settlePhase: () => {
        this.runTransitions(now, 'all-submitted', (ctx) => {
          const handler = PHASE_HANDLERS[room.phase];
          handler.onPresenceChange?.(ctx);
          if (handler.isComplete(ctx)) handler.onTimeout(ctx);
        });
      },
      advancePhase: (reason = 'all-submitted') => {
        const handler = PHASE_HANDLERS[room.phase];
        this.runTransitions(now, reason, (ctx) => {
          // A submission can be what makes a phase "stuck on absent people only":
          // the last *online* competitor answering leaves nobody but a player who
          // has gone. Re-asking here is what stops the room sitting out the whole
          // 45-second answer timer for somebody who is not coming back.
          handler.onPresenceChange?.(ctx);
          if (handler.isComplete(ctx) || handler.hostCanAdvance === true) handler.onTimeout(ctx);
        });
      },
      fail: (code, message) => {
        for (const socket of this.socketsFor(player.id)) {
          this.send(socket, { t: 'error', code, ...copy(code, message), fatal: false });
        }
      },
      storeDrawing: (index, dataUrl) => {
        this.ctx.waitUntil(this.drawings.put(index, dataUrl));
      },
      clearDrawings: () => {
        // Otherwise a second match reuses drawing indices and the cache would hand
        // back the previous match's picture for an artist who has not submitted yet.
        this.ctx.waitUntil(this.drawings.clear());
      },
      evict: (playerId, code) => {
        for (const socket of this.socketsFor(playerId)) {
          this.send(socket, { t: 'error', code, ...copy(code), fatal: true });
          try {
            socket.close(4003, code);
          } catch {
            // Already gone.
          }
        }
      },
    };
  }

  applyMessage(player: ReturnType<typeof createPlayer>, message: ClientMessage, now: number): void {
    handleMessage(this.handlerContext(player, now), message);
    this.dirty = true;
  }

  /** True when this message type is legal right now, for this sender. */
  guard(message: ClientMessage, playerId: string): ErrorCode | null {
    const room = this.room;
    if (room === null) return 'ROOM_NOT_FOUND';
    if (!isMessageAllowedInPhase(message.t, room.phase)) return 'WRONG_PHASE';
    // Host authority is checked against the server's own record, never a client flag.
    if (HOST_ONLY.has(message.t) && room.hostId !== playerId) return 'NOT_HOST';
    return null;
  }

  /* ---------------------------------------------------------------- *
   * Sending
   * ---------------------------------------------------------------- */

  send(socket: WebSocket, message: ServerMessage): void {
    try {
      socket.send(JSON.stringify(message));
    } catch {
      // The socket died between selection and send; the close handler will tidy up.
    }
  }

  closeSocket(socket: WebSocket, reason: string): void {
    try {
      socket.close(4001, reason);
    } catch {
      // Already closed.
    }
  }

  /**
   * Push current state to every socket. Broadcasts are coalesced: ten players
   * submitting at once produce one broadcast, not ten.
   */
  broadcast(): void {
    const room = this.room;
    if (room === null) return;
    const now = Date.now();
    const shared = sharedState(room, now, (i) => drawingUrl(room, i), joinUrl(this.origin, room.code));

    for (const socket of this.ctx.getWebSockets()) {
      const meta = this.metaOf(socket);
      if (meta.playerId === null) continue;
      const player = findPlayer(room, meta.playerId);
      if (player === undefined) continue;
      for (const message of messagesFor(room, player, shared)) this.send(socket, message);
    }

    for (const eventId of this.queuedSfx) this.broadcastRaw({ t: 'sfx', eventId });
    for (const toast of this.queuedToasts) {
      this.broadcastRaw({ t: 'toast', kind: toast.kind, message: toast.message });
    }
    this.queuedSfx = [];
    this.queuedToasts = [];
  }

  private broadcastRaw(message: ServerMessage): void {
    for (const socket of this.ctx.getWebSockets()) {
      if (this.metaOf(socket).playerId === null) continue;
      this.send(socket, message);
    }
  }

  /* ---------------------------------------------------------------- *
   * Persistence
   * ---------------------------------------------------------------- */

  /**
   * Persist, reschedule the alarm, and broadcast. Called once at the end of every
   * event, which is what makes hibernation safe and keeps message volume flat.
   */
  async flush(): Promise<void> {
    const room = this.room;
    if (room === null) {
      if (this.dirty) {
        this.dirty = false;
        await this.ctx.storage.delete(STORAGE_KEY);
      }
      return;
    }
    if (!this.dirty) return;
    this.dirty = false;

    refreshDerivedTimers(room, Date.now());
    await this.ctx.storage.put(STORAGE_KEY, room);

    const next = nextAlarmAt(room);
    if (next !== null) await this.ctx.storage.setAlarm(next);

    if (this.broadcastPending) return;
    this.broadcastPending = true;
    this.ctx.waitUntil(
      new Promise<void>((resolve) => {
        setTimeout(() => {
          this.broadcastPending = false;
          this.broadcast();
          resolve();
        }, BROADCAST_COALESCE_MS);
      }),
    );
  }

  /* ---------------------------------------------------------------- *
   * Connection helpers used by the dispatcher
   * ---------------------------------------------------------------- */

  hello(socket: WebSocket, playerId: string, token: string, code: string): void {
    this.send(socket, {
      t: 'hello',
      playerId,
      token,
      protocolVersion: PROTOCOL_VERSION,
      roomCode: code,
      serverTime: Date.now(),
    });
  }

  /** Reconnect proves identity with the secret token, never with a name. */
  restoreSession(socket: WebSocket, playerId: string, token: string): boolean {
    const room = this.liveRoom();
    if (room === null) return false;
    const player = findPlayer(room, playerId);
    if (player === undefined || player.kicked) return false;
    if (!safeEqual(player.token, token)) return false;

    // The newest tab wins; an older socket for the same player is displaced.
    for (const other of this.socketsFor(playerId)) {
      if (other === socket) continue;
      this.send(other, { t: 'error', code: 'DUPLICATE_SESSION', ...copy('DUPLICATE_SESSION'), fatal: true });
      this.closeSocket(other, 'DUPLICATE_SESSION');
    }

    player.connected = true;
    player.disconnectedAt = null;
    player.departed = false;
    this.bindSocket(socket, playerId);

    // Coming back to an empty chair: if nobody took the host badge, take it back.
    if (room.hostId === null) assignHost(room, playerId);
    else if (hostPlayer(room) === undefined) assignHost(room, playerId);

    refreshDerivedTimers(room, Date.now());
    this.dirty = true;
    this.settlePhase(Date.now());
    return true;
  }

  connectedCount(): number {
    const room = this.room;
    return room === null ? 0 : connectedPlayers(room).length;
  }
}

/** A narrow control surface handed to phase handlers. */
export interface PhaseControl {
  state: RoomState;
  now: number;
  effects: PhaseEffects;
  goTo(phase: Phase): void;
}

function copy(code: ErrorCode, override?: string): { message: string } {
  const preset = ERROR_COPY[code];
  // The client renders the title from ERROR_COPY itself, so sending
  // "title. body" made every error screen say the same sentence twice.
  return { message: override ?? preset.body };
}
