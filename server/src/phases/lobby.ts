/**
 * BLURT — LOBBY and GAME_SETUP.
 *
 * The lobby has no deadline of its own; the room-lifetime and idle timers are the
 * only clocks running. GAME_SETUP is a short sealed-envelope beat between START and
 * the first prompt: the story has been chosen but its title is deliberately withheld
 * (see `views.ts`), because knowing the title spoils every disguised prompt.
 */

import { GAME_SETUP_MS } from '../../../shared/constants.js';
import { clearTimer, setPhaseDeadline } from '../roomState.js';
import type { PhaseHandler } from '../types.js';

export const lobby: PhaseHandler = {
  onEnter(ctx) {
    clearTimer(ctx.state, 'phase');
    ctx.state.phaseDurationMs = 0;
    for (const player of ctx.state.players) player.ready = false;
  },

  isComplete() {
    // The lobby only leaves when the host presses START.
    return false;
  },

  onTimeout() {
    // No deadline; nothing to do.
  },
};

export const gameSetup: PhaseHandler = {
  onEnter(ctx) {
    setPhaseDeadline(ctx.state, ctx.now, GAME_SETUP_MS);
    ctx.effects.sfx('game_start');
  },

  isComplete() {
    return false;
  },

  onTimeout(ctx) {
    ctx.goTo('ROUND_PROMPT');
  },
};
