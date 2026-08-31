/**
 * BLURT — the drawing finale.
 *
 * Prompts are derived from the story the room just built, so the artist is always
 * drawing something one of *them* wrote. Decoys are written by everybody else, and
 * the vote is between the truth and the group's own lies.
 */

import { artistCount, selectArtists } from '../../shared/matchmaking.js';
import { randomInt, shuffle } from '../../shared/rng.js';
import { resolveDrawing, type DrawingOption } from '../../shared/scoring.js';
import { shortId } from './ids.js';
import { applyEvents, rngFor } from './match.js';
import { eligiblePlayers, findPlayer, nextSeq } from './roomState.js';
import { availableDrawingPrompts } from './story.js';
import type { DrawingRecord, RoomState } from './types.js';

/**
 * Decide who draws and what.
 *
 * Artists are chosen lowest-score-first — the finale is a genuine comeback slot, not
 * a victory lap. The number of drawings is capped by room size (see
 * `shared/matchmaking.artistCount`) and by how many drawable subjects the story
 * actually produced, so a one-round match cannot promise four drawings.
 *
 * Returns false when the finale cannot run at all, which the caller turns into a
 * clean skip straight to the results rather than an empty screen.
 */
export function planFinale(state: RoomState, now: number): boolean {
  const match = state.match;
  if (match === null) return false;

  const prompts = availableDrawingPrompts(match);
  const eligible = eligiblePlayers(state, now);
  const wanted = artistCount(eligible.length, prompts.length);
  if (wanted <= 0 || eligible.length < 2) return false;

  const artistIds = selectArtists(
    state.players.map((p) => ({
      id: p.id,
      score: p.score,
      eligible: eligible.some((e) => e.id === p.id),
    })),
    prompts.length,
  );

  match.drawings = artistIds.map((artistId, index) => {
    const prompt = prompts[index];
    const record: DrawingRecord = {
      index,
      roundId: shortId('d', nextSeq(state)),
      artistId,
      subject: prompt?.subject ?? 'something indescribable',
      context: prompt?.context ?? '',
      storyId: prompt?.storyId ?? '',
      slotId: prompt?.slotId ?? '',
      hasImage: false,
      guesses: {},
      options: [],
      votes: {},
      resolved: null,
    };
    return record;
  });
  match.drawingIndex = 0;
  match.finalePlanned = match.drawings.length > 0;

  for (const artistId of artistIds) {
    const player = findPlayer(state, artistId);
    if (player !== undefined) player.stats.drawingsMade += 1;
  }

  return match.finalePlanned;
}

export function currentDrawingRecord(state: RoomState): DrawingRecord | undefined {
  const match = state.match;
  if (match === null) return undefined;
  return match.drawings[match.drawingIndex];
}

export function recordGuess(state: RoomState, playerId: string, text: string): void {
  const drawing = currentDrawingRecord(state);
  if (drawing === undefined) return;
  const isNew = drawing.guesses[playerId] === undefined;
  drawing.guesses[playerId] = text;
  if (isNew) {
    const player = findPlayer(state, playerId);
    if (player !== undefined) player.stats.decoysPlanted += 1;
  }
}

export function recordDrawingVote(state: RoomState, voterId: string, optionId: string): void {
  const drawing = currentDrawingRecord(state);
  if (drawing === undefined) return;
  drawing.votes[voterId] = optionId;
}

/**
 * Build the vote options: the real prompt shuffled in with every decoy.
 *
 * Guessers who timed out contribute nothing, which is fine — the vote works with a
 * single decoy. If literally nobody wrote one, a house decoy is added so the artist
 * is not the only option on screen.
 */
export function buildDrawingOptions(state: RoomState, now: number): void {
  const drawing = currentDrawingRecord(state);
  if (drawing === undefined || drawing.options.length > 0) return;

  const options: DrawingOption[] = [
    { id: shortId('o', nextSeq(state)), authorId: null, text: drawing.subject, isReal: true },
  ];

  for (const [playerId, text] of Object.entries(drawing.guesses)) {
    options.push({ id: shortId('o', nextSeq(state)), authorId: playerId, text, isReal: false });
  }

  if (options.length === 1) {
    options.push({
      id: shortId('o', nextSeq(state)),
      authorId: null,
      text: 'a man having the worst week of his life',
      isReal: false,
    });
  }

  const rng = rngFor(state, drawing.index, 'drawing-options');
  drawing.options = shuffle(rng, options).map((option) => ({
    id: option.id,
    text: option.text,
    authorId: option.authorId,
    isReal: option.isReal,
  }));

  // Anyone who never voted still counts toward the perfect-score denominator.
  void eligiblePlayers(state, now);
}

/** Score the current drawing and bank the stats. */
export function resolveCurrentDrawing(state: RoomState, now: number): void {
  const drawing = currentDrawingRecord(state);
  if (drawing === undefined || drawing.resolved !== null) return;

  const voters = eligiblePlayers(state, now).filter((p) => p.id !== drawing.artistId);
  const outcome = resolveDrawing(
    drawing.artistId,
    drawing.options,
    new Map(Object.entries(drawing.votes)),
    voters.length,
  );

  for (const voterId of outcome.correctVoterIds) {
    const player = findPlayer(state, voterId);
    if (player !== undefined) player.stats.correctGuesses += 1;
  }
  for (const [authorId, count] of Object.entries(outcome.fooledCounts)) {
    const player = findPlayer(state, authorId);
    if (player !== undefined) player.stats.playersFooled += count;
  }
  const artist = findPlayer(state, drawing.artistId);
  if (artist !== undefined) artist.stats.drawingsIdentified += outcome.correctVoterIds.length;

  applyEvents(state, outcome.events);

  drawing.resolved = {
    realOptionId: drawing.options.find((o) => o.isReal)?.id ?? '',
    voteCounts: outcome.voteCounts,
    correctVoterIds: outcome.correctVoterIds,
    fooledCounts: outcome.fooledCounts,
    perfect: outcome.perfect,
    events: outcome.events,
  };
}

export function isLastDrawing(state: RoomState): boolean {
  const match = state.match;
  return match === null || match.drawingIndex >= match.drawings.length - 1;
}

export function advanceDrawingIndex(state: RoomState): void {
  if (state.match !== null) state.match.drawingIndex += 1;
}

/** Everybody who is expected to write a decoy for the current drawing. */
export function guessersFor(state: RoomState, now: number): string[] {
  const drawing = currentDrawingRecord(state);
  if (drawing === undefined) return [];
  return eligiblePlayers(state, now)
    .filter((p) => p.id !== drawing.artistId)
    .map((p) => p.id);
}

/** A deterministic house decoy for a guesser who ran out of time. */
export function houseDecoyFor(state: RoomState, index: number): string {
  const pool = [
    'two animals having a disagreement',
    'somebody who has just remembered something awful',
    'a vehicle that should not exist',
    'an object nobody can name',
    'a building with a secret',
  ];
  const rng = rngFor(state, index, 'house-decoy');
  return pool[randomInt(rng, pool.length)] ?? pool[0] as string;
}
