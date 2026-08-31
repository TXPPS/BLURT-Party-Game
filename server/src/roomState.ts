/**
 * BLURT — room state helpers.
 *
 * Construction, player lookup, eligibility, host authority and timers. Everything
 * here is a pure function of the state object plus `now`, which keeps the Durable
 * Object itself concerned only with sockets, storage and alarms.
 */

import {
  DISCONNECT_GRACE_MS,
  HOST_MIGRATION_DELAY_MS,
  MIN_PLAYERS,
  ROOM_IDLE_EXPIRY_MS,
  ROOM_MAX_LIFETIME_MS,
  ROUNDS_DEFAULT,
} from '../../shared/constants.js';
import { emptyStats, type GameSettings, type PublicPlayer } from '../../shared/types.js';
import type { MatchmakingPlayer } from '../../shared/matchmaking.js';
import { newPlayerId, newToken } from './ids.js';
import { ROOM_STATE_VERSION, type RoomState, type ServerPlayer, type TimerId } from './types.js';

export function defaultSettings(): GameSettings {
  return { mode: 'classic', rounds: ROUNDS_DEFAULT, timerSpeed: 'normal', drawingFinale: true };
}

export function createRoomState(code: string, now: number): RoomState {
  return {
    version: ROOM_STATE_VERSION,
    code,
    createdAt: now,
    phase: 'LOBBY',
    settings: defaultSettings(),
    hostId: null,
    hostMissingSince: null,
    players: [],
    timers: { roomExpiry: now + ROOM_MAX_LIFETIME_MS, idleExpiry: now + ROOM_IDLE_EXPIRY_MS },
    match: null,
    recentStoryIds: [],
    seq: 0,
    phaseDurationMs: 0,
    closed: false,
  };
}

export function nextSeq(state: RoomState): number {
  state.seq += 1;
  return state.seq;
}

/* ------------------------------------------------------------------ *
 * Players
 * ------------------------------------------------------------------ */

export function createPlayer(now: number, isHost: boolean): ServerPlayer {
  return {
    id: newPlayerId(),
    token: newToken(),
    name: '',
    avatarId: '',
    isHost,
    ready: false,
    connected: true,
    identified: false,
    disconnectedAt: null,
    joinedAt: now,
    score: 0,
    stats: emptyStats(),
    adultAcknowledged: false,
    kicked: false,
    departed: false,
  };
}

export function findPlayer(state: RoomState, playerId: string): ServerPlayer | undefined {
  return state.players.find((p) => p.id === playerId);
}

/**
 * Eligible to compete and to vote: named, holding a seat, and either connected or
 * still inside their disconnect grace window. A player who vanished mid-match keeps
 * playing for 90 seconds so a lift ride does not cost them the round.
 */
export function isEligible(player: ServerPlayer, now: number): boolean {
  if (player.kicked || player.departed || !player.identified) return false;
  if (player.connected) return true;
  return player.disconnectedAt !== null && now - player.disconnectedAt < DISCONNECT_GRACE_MS;
}

export function eligiblePlayers(state: RoomState, now: number): ServerPlayer[] {
  return state.players.filter((p) => isEligible(p, now));
}

export function connectedPlayers(state: RoomState): ServerPlayer[] {
  return state.players.filter((p) => p.connected && !p.kicked);
}

/** Projection for matchmaking, which only needs appearance bookkeeping. */
export function matchmakingView(state: RoomState, now: number): MatchmakingPlayer[] {
  const lastAppearance = new Map<string, number>();
  for (const matchup of state.match?.matchups ?? []) {
    for (const id of matchup.competitorIds) lastAppearance.set(id, matchup.index);
  }
  return state.players.map((player) => ({
    id: player.id,
    appearances: player.stats.appearances,
    lastAppearanceRound: lastAppearance.get(player.id) ?? -1,
    eligible: isEligible(player, now),
  }));
}

export function toPublicPlayer(player: ServerPlayer, now: number): PublicPlayer {
  const reconnectingUntil =
    !player.connected && player.disconnectedAt !== null && !player.departed
      ? player.disconnectedAt + DISCONNECT_GRACE_MS
      : null;
  return {
    id: player.id,
    name: player.name,
    avatarId: player.avatarId,
    isHost: player.isHost,
    ready: player.ready,
    connected: player.connected,
    reconnectingUntil: reconnectingUntil !== null && reconnectingUntil > now ? reconnectingUntil : null,
    identified: player.identified,
    score: player.score,
    stats: player.stats,
  };
}

/* ------------------------------------------------------------------ *
 * Host authority
 * ------------------------------------------------------------------ */

export function hostPlayer(state: RoomState): ServerPlayer | undefined {
  return state.hostId === null ? undefined : findPlayer(state, state.hostId);
}

