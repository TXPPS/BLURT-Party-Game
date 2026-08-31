/**
 * BLURT — STORY_UPDATE and FINAL_STORY.
 *
 * These are the payoff screens: the room finds out what the game did with the
 * answers they wrote in a completely different context. Both are host-gated with an
 * auto-advance behind them, so nobody is stuck staring at a story that will not move.
 */

import {
  FINAL_STORY_LINE_MS,
  FINAL_STORY_TAIL_MS,
  STORY_UPDATE_AUTO_MS,
} from '../../../shared/constants.js';
import { planFinale } from '../finale.js';
import { setPhaseDeadline , everyoneReadyToAdvance } from '../roomState.js';
import { renderMatchStories } from '../story.js';
import type { PhaseContext, PhaseHandler } from '../types.js';

export const storyUpdate: PhaseHandler = {
  onEnter(ctx) {
    setPhaseDeadline(ctx.state, ctx.now, STORY_UPDATE_AUTO_MS);
    ctx.effects.sfx('story_stamp');
    // The first update is where the story earns a title. Before this the room has
    // deliberately been told nothing about what they are writing.
    if (ctx.state.match !== null) ctx.state.match.titleRevealed = true;
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
    leaveStoryUpdate(ctx);
  },

  hostCanAdvance: true,
};

/** Story updates always hand back to the next round; the last one goes to the finale. */
export function leaveStoryUpdate(ctx: PhaseContext): void {
  const match = ctx.state.match;
  if (match === null) {
    ctx.goTo('LOBBY');
    return;
  }
  // `storyUpdatedThrough` marks where the next update's "fresh" highlight starts.
  match.storyUpdatedThrough = match.matchupIndex;
  ctx.goTo(match.matchupIndex >= match.plan.length ? 'FINAL_STORY' : 'ROUND_PROMPT');
}

export const finalStory: PhaseHandler = {
  onEnter(ctx) {
    const match = ctx.state.match;
    if (match !== null) match.titleRevealed = true;

    // Long enough to actually read it out: one beat per line, plus a tail.
    const lineCount =
      match === null
        ? 0
        : renderMatchStories(match, { revealAll: true }).reduce(
            (sum, story) => sum + story.sections.reduce((n, section) => n + section.lines.length, 0),
            0,
          );
    setPhaseDeadline(ctx.state, ctx.now, lineCount * FINAL_STORY_LINE_MS + FINAL_STORY_TAIL_MS);
    ctx.effects.sfx('drumroll');
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
    leaveFinalStory(ctx);
  },

  hostCanAdvance: true,
};

/**
 * After the story: the drawing finale if it is switched on and the match produced
 * enough drawable material, otherwise straight to the results. A finale that cannot
 * run is skipped cleanly rather than shown as an empty screen.
 */
export function leaveFinalStory(ctx: PhaseContext): void {
  if (!ctx.state.settings.drawingFinale) {
    ctx.goTo('FINAL_RESULTS');
    return;
  }
  if (!planFinale(ctx.state, ctx.now)) {
    ctx.effects.toast('info', 'Not enough to draw this time — straight to the scores.');
    ctx.goTo('FINAL_RESULTS');
    return;
  }
  ctx.goTo('DRAWING_SETUP');
}
