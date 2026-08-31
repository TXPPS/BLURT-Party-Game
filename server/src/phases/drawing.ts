/**
 * BLURT — the drawing finale phases.
 *
 * SETUP → ACTIVE happen once. Every selected artist draws at the same time, on their
 * own device, inside one shared window.
 *
 * GUESS → VOTE → RESULTS then run once per drawing, in sequence. Those are the
 * showcase: the whole room is meant to look at one picture together, so they stay
 * one-at-a-time on purpose. Drawing is solitary work and was the part that did not
 * need an audience — running it sequentially made three artists cost three drawing
 * timers and left everybody else watching a progress bar.
 *
 * Every phase degrades rather than stalls: an artist who never submits still gets
 * their drawing shown (blank, which is funnier), a guesser who times out gets a
 * house decoy, and a vote nobody casts still resolves and scores zero.
 */

import {
  ABANDONED_PHASE_MS,
  DRAWING_RESULTS_AUTO_MS,
  DRAWING_SETUP_MS,
  DRAWING_SHOWCASE_MAX,
} from '../../../shared/constants.js';
import {
  advanceDrawingIndex,
  allDrawings,
  buildDrawingOptions,
  currentDrawingRecord,
  guessersFor,
  uniqueHouseDecoyFor,
  isLastDrawing,
  outstandingArtists,
  payUnshownArtists,
  recordGuess,
  resolveCurrentDrawing,
  selectShowcaseDrawings,
} from '../finale.js';
import { drawMs, voteMs } from '../match.js';
import { findPlayer, setPhaseDeadline, shortenPhaseDeadline , everyoneReadyToAdvance } from '../roomState.js';
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

  /** Done when nobody is still able to draw — submitted, or no longer in the room. */
  isComplete(ctx) {
    if (allDrawings(ctx.state).length === 0) return true;
    return outstandingArtists(ctx.state, ctx.now).length === 0;
  },

  onTimeout(ctx) {
    // Now, and only now, do we know who actually submitted — so this is where the
    // showcase gets picked.
    selectShowcaseDrawings(ctx.state, DRAWING_SHOWCASE_MAX);
    ctx.goTo('DRAWING_GUESS');
  },

  /**
   * Only cut the phase short when *nobody* is still drawing.
   *
   * Sequentially this was simple: one artist, and if their phone dropped there was
   * no reason to wait. With everyone drawing at once, one person leaving must not
   * take time away from the others who are mid-picture — so the deadline only moves
   * in when every artist who has not submitted is disconnected. An artist who left
   * for good stops being outstanding at all, and `isComplete` ends the phase.
   */
  onPresenceChange(ctx) {
    const outstanding = outstandingArtists(ctx.state, ctx.now);
    if (outstanding.length === 0) return;
    const anyoneStillHere = outstanding.some((drawing) => {
      const artist = findPlayer(ctx.state, drawing.artistId);
      return artist !== undefined && artist.connected;
    });
    if (anyoneStillHere) return;
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
  // Everything already on the board, so a house decoy never duplicates a real guess
  // or another house decoy.
  const taken = new Set(Object.values(drawing.guesses));
  for (const id of guessersFor(ctx.state, ctx.now)) {
    if (drawing.guesses[id] !== undefined) continue;
    const player = findPlayer(ctx.state, id);
    if (player !== undefined) player.stats.fallbackFills += 1;
    const decoy = uniqueHouseDecoyFor(ctx.state, drawing.index, id, taken);
    taken.add(decoy);
    recordGuess(ctx.state, id, decoy);
  }
}

export const drawingVote: PhaseHandler = {
  onEnter(ctx) {
    fillMissingGuesses(ctx);
    buildDrawingOptions(ctx.state);
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

    // Settle with the artists nobody had time to look at, here rather than on the way
    // out, so the payment appears in this screen's score deltas next to the line that
    // explains it. A score that moves with no visible reason is a bug report.
    if (isLastDrawing(ctx.state)) payUnshownArtists(ctx.state);

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

  /**
   * A watching screen is finished when the room says it is.
   *
   * The deadline is still the backstop — this only ever ends the phase *earlier*, and
   * only when everybody present has pressed READY, so one impatient player cannot
   * skip a reveal for the room.
   */
  isComplete(ctx) {
    return everyoneReadyToAdvance(ctx.state, ctx.now);
  },

  onTimeout(ctx) {
    advanceFinale(ctx);
  },

  hostCanAdvance: true,
};

/**
 * Next drawing in the showcase, or the results screen once every one has been shown.
 *
 * Straight back to DRAWING_GUESS: the pictures already exist by this point, so there
 * is nothing to set up and nothing to draw.
 */
export function advanceFinale(ctx: PhaseContext): void {
  if (isLastDrawing(ctx.state)) {
    ctx.goTo('FINAL_RESULTS');
    return;
  }
  advanceDrawingIndex(ctx.state);
  ctx.goTo('DRAWING_GUESS');
}
