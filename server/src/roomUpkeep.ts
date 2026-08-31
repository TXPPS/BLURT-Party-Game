/**
 * BLURT — the two pieces of room upkeep that decide something.
 *
 * `sweepGrace` and `migrateHost` used to be private methods on the Durable Object,
 * which meant the only way to test "does a room with two departed players fall back to
 * the lobby?" was to run a real match against a real worker. They are the rules most
 * likely to be got wrong and the hardest to reach from the outside, so they live here
 * instead, over a `RoomState` and a two-method port.
 *
 * Neither function touches storage, sockets or timers. The caller owns all of that:
 * these return whether anything changed, and the room marks itself dirty.
 */

import { DISCONNECT_GRACE_MS, MIN_PLAYERS } from '../../shared/constants.js';
import type { Phase } from '../../shared/types.js';
import { resetForNewMatch } from './match.js';
import { assignHost, eligiblePlayers, pickNewHost } from './roomState.js';
import type { RoomState } from './types.js';

/** What upkeep needs from the room beyond the state itself. */
export interface UpkeepPorts {
  /** Queue a room-wide notice. Delivered on the next broadcast. */
  toast(kind: 'info' | 'good' | 'bad' | 'host', message: string): void;
  /** Drive the phase machine, so a swept room can fall back to the lobby. */
  goTo(now: number, phase: Phase): void;
}

/**
 * Players whose grace window lapsed stay on the scoreboard but stop being dealt in.
 *
 * A match that has run out of people returns to the lobby rather than limping on with
 * a single player winning every round unopposed.
 *
 * @returns true if any player's state changed.
 */
export function sweepGrace(room: RoomState, now: number, ports: UpkeepPorts): boolean {
  let changed = false;

  for (const player of room.players) {
    if (player.connected || player.departed || player.kicked) continue;
    if (player.disconnectedAt === null) continue;
    if (now - player.disconnectedAt < DISCONNECT_GRACE_MS) continue;
    player.departed = true;
    player.ready = false;
    changed = true;
    ports.toast('bad', `${player.name || 'Someone'} left.`);
  }

  if (!changed) return false;

  if (room.phase !== 'LOBBY' && eligiblePlayers(room, now).length < MIN_PLAYERS) {
    ports.toast('bad', 'Not enough players left. Back to the lobby.');
    resetForNewMatch(room);
    ports.goTo(now, 'LOBBY');
  }
  return true;
}

/**
 * Never let a room become unrecoverable: authority moves to whoever is present.
 *
 * @returns true if the room changed — either a new host, or the retry pushed forward.
 */
export function migrateHost(room: RoomState, now: number, ports: Pick<UpkeepPorts, 'toast'>): boolean {
  const successor = pickNewHost(room);
  if (successor === undefined) {
    // Nobody is promotable yet — everyone still here is on the name screen. Push the
    // retry out a full interval instead of leaving a deadline in the past, which
    // `refreshDerivedTimers` would re-arm at the same instant and spin the alarm hot.
    room.hostMissingSince = now;
    return true;
  }
  assignHost(room, successor.id);
  ports.toast('host', `${successor.name} is now the host.`);
  return true;
}
