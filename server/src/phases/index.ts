/**
 * BLURT — the phase registry.
 *
 * The Durable Object never special-cases a phase. It looks the handler up here and
 * calls `onEnter` / `onTimeout` / `isComplete`, which is what keeps the FSM honest:
 * adding a phase means adding a handler and an edge, not editing a switch statement
 * buried in the socket code.
 *
 * The second export, `ALLOWED_PHASES`, is the other half of the guarantee — the set
 * of phases in which each client message even makes sense. A message outside its
 * phase is rejected with an error and cannot mutate anything.
 */

import { clearTimer } from '../roomState.js';
import type { Phase } from '../../../shared/types.js';
import type { ClientMessageType } from '../../../shared/protocol.js';
import type { PhaseHandler } from '../types.js';
import { gameSetup, lobby } from './lobby.js';
import { roundPrompt, roundReveal, roundResults, roundVote, roundWaiting } from './rounds.js';
import { finalStory, storyUpdate } from './story.js';
import {
  drawingActive,
  drawingGuess,
  drawingResults,
  drawingSetup,
  drawingVote,
} from './drawing.js';

/** Terminal phase: the match is over and the room is waiting on the host. */
const finalResults: PhaseHandler = {
  onEnter(ctx) {
    clearTimer(ctx.state, 'phase');
    ctx.state.phaseDurationMs = 0;
    ctx.effects.sfx('final_fanfare');
  },
  isComplete() {
    return false;
  },
  onTimeout() {
    // No deadline — the room decides when it is done looking at the scores.
  },
  hostCanAdvance: false,
};

/**
 * The screens players sit and watch rather than act on.
 *
 * These are the phases where a room can genuinely be finished before the clock is:
 * everybody has read the reveal, or seen the scores, and is waiting on a timer for no
 * reason. Both the host's force-advance and the per-player READY apply here and
 * nowhere else — you cannot "be ready" during a phase whose whole point is that you
 * are still writing something.
 */
export const SKIPPABLE_PHASES = [
  'ROUND_REVEAL',
  'ROUND_RESULTS',
  'STORY_UPDATE',
  'FINAL_STORY',
  'DRAWING_RESULTS',
] as const satisfies readonly Phase[];

export const PHASE_HANDLERS: Readonly<Record<Phase, PhaseHandler>> = {
  LOBBY: lobby,
  GAME_SETUP: gameSetup,
  ROUND_PROMPT: roundPrompt,
  ROUND_WAITING: roundWaiting,
  ROUND_REVEAL: roundReveal,
  ROUND_VOTE: roundVote,
  ROUND_RESULTS: roundResults,
  STORY_UPDATE: storyUpdate,
  FINAL_STORY: finalStory,
  DRAWING_SETUP: drawingSetup,
  DRAWING_ACTIVE: drawingActive,
  DRAWING_GUESS: drawingGuess,
  DRAWING_VOTE: drawingVote,
  DRAWING_RESULTS: drawingResults,
  FINAL_RESULTS: finalResults,
};

/**
 * Which phases each message is legal in. `'any'` means the message is about the
 * connection rather than the game.
 *
 * Note what is *not* here: `identify` is legal only in the lobby, so a player cannot
 * change their name mid-vote to confuse a reveal; `update_settings` is lobby-only,
 * so the host cannot change the round count halfway through a match.
 */
export const ALLOWED_PHASES: Readonly<Record<ClientMessageType, readonly Phase[] | 'any'>> = {
  create_room: 'any',
  join_room: 'any',
  reconnect: 'any',
  ping: 'any',
  acknowledge_adult: 'any',

  identify: ['LOBBY'],
  set_ready: ['LOBBY'],
  update_settings: ['LOBBY'],
  kick_player: ['LOBBY'],
  start_game: ['LOBBY'],

  submit_answer: ['ROUND_PROMPT'],
  submit_vote: ['ROUND_VOTE'],

  submit_drawing: ['DRAWING_SETUP', 'DRAWING_ACTIVE'],
  submit_drawing_guess: ['DRAWING_GUESS'],
  submit_drawing_vote: ['DRAWING_VOTE'],

  // Host-gated screens. Every one of them also auto-advances on its own deadline.
  advance: SKIPPABLE_PHASES,
  // The same screens, from the other direction: anybody can say they are done, and
  // the phase ends early once everybody has.
  advance_ready: SKIPPABLE_PHASES,

  play_again: ['FINAL_RESULTS'],
  return_to_lobby: ['FINAL_RESULTS', 'FINAL_STORY', 'DRAWING_RESULTS'],
};

/** Messages only the host may send. Verified against the server's own host id. */
export const HOST_ONLY: ReadonlySet<ClientMessageType> = new Set<ClientMessageType>([
  'update_settings',
  'kick_player',
  'start_game',
  'advance',
  'play_again',
  'return_to_lobby',
]);

export function isMessageAllowedInPhase(type: ClientMessageType, phase: Phase): boolean {
  const allowed = ALLOWED_PHASES[type];
  return allowed === 'any' || allowed.includes(phase);
}
