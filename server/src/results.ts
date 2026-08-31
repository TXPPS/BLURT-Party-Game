/**
 * BLURT — end-of-match results.
 *
 * Awards come from `shared/awards.ts`, which is pure and unit-tested; this module
 * feeds it the match's real stats and builds the highlight reel out of the actual
 * round records. Nothing on the results screen is randomised or invented — every
 * line traces back to something that happened.
 */

import { computeAwards, type AwardCandidate } from '../../shared/awards.js';
import type { Award, HighlightAnswer, HighlightReel } from '../../shared/types.js';
import { slotFor } from './story.js';
import type { ImageLookup } from './views.js';
import type { RoomState } from './types.js';

/** How many answers the highlight reel shows. */
const TOP_ANSWER_COUNT = 3;

function candidates(state: RoomState): AwardCandidate[] {
  return state.players
    .filter((p) => !p.kicked && p.identified)
    .map((p) => ({
      id: p.id,
      name: p.name,
      avatarId: p.avatarId,
      score: p.score,
      stats: p.stats,
    }));
}

export function computeMatchAwards(state: RoomState): Award[] {
  const match = state.match;
  return computeAwards({
    candidates: candidates(state),
    playerCount: state.players.filter((p) => !p.kicked && p.identified).length,
    drawingFinalePlayed: (match?.drawings.length ?? 0) > 0,
  });
}

/**
 * The highlight reel: the three best-received answers, the drawing that fooled the
 * most people, and the single most-voted line in the finished story.
 */
export function buildHighlightReel(state: RoomState, images: ImageLookup): HighlightReel {
  const match = state.match;
  if (match === null) {
    return { topAnswers: [], funniestDrawing: null, bestStoryLine: null };
  }

  const scored: HighlightAnswer[] = [];
  for (const matchup of match.matchups) {
    const outcome = matchup.resolved;
    if (outcome === null) continue;
    const slot = slotFor(matchup.storyId, matchup.slotId);
    for (const answer of matchup.answers) {
      const votes = outcome.voteCounts[answer.id] ?? 0;
      if (votes === 0) continue;
      const author = answer.authorId === null ? undefined : state.players.find((p) => p.id === answer.authorId);
      scored.push({
        text: answer.text,
        authorId: answer.authorId,
        authorName: author?.name ?? 'THE HOUSE',
        authorAvatarId: author?.avatarId ?? null,
        votes,
        promptLabel: slot?.disguisedPrompt ?? '',
      });
    }
  }

  scored.sort((a, b) => b.votes - a.votes || b.text.length - a.text.length);
  const topAnswers = scored.slice(0, TOP_ANSWER_COUNT);

  // The funniest drawing is the one whose decoys pulled the most votes away from
  // the truth — i.e. the least legible one people had the strongest opinions about.
  let funniestDrawing: HighlightReel['funniestDrawing'] = null;
  let bestDecoyPull = -1;
  match.drawings.forEach((drawing, index) => {
    const outcome = drawing.resolved;
    if (outcome === null) return;
    const decoyVotes = Object.values(outcome.fooledCounts).reduce((a, b) => a + b, 0);
    if (decoyVotes <= bestDecoyPull) return;
    const artist = state.players.find((p) => p.id === drawing.artistId);
    if (artist === undefined || !drawing.hasImage) return;
    bestDecoyPull = decoyVotes;
    funniestDrawing = {
      artistId: artist.id,
      artistName: artist.name,
      artistAvatarId: artist.avatarId,
      imageUrl: images(index),
      decoyVotesAttracted: decoyVotes,
    };
  });

  // The best story line is the winning answer that took the most votes — that line
  // of the story is the one the room actually chose.
  const bestWinner = scored
    .filter((answer) =>
      match.matchups.some(
        (m) => m.resolved !== null && m.answers.some((a) => a.text === answer.text && m.resolved?.winningAnswerId === a.id),
      ),
    )
    .sort((a, b) => b.votes - a.votes)[0];

  const bestStoryLine =
    bestWinner === undefined
      ? null
      : { text: bestWinner.text, authorName: bestWinner.authorName, votes: bestWinner.votes };

  return { topAnswers, funniestDrawing, bestStoryLine };
}