export function isHost(state: RoomState, playerId: string): boolean {
  return state.hostId === playerId;
}

/**
 * Choose a new host: the longest-connected active player. Never returns a kicked,
 * departed or disconnected player, because a room whose host is absent is exactly
 * the situation this exists to fix.
 */
export function pickNewHost(state: RoomState): ServerPlayer | undefined {
  return connectedPlayers(state)
    .filter((p) => p.identified && !p.departed)
    .sort((a, b) => a.joinedAt - b.joinedAt)[0];
}

export function assignHost(state: RoomState, playerId: string | null): void {
  state.hostId = playerId;
  state.hostMissingSince = null;
  delete state.timers.hostMigration;
  for (const player of state.players) player.isHost = player.id === playerId;
}

/* ------------------------------------------------------------------ *
 * Starting a match
 * ------------------------------------------------------------------ */

export interface StartBlock {
  canStart: boolean;
  reason: string | null;
}

/** Why START is disabled, phrased so a player can act on it. */
export function startBlock(state: RoomState, now: number): StartBlock {
  const named = eligiblePlayers(state, now);
  if (named.length < MIN_PLAYERS) {
    const missing = MIN_PLAYERS - named.length;
    return {
      canStart: false,
      reason: `Need ${missing} more player${missing === 1 ? '' : 's'} — share the code.`,
    };
  }
  // The host is implicitly ready: pressing START *is* their readiness, and there is
  // deliberately no READY button on the host's own controls.
  const unready = named.filter((p) => !p.ready && p.id !== state.hostId);
  if (unready.length > 0) {
    const names = unready.map((p) => p.name).slice(0, 3).join(', ');
    return {
      canStart: false,
      reason:
        unready.length === 1
          ? `Waiting for ${names} to tap READY.`
          : `Waiting for ${unready.length} players to tap READY (${names}${unready.length > 3 ? '…' : ''}).`,
    };
  }
  return { canStart: true, reason: null };
}

/* ------------------------------------------------------------------ *
 * Timers
 * ------------------------------------------------------------------ */

export function setTimer(state: RoomState, id: TimerId, at: number): void {
  state.timers[id] = at;
}

export function clearTimer(state: RoomState, id: TimerId): void {
  delete state.timers[id];
}

export function setPhaseDeadline(state: RoomState, now: number, durationMs: number): void {
  state.phaseDurationMs = durationMs;
  setTimer(state, 'phase', now + durationMs);
}

/**
 * Bring a phase deadline forward, never push it back.
 *
 * `phaseDurationMs` is adjusted to match so the client's countdown ring stays
 * proportional instead of jumping.
 */
export function shortenPhaseDeadline(state: RoomState, now: number, withinMs: number): void {
  const current = state.timers.phase;
  const target = now + withinMs;
  if (current === undefined || target >= current) return;
  state.timers.phase = target;
  state.phaseDurationMs = Math.max(1, withinMs);
}

/** The earliest pending deadline, which is what the Durable Object alarm is set to. */
export function nextAlarmAt(state: RoomState): number | null {
  const values = Object.values(state.timers).filter((v): v is number => typeof v === 'number');
  return values.length === 0 ? null : Math.min(...values);
}

/**
 * Recompute the derived timers. Called after anything that changes who is present:
 * the grace sweep, the host-migration countdown, and the idle-expiry clock.
 */
export function refreshDerivedTimers(state: RoomState, now: number): void {
  const graceDeadlines = state.players
    .filter((p) => !p.connected && !p.kicked && !p.departed && p.disconnectedAt !== null)
    .map((p) => (p.disconnectedAt as number) + DISCONNECT_GRACE_MS);
  if (graceDeadlines.length > 0) setTimer(state, 'grace', Math.min(...graceDeadlines));
  else clearTimer(state, 'grace');

  const host = hostPlayer(state);
  const hostMissing = host === undefined || !host.connected;
  if (hostMissing && connectedPlayers(state).length > 0) {
    state.hostMissingSince ??= now;
    setTimer(state, 'hostMigration', state.hostMissingSince + HOST_MIGRATION_DELAY_MS);
  } else {
    state.hostMissingSince = null;
    clearTimer(state, 'hostMigration');
  }

  if (connectedPlayers(state).length === 0) setTimer(state, 'idleExpiry', now + ROOM_IDLE_EXPIRY_MS);
  else clearTimer(state, 'idleExpiry');
}

/** Epoch ms at which the room stops existing no matter what. */
export function roomExpiresAt(state: RoomState): number {
  return state.timers.roomExpiry ?? state.createdAt + ROOM_MAX_LIFETIME_MS;
}
