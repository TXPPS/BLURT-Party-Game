/**
 * BLURT — pacing telemetry.
 *
 * One line per phase entry and one per phase exit, written to `console` and nowhere
 * else. The point is to be able to read a real match's rhythm out of `wrangler tail`
 * afterwards: which phases ran to the buzzer, which ended early because everybody had
 * answered, and how many people were actually in a position to act at the time.
 *
 * Three rules this file holds to:
 *
 *   1. **Nothing is persisted.** No storage write, no state field. The only memory is
 *      one timestamp held on the Durable Object instance, and if hibernation loses it
 *      the log says `after=?` rather than printing a number it cannot stand behind.
 *   2. **No player content, ever.** No answer, guess, decoy, name or player id. Counts
 *      and phase names only — this is safe to leave on in production and safe to paste
 *      into a bug report.
 *   3. **One line, greppable.** `wrangler tail | grep '[blurt]'` is the whole tooling
 *      story. Fields are `key=value` so the line stays readable when a field is added.
 */

import type { Phase } from '../../shared/types.js';
import { connectedPlayers, eligiblePlayers } from './roomState.js';
import type { RoomState } from './types.js';

/**
 * Why a phase ended. Threaded from the call site rather than inferred: an exit reason
 * that is guessed from state is worse than no exit reason at all, because it reads
 * exactly as authoritative as a real one.
 */
export type PhaseExitReason =
  /** Everyone who could act, did. */
  | 'all-submitted'
  /** The phase deadline fired. */
  | 'timeout'
  /** The host pressed continue. */
  | 'host'
  /** Somebody leaving was the last thing the phase was waiting for. */
  | 'presence'
  /** The phase was already satisfied when entered — nobody was eligible to act. */
  | 'auto'
  /** The room ran out of players mid-match and fell back to the lobby. */
  | 'reset';

const PREFIX = '[blurt]';

function counts(room: RoomState, now: number): string {
  const eligible = eligiblePlayers(room, now).length;
  const connected = connectedPlayers(room).length;
  const seated = room.players.filter((p) => !p.kicked && p.identified).length;
  return `eligible=${eligible} connected=${connected} seated=${seated}`;
}

function round(room: RoomState): string {
  const match = room.match;
  if (match === null) return 'round=-';
  return `round=${match.matchupIndex + 1}/${match.plan.length}`;
}

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** A phase has just begun. */
export function logPhaseEnter(room: RoomState, phase: Phase, now: number): void {
  const deadline = room.timers.phase;
  const budget = deadline === undefined ? 'budget=none' : `budget=${seconds(deadline - now)}`;
  console.log(`${PREFIX} ${room.code} enter ${phase} ${round(room)} ${counts(room, now)} ${budget}`);
}

/**
 * A phase has just ended.
 *
 * `enteredAt` is the in-memory timestamp from the room; `null` means the object
 * hibernated since the phase began and the real duration is unknown.
 */
export function logPhaseExit(
  room: RoomState,
  phase: Phase,
  reason: PhaseExitReason,
  now: number,
  enteredAt: number | null,
): void {
  const elapsed = enteredAt === null ? 'after=?' : `after=${seconds(now - enteredAt)}`;
  console.log(
    `${PREFIX} ${room.code} exit  ${phase} reason=${reason} ${elapsed} ${round(room)} ${counts(room, now)}`,
  );
}

/** A match has ended. One summary line so a tail shows the shape without arithmetic. */
export function logMatchEnd(room: RoomState, now: number): void {
  const match = room.match;
  if (match === null) return;
  console.log(
    `${PREFIX} ${room.code} match-end rounds=${match.plan.length} ` +
      `drawings=${match.drawings.length} wall=${seconds(now - match.startedAt)} ${counts(room, now)}`,
  );
}
