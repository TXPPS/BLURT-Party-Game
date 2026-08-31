/**
 * BLURT — the standard round phases.
 *
 * PROMPT → WAITING → REVEAL → VOTE → RESULTS.
 *
 * Every one of these auto-advances. The host's ADVANCE button only ever *shortens*
 * a wait; a room whose host has wandered off still finishes the match.
 */

import {
  ABANDONED_PHASE_MS,
  REVEAL_HOLD_MS,
  ROUND_RESULTS_AUTO_MS,
  STORY_UPDATE_EVERY_N_ROUNDS,
  WAITING_BEAT_MS,
} from '../../../shared/constants.js';
import {
  advanceMatchupIndex,
  answerMs,
  beginMatchup,
  fillMissingAnswers,
  hasSubmitted,
  isLastMatchup,
  resolveCurrentMatchup,
  voteMs,
} from '../match.js';
import { findPlayer, isEligible, setPhaseDeadline, shortenPhaseDeadline } from '../roomState.js';
import type { PhaseContext, PhaseHandler } from '../types.js';

function matchupOf(ctx: PhaseContext) {
  const match = ctx.state.match;
  return match === null ? undefined : match.matchups[match.matchupIndex];
}

export const roundPrompt: PhaseHandler = {
  onEnter(ctx) {
    beginMatchup(ctx.state, ctx.now);
    setPhaseDeadline(ctx.state, ctx.now, answerMs(ctx.state));
    ctx.effects.sfx('prompt_in');
  },

  isComplete(ctx) {
    const matchup = matchupOf(ctx);
    if (matchup === undefined) return true;
    // Only players who could still act are required. A competitor who dropped mid
    // round is filled in by the house rather than holding the room hostage.
    const waitingOn = matchup.competitorIds.filter((id) => {
      const player = findPlayer(ctx.state, id);
      return player !== undefined && isEligible(player, ctx.now) && !hasSubmitted(matchup, id);
    });
    return waitingOn.length === 0;
  },

  onTimeout(ctx) {
    ctx.goTo('ROUND_WAITING');
  },

  /** Everyone still here has answered; only offline players are outstanding. */
  onPresenceChange(ctx) {
    const matchup = matchupOf(ctx);
    if (matchup === undefined) return;
    const outstanding = matchup.competitorIds.filter((id) => !hasSubmitted(matchup, id));
    if (outstanding.length === 0) return;
    const anyOnline = outstanding.some((id) => findPlayer(ctx.state, id)?.connected === true);
    if (!anyOnline) shortenPhaseDeadline(ctx.state, ctx.now, ABANDONED_PHASE_MS);
  },
};

export const roundWaiting: PhaseHandler = {
  onEnter(ctx) {
    // Everything missing is filled in here, once, so the reveal is always complete.
    fillMissingAnswers(ctx.state, ctx.now);
    setPhaseDeadline(ctx.state, ctx.now, WAITING_BEAT_MS);
    ctx.effects.sfx('votes_locked');
  },

  isComplete() {
    // A deliberate beat. Nothing can shorten it — the pause is the point.
    return false;
  },

  onTimeout(ctx) {
    ctx.goTo('ROUND_REVEAL');
  },
};

export const roundReveal: PhaseHandler = {
  onEnter(ctx) {
    setPhaseDeadline(ctx.state, ctx.now, REVEAL_HOLD_MS);
    ctx.effects.sfx('reveal');
  },

  isComplete() {
    return false;
  },

  onTimeout(ctx) {
    ctx.goTo('ROUND_VOTE');
  },

  hostCanAdvance: true,
};

export const roundVote: PhaseHandler = {
  onEnter(ctx) {
    setPhaseDeadline(ctx.state, ctx.now, voteMs(ctx.state));
  },

  isComplete(ctx) {
    const matchup = matchupOf(ctx);
    if (matchup === undefined) return true;
    const outstanding = matchup.voterIds.filter((id) => {
      const player = findPlayer(ctx.state, id);
      if (player === undefined || !isEligible(player, ctx.now)) return false;
      return matchup.votes[id] === undefined;
    });
    return outstanding.length === 0;
  },

  onTimeout(ctx) {
    ctx.goTo('ROUND_RESULTS');
  },

  /** Same for the vote: do not hold the room open for people who have gone. */
  onPresenceChange(ctx) {
    const matchup = matchupOf(ctx);
    if (matchup === undefined) return;
    const outstanding = matchup.voterIds.filter((id) => matchup.votes[id] === undefined);
    if (outstanding.length === 0) return;
    const anyOnline = outstanding.some((id) => findPlayer(ctx.state, id)?.connected === true);
    if (!anyOnline) shortenPhaseDeadline(ctx.state, ctx.now, ABANDONED_PHASE_MS);
  },
};

export const roundResults: PhaseHandler = {
  onEnter(ctx) {
    resolveCurrentMatchup(ctx.state, ctx.now);
    setPhaseDeadline(ctx.state, ctx.now, ROUND_RESULTS_AUTO_MS);

    const outcome = matchupOf(ctx)?.resolved ?? null;
    if (outcome === null) return;
    if (outcome.nobodyVoted) {
      ctx.effects.toast('info', 'NOBODY VOTED. THE UNIVERSE DECIDES.');
      ctx.effects.sfx('buzzer');
    } else if (outcome.wasCoinFlip) {
      ctx.effects.toast('info', 'TIE. FLIPPING A COIN.');
      ctx.effects.sfx('drumroll');
    } else if (outcome.wasCleanSweep) {
      ctx.effects.sfx('applause');
    } else {
      ctx.effects.sfx('win_sting');
    }
  },

  isComplete() {
    return false;
  },

  onTimeout(ctx) {
    advanceRound(ctx);
  },

  hostCanAdvance: true,
};

/**
 * Where a finished round goes next.
 *
 * The story catches everyone up every other round and always after the last one, so
 * a match never ends on a round the room has not seen written down.
 */
export function advanceRound(ctx: PhaseContext): void {
  const match = ctx.state.match;
  if (match === null) {
    ctx.goTo('LOBBY');
    return;
  }

  const finishedRounds = match.matchupIndex + 1;
  const wasLast = isLastMatchup(ctx.state);

  if (wasLast) {
    ctx.goTo('FINAL_STORY');
    return;
  }

  advanceMatchupIndex(ctx.state);

  if (finishedRounds % STORY_UPDATE_EVERY_N_ROUNDS === 0) {
    ctx.goTo('STORY_UPDATE');
    return;
  }

  ctx.goTo('ROUND_PROMPT');
}
