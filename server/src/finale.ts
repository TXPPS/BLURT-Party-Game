/**
 * BLURT — the drawing finale.
 *
 * Prompts are derived from the story the room just built, so the artist is always
 * drawing something one of *them* wrote. Decoys are written by everybody else, and
 * the vote is between the truth and the group's own lies.
 */

import { GENERIC_DRAWING_PROMPTS, GENERIC_PROMPT_CONTEXT } from '../../content/genericPrompts.js';
import { selectShowcase } from '../../shared/matchmaking.js';
import { makeRng, randomInt, seedFromString, shuffle } from '../../shared/rng.js';
import { resolveDrawing, unshownArtistComp, type DrawingOption } from '../../shared/scoring.js';
import { shortId } from './ids.js';
import { applyEvents, rngFor } from './match.js';
import { eligiblePlayers, findPlayer, isEligible, nextSeq } from './roomState.js';
import { availableDrawingPrompts } from './story.js';
import type { DrawingRecord, RoomState } from './types.js';

/**
 * Decide who draws and what.
 *
 * **Everybody eligible draws.** Drawing is simultaneous, so a tenth artist costs the
 * room nothing in wall-clock time — the old cap existed only because drawings used to
 * run one after another, and it was doing a job that no longer needs doing. What is
 * still capped is the *showcase*, decided later in `selectShowcaseDrawings` once we
 * know who actually submitted.
 *
 * Prompts come from the story wherever possible, because drawing something a player
 * wrote is the joke. There are only ever as many of those as there were rounds — a
 * three-round match yields three — so the shortfall is filled from
 * `GENERIC_DRAWING_PROMPTS` rather than cutting artists back to the prompt supply.
 * Every artist gets a distinct subject either way.
 *
 * Returns false when the finale cannot run at all, which the caller turns into a
 * clean skip straight to the results rather than an empty screen.
 */
export function planFinale(state: RoomState, now: number): boolean {
  const match = state.match;
  if (match === null) return false;

  const eligible = eligiblePlayers(state, now);
  if (eligible.length < 2) return false;

  const derived = availableDrawingPrompts(match);
  const rng = rngFor(state, match.drawings.length, 'finale-prompts');

  // Generic prompts are dealt from a shuffled deck so a room that plays twice does
  // not get the same fallbacks in the same order.
  const spares = shuffle(rng, GENERIC_DRAWING_PROMPTS);

  // Lowest score first keeps the old comeback flavour in the *order* drawings are
  // recorded, which is the order the showcase presents them in.
  const artists = [...eligible].sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));

  match.drawings = artists.map((artist, index) => {
    const prompt = derived[index];
    const spare = spares[(index - derived.length) % spares.length];
    return {
      index,
      roundId: shortId('d', nextSeq(state)),
      artistId: artist.id,
      subject: prompt?.subject ?? spare ?? 'something indescribable',
      context: prompt?.context ?? (prompt === undefined ? GENERIC_PROMPT_CONTEXT : ''),
      storyId: prompt?.storyId ?? '',
      slotId: prompt?.slotId ?? '',
      hasImage: false,
      guesses: {},
      options: [],
      votes: {},
      resolved: null,
    } satisfies DrawingRecord;
  });

  match.drawingIndex = 0;
  match.showcase = [];
  match.finalePlanned = match.drawings.length > 0;

  for (const artist of artists) {
    const player = findPlayer(state, artist.id);
    if (player !== undefined) player.stats.drawingsMade += 1;
  }

  return match.finalePlanned;
}

/**
 * The drawing the showcase is currently on.
 *
 * `drawingIndex` walks `showcase`, not `drawings` — everybody draws, but only the
 * showcased ones are guessed and voted on, so the two lists are different lengths.
 */
export function currentDrawingRecord(state: RoomState): DrawingRecord | undefined {
  const match = state.match;
  if (match === null) return undefined;
  const drawingIndex = match.showcase[match.drawingIndex];
  return drawingIndex === undefined ? undefined : match.drawings[drawingIndex];
}

/**
 * Choose which drawings the room sits through, once DRAWING_ACTIVE has ended.
 *
 * Only drawings that actually arrived are eligible: showing a blank because somebody
 * timed out is a fine joke once, but it is a poor use of one of four slots when other
 * people did the work. If nobody submitted at all, fall back to showing the blanks so
 * the finale still resolves rather than skipping to the scores.
 */
export function selectShowcaseDrawings(state: RoomState, max: number): void {
  const match = state.match;
  if (match === null) return;

  const submitted = match.drawings.filter((d) => d.hasImage);
  const pool = submitted.length > 0 ? submitted : match.drawings;

  const candidates = pool.map((drawing) => ({
    drawingIndex: drawing.index,
    wins: findPlayer(state, drawing.artistId)?.stats.wins ?? 0,
  }));

  match.showcase = selectShowcase(candidates, max, rngFor(state, match.drawings.length, 'showcase'));
  match.drawingIndex = 0;
}

