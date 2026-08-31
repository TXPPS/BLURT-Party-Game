/**
 * BLURT — room upkeep.
 *
 * These two rules decide whether an abandoned room recovers or hangs, and until they
 * were lifted out of the Durable Object the only way to exercise them was to run a
 * real match against a real worker and wait ninety seconds. Both of the bugs they
 * cover (a room stuck in ROUND_VOTE after the host left; an alarm spinning hot
 * because host migration left a deadline in the past) were found that slow way.
 */

import { describe, expect, it } from 'vitest';
import { DISCONNECT_GRACE_MS, MIN_PLAYERS } from '../shared/constants.js';
import type { Phase } from '../shared/types.js';
import { createPlayer, createRoomState } from '../server/src/roomState.js';
import { migrateHost, sweepGrace, type UpkeepPorts } from '../server/src/roomUpkeep.js';
import type { RoomState } from '../server/src/types.js';

const NOW = 1_700_000_000_000;

interface Recorder extends UpkeepPorts {
  toasts: { kind: string; message: string }[];
  transitions: Phase[];
}

function recorder(): Recorder {
  const toasts: { kind: string; message: string }[] = [];
  const transitions: Phase[] = [];
  return {
    toasts,
    transitions,
    toast: (kind, message) => toasts.push({ kind, message }),
    goTo: (_now, phase) => transitions.push(phase),
  };
}

/** A room with `count` named players, the first of them host. */
function room(count: number, phase: Phase = 'LOBBY'): RoomState {
  const state = createRoomState('TEST', NOW);
  for (let i = 0; i < count; i += 1) {
    const player = createPlayer(NOW, i === 0);
    player.name = `P${i}`;
    player.identified = true;
    state.players.push(player);
  }
  state.hostId = state.players[0]?.id ?? null;
  state.phase = phase;
  return state;
}

/** Disconnect a player `agoMs` ago. */
function drop(state: RoomState, index: number, agoMs: number): void {
  const player = state.players[index];
  if (player === undefined) throw new Error('no such player');
  player.connected = false;
  player.disconnectedAt = NOW - agoMs;
}

describe('sweepGrace', () => {
  it('leaves a player inside the grace window alone', () => {
    const state = room(4, 'ROUND_VOTE');
    drop(state, 1, DISCONNECT_GRACE_MS - 1);
    const ports = recorder();

    expect(sweepGrace(state, NOW, ports)).toBe(false);
    expect(state.players[1]?.departed).toBe(false);
    expect(ports.toasts).toHaveLength(0);
  });

  it('departs a player whose window has lapsed, and says so once', () => {
    const state = room(4, 'ROUND_VOTE');
    drop(state, 1, DISCONNECT_GRACE_MS);
    const ports = recorder();

    expect(sweepGrace(state, NOW, ports)).toBe(true);
    expect(state.players[1]?.departed).toBe(true);
    expect(state.players[1]?.ready).toBe(false);
    expect(ports.toasts).toEqual([{ kind: 'bad', message: 'P1 left.' }]);
    // Four players minus one is still a game.
    expect(ports.transitions).toEqual([]);
  });

  it('is idempotent — a second sweep reports no change', () => {
    const state = room(4, 'ROUND_VOTE');
    drop(state, 1, DISCONNECT_GRACE_MS);
    sweepGrace(state, NOW, recorder());

    const second = recorder();
    expect(sweepGrace(state, NOW, second)).toBe(false);
    expect(second.toasts).toHaveLength(0);
  });

  it('falls back to the lobby once too few players remain', () => {
    const state = room(3, 'ROUND_VOTE');
    drop(state, 1, DISCONNECT_GRACE_MS);
    drop(state, 2, DISCONNECT_GRACE_MS);
    const ports = recorder();

    expect(sweepGrace(state, NOW, ports)).toBe(true);
    expect(ports.transitions).toEqual(['LOBBY']);
    expect(ports.toasts.at(-1)?.message).toMatch(/back to the lobby/i);
  });

  it('never drags a lobby back to the lobby', () => {
    const state = room(3, 'LOBBY');
    drop(state, 1, DISCONNECT_GRACE_MS);
    drop(state, 2, DISCONNECT_GRACE_MS);
    const ports = recorder();

    expect(sweepGrace(state, NOW, ports)).toBe(true);
    expect(ports.transitions).toEqual([]);
  });

  it('ignores players who never named themselves and players already gone', () => {
    const state = room(4, 'ROUND_VOTE');
    const ghost = createPlayer(NOW, false);
    ghost.connected = false;
    ghost.disconnectedAt = NOW - DISCONNECT_GRACE_MS;
    state.players.push(ghost);           // identified === false
    const already = state.players[1];
    if (already !== undefined) {
      already.departed = true;
      already.connected = false;
      already.disconnectedAt = NOW - DISCONNECT_GRACE_MS;
    }
    const ports = recorder();

    // The unnamed ghost still departs (it holds a seat), but the player already
    // marked departed must not produce a second "left" notice.
    sweepGrace(state, NOW, ports);
    expect(ports.toasts.filter((t) => t.message === 'P1 left.')).toHaveLength(0);
  });

  it('MIN_PLAYERS is the threshold it actually uses', () => {
    const state = room(MIN_PLAYERS + 1, 'ROUND_PROMPT');
    drop(state, MIN_PLAYERS, DISCONNECT_GRACE_MS);
    const ports = recorder();
    sweepGrace(state, NOW, ports);
    // Exactly MIN_PLAYERS remain, so the match continues.
    expect(ports.transitions).toEqual([]);
  });
});

describe('migrateHost', () => {
  it('promotes a present player and announces it', () => {
    const state = room(3);
    const ports = recorder();
    state.hostId = null;

    expect(migrateHost(state, NOW, ports)).toBe(true);
    expect(state.hostId).not.toBeNull();
    expect(ports.toasts).toHaveLength(1);
    expect(ports.toasts[0]?.kind).toBe('host');
  });

  it('pushes the retry forward when nobody is promotable', () => {
    // Everybody still here is on the name screen, so there is no successor.
    const state = createRoomState('TEST', NOW);
    const stranger = createPlayer(NOW, false);
    state.players.push(stranger);
    state.hostId = null;
    state.hostMissingSince = NOW - 60_000;
    const ports = recorder();

    expect(migrateHost(state, NOW, ports)).toBe(true);
    // The deadline must move to *now*, never stay in the past — a past deadline gets
    // re-armed at the same instant and spins the alarm hot.
    expect(state.hostMissingSince).toBe(NOW);
    expect(ports.toasts).toHaveLength(0);
  });
});
