/**
 * BLURT — the per-device private payload.
 *
 * The second redaction rule, on its own: nothing built here crosses to another device.
 * `buildPrivate` takes the single player it is building for, so "who is this for?" is
 * a parameter rather than a convention somebody has to remember.
 */

import type { PrivateMessage } from '../../shared/protocol.js';
import {
  toPublicPlayer,
} from './roomState.js';
import { slotFor } from './story.js';
import type { RoomState, ServerPlayer } from './types.js';
import { currentDrawing, currentMatchup } from './viewParts.js';

/* ------------------------------------------------------------------ *
 * Per-device private payloads
 * ------------------------------------------------------------------ */

/**
 * Everything this one device may know that nobody else may. Returns `null` when the
 * current phase has nothing private for this player, so no message is sent at all.
 */
export function buildPrivate(state: RoomState, player: ServerPlayer): PrivateMessage | null {
  const matchup = currentMatchup(state);
  const drawing = currentDrawing(state);
  const payload: PrivateMessage = { t: 'private' };
  let hasContent = false;

  if (
    matchup !== undefined &&
    (state.phase === 'ROUND_PROMPT' || state.phase === 'ROUND_WAITING') &&
    matchup.competitorIds.includes(player.id)
  ) {
    const slot = slotFor(matchup.storyId, matchup.slotId);
    if (slot !== undefined) {
      const mine = matchup.answers.find((a) => a.authorId === player.id && !a.isFallback);
      payload.prompt = {
        roundId: matchup.roundId,
        text: slot.disguisedPrompt,
        hint: slot.hint ?? null,
        charLimit: slot.charLimit,
        submitted: mine?.text ?? null,
      };
      hasContent = true;
    }
  }

  if (matchup !== undefined && (state.phase === 'ROUND_REVEAL' || state.phase === 'ROUND_VOTE')) {
    const mine = matchup.answers.find((a) => a.authorId === player.id);
    if (mine !== undefined) {
      payload.myAnswerId = mine.id;
      hasContent = true;
    }
    if (state.phase === 'ROUND_VOTE' && matchup.voterIds.includes(player.id)) {
      // Server-side exclusion of the player's own answer. The UI also hides it, but
      // this is what makes a hand-crafted socket message pointless.
      payload.votableAnswers = matchup.answers
        .filter((a) => a.authorId !== player.id)
        .map((a) => ({ id: a.id, text: a.text }));
      const existing = matchup.votes[player.id];
      if (existing !== undefined) payload.myVote = existing;
      hasContent = true;
    }
  }

  if (drawing !== undefined && drawing.artistId === player.id) {
    if (state.phase === 'DRAWING_SETUP' || state.phase === 'DRAWING_ACTIVE') {
      payload.drawingPrompt = {
        roundId: drawing.roundId,
        subject: drawing.subject,
        context: drawing.context,
        submitted: drawing.hasImage,
      };
      hasContent = true;
    }
  }

  if (drawing !== undefined && drawing.artistId !== player.id) {
    if (state.phase === 'DRAWING_GUESS') {
      const mine = drawing.guesses[player.id];
      if (mine !== undefined) payload.myDrawingGuess = mine;
      hasContent = true;
    }
    if (state.phase === 'DRAWING_VOTE') {
      payload.votableDrawingOptions = drawing.options
        .filter((o) => o.authorId !== player.id)
        .map((o) => ({ id: o.id, text: o.text }));
      const existing = drawing.votes[player.id];
      if (existing !== undefined) payload.myDrawingVote = existing;
      hasContent = true;
    }
  }

  return hasContent ? payload : null;
}

export { toPublicPlayer };