/** Artists whose drawing arrived but never made the showcase. */
export function unshownArtistIds(state: RoomState): string[] {
  const match = state.match;
  if (match === null) return [];
  const shown = new Set(match.showcase);
  return match.drawings.filter((d) => d.hasImage && !shown.has(d.index)).map((d) => d.artistId);
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
export function buildDrawingOptions(state: RoomState): void {
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

/**
 * Every artist's drawing, in showcase order.
 *
 * During DRAWING_ACTIVE all of these are live at once, so anything that needs to know
 * about *the* drawing has to say which one it means. `currentDrawingRecord` is the
 * showcase pointer and is meaningless while everybody is still drawing.
 */
export function allDrawings(state: RoomState): DrawingRecord[] {
  return state.match?.drawings ?? [];
}

/** The drawing this player is responsible for, if they were picked as an artist. */
export function drawingForArtist(state: RoomState, playerId: string): DrawingRecord | undefined {
  return allDrawings(state).find((d) => d.artistId === playerId);
}

/**
 * Artists who could still submit: no image yet, and still in the room.
 *
 * Somebody who has dropped out cannot finish, so they are not outstanding — that is
 * what lets the phase end early instead of waiting out the clock for a dead phone.
 */
export function outstandingArtists(state: RoomState, now: number): DrawingRecord[] {
  return allDrawings(state).filter((drawing) => {
    if (drawing.hasImage) return false;
    const artist = findPlayer(state, drawing.artistId);
    return artist !== undefined && isEligible(artist, now);
  });
}

/** How many drawings are in, for the "3 of 4 have submitted" counter. */
export function submittedDrawingCount(state: RoomState): number {
  return allDrawings(state).filter((d) => d.hasImage).length;
}

/**
 * Pay the artists whose drawing was never shown.
 *
 * They did exactly the same work as the four who made the showcase and had no
 * opportunity to earn from it, which would otherwise be a straight penalty for losing
 * a coin flip. Each is paid the median of what the showcased artists actually earned
 * on the night — see `unshownArtistComp` for why the median.
 *
 * Called once, on the way to the results screen, so the leaderboard is already right
 * when it appears rather than jumping afterwards.
 */
export function payUnshownArtists(state: RoomState): void {
  const match = state.match;
  if (match === null) return;
  if (match.unshownEvents.length > 0) return;      // already settled

  const unshown = unshownArtistIds(state);
  if (unshown.length === 0) return;

  // What each showcased artist made from their own drawing, and nothing else.
  const earnings = match.showcase.map((drawingIndex) => {
    const drawing = match.drawings[drawingIndex];
    if (drawing?.resolved == null) return 0;
    return drawing.resolved.events
      .filter((event) => event.playerId === drawing.artistId)
      .reduce((sum, event) => sum + event.points, 0);
  });

  const points = unshownArtistComp(earnings);
  if (points <= 0) return;

  match.unshownEvents = unshown.map((playerId) => ({
    playerId,
    points,
    reason: 'artist_unshown' as const,
  }));
  applyEvents(state, match.unshownEvents);
}

export function isLastDrawing(state: RoomState): boolean {
  const match = state.match;
  return match === null || match.drawingIndex >= match.showcase.length - 1;
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

/**
 * A deterministic house decoy for a guesser who ran out of time.
 *
 * Seeded on the *player*, not on a number derived from their id's length — every
 * player id is a UUID of the same length, so the old seed handed three different
 * people the identical decoy and the vote screen listed it three times.
 */
export function houseDecoyFor(state: RoomState, drawingIndex: number, playerId: string): string {
  const pool = [
    'two animals having a disagreement',
    'somebody who has just remembered something awful',
    'a vehicle that should not exist',
    'an object nobody can name',
    'a building with a secret',
    'a man losing an argument with a door',
    'something that used to be a hat',
    'the inside of a very small room',
  ];
  const rng = makeRng(seedFromString(`${state.code}:${drawingIndex}:decoy:${playerId}`));
  return pool[randomInt(rng, pool.length)] ?? (pool[0] as string);
}

/**
 * House decoys must also be distinct from each other, or the vote screen shows the
 * same line twice and the joke evaporates. Walks the pool until it finds one nobody
 * has used for this drawing.
 */
export function uniqueHouseDecoyFor(
  state: RoomState,
  drawingIndex: number,
  playerId: string,
  taken: ReadonlySet<string>,
): string {
  const first = houseDecoyFor(state, drawingIndex, playerId);
  if (!taken.has(first)) return first;
  for (let attempt = 1; attempt < 16; attempt += 1) {
    const candidate = houseDecoyFor(state, drawingIndex, `${playerId}#${attempt}`);
    if (!taken.has(candidate)) return candidate;
  }
  return first;
}
