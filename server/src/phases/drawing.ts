/**
 * BLURT — the drawing finale phases.
 *
 * SETUP → ACTIVE → GUESS → VOTE → RESULTS, once per artist.
 *
 * Every phase degrades rather than stalls: an artist who never submits still gets
 * their drawing shown (blank, which is funnier), a guesser who times out gets a
 * house decoy, and a vote nobody casts still resolves and scores zero.
 */

import {
  ABANDONED_PHASE_MS,
  DRAWING_RESULTS_AUTO_MS,
  DRAWING_SETUP_MS,
} from '../../../shared/constants.js';
import {
  advanceDrawingIndex,
  buildDrawingOptions,
  currentDrawingRecord,
  guessersFor,
  houseDecoyFor,
  isLastDrawing,
  recordGuess,
  resolveCurrentDrawing,
} from '../finale.js';
import { drawMs, voteMs } from '../match.js';
import { findPlayer, isEligible, setPhaseDeadline, shortenPhaseDeadline } from '../roomState.js';
import type { PhaseContext, PhaseHandler } from '../types.js';

export const drawingSetup: PhaseHandler = {
  onEnter(ctx) {
    setPhaseDeadline(ctx.state, ctx.now, DRAWING_SETUP_MS);
    ctx.effects.sfx('spring');
  },

  isComplete() {
    return false;
  },

  onTimeout(ctx) {
    ctx.goTo('DRAWING_ACTIVE');
  },
};

export const drawingActive: PhaseHandler = {
  onEnter(ctx) {
    setPhaseDeadline(ctx.state, ctx.now, drawMs(ctx.state));
  },

  isComplete(ctx) {
    const drawing = currentDrawingRecord(ctx.state);
    if (drawing === undefined) return true;
    if (drawing.hasImage) return true;
    // An artist who has left cannot finish; move on rather than wait them out.
    const artist = findPlayer(ctx.state, drawing.artistId);
    return artist === undefined || !isEligible(artist, ctx.now);
  },

  onTimeout(ctx) {
    ctx.goTo('DRAWING_GUESS');
  },

  /**
   * The artist is the only person who can end this phase, so if their phone drops
   * off, everybody else is watching a canvas nobody is drawing on. Wait a short
   * while for them rather than the full drawing timer or the full grace window.
   */
  onPresenceChange(ctx) {
    const drawing = currentDrawingRecord(ctx.state);
    if (drawing === undefined || drawing.hasImage) return;
    const artist = findPlayer(ctx.state, drawing.artistId);
    if (artist !== undefined && artist.connected) return;
    shortenPhaseDeadline(ctx.state, ctx.now, ABANDONED_PHASE_MS);
  },
};

export const drawingGuess: PhaseHandler = {
  onEnter(ctx) {
    setPhaseDeadline(ctx.state, ctx.now, voteMs(ctx.state));
    ctx.effects.sfx('reveal');
  },

  isComplete(ctx) {
    const drawing = currentDrawingRecord(ctx.state);
    if (drawing === undefined) return true;
    const outstanding = guessersFor(ctx.state, ctx.now).filter(
      (id) => drawing.guesses[id] === undefined,
    );
    return outstanding.length === 0;
  },

  onTimeout(ctx) {
    fillMissingGuesses(ctx);
    ctx.goTo('DRAWING_VOTE');
  },
};

/** House decoys for anyone who ran out of time, so the vote always has options. */
function fillMissingGuesses(ctx: PhaseContext): void {
  const drawing = currentDrawingRecord(ctx.state);
  if (drawing === undefined) return;
  for (const id of guessersFor(ctx.state, ctx.now)) {
    if (drawing.guesses[id] !== undefined) continue;
    const player = findPlayer(ctx.state, id);
    if (player !== undefined) player.stats.fallbackFills += 1;
    recordGuess(ctx.state, id, houseDecoyFor(ctx.state, drawing.index + id.length));
  }
}

export const drawingVote: PhaseHandler = {
  onEnter(ctx) {
    fillMissingGuesses(ctx);
    buildDrawingOptions(ctx.state, ctx.now);
    setPhaseDeadline(ctx.state, ctx.now, voteMs(ctx.state));
    ctx.effects.sfx('votes_locked');
  },

  isComplete(ctx) {
    const drawing = currentDrawingRecord(ctx.state);
    if (drawing === undefined) return true;
    const outstanding = guessersFor(ctx.state, ctx.now).filter(
      (id) => drawing.votes[id] === undefined,
    );
    return outstanding.length === 0;
  },

  onTimeout(ctx) {
    ctx.goTo('DRAWING_RESULTS');
  },
};

export const drawingResults: PhaseHandler = {
  onEnter(ctx) {
    resolveCurrentDrawing(ctx.state, ctx.now);
    setPhaseDeadline(ctx.state, ctx.now, DRAWING_RESULTS_AUTO_MS);

    const drawing = currentDrawingRecord(ctx.state);
    if (drawing?.resolved?.perfect === true) {
      ctx.effects.sfx('angel_choir');
      ctx.effects.toast('good', 'Everyone got it. Genuinely impressive.');
    } else if ((drawing?.resolved?.correctVoterIds.length ?? 0) === 0) {
      ctx.effects.sfx('sad_trombone');
      ctx.effects.toast('bad', 'Nobody had any idea what that was.');
    } else {
      ctx.effects.sfx('win_sting');
    }
  },

  isComplete() {
    return false;
  },

  onTimeout(ctx) {
    advanceFinale(ctx);
  },

  hostCanAdvance: true,
};

/** Next drawing, or the results screen once every artist has had their turn. */
export function advanceFinale(ctx: PhaseContext): void {
  if (isLastDrawing(ctx.state)) {
    ctx.goTo('FINAL_RESULTS');
    return;
  }
  advanceDrawingIndex(ctx.state);
  ctx.goTo('DRAWING_SETUP');
}
