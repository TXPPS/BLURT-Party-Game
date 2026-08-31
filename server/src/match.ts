/**
 * BLURT — the match engine.
 *
 * Everything that mutates a match lives here: starting it, opening a matchup,
 * filling in for a player who timed out, resolving a vote, and writing the winning
 * answer into the story. The phase handlers call into this; they never reach into
 * the score or the stats themselves.
 *
 * Scores are only ever changed by `applyEvents`, which also appends to the match's
 * `scoreLog`. That single choke point is what lets the QA harness recompute every
 * point independently and compare.
 */

import { TIMER_PRESETS, DRAWING_ACTIVE_MS } from '../../shared/constants.js';
import { needsHouseAnswer, selectCompetitors, votersForMatchup } from '../../shared/matchmaking.js';
import { makeRng, randomInt, roundSeed, type Rng } from '../../shared/rng.js';
import { resolveMatchup, type MatchupAnswer, type ScoreEvent } from '../../shared/scoring.js';
import { houseFallbackFor } from '../../shared/storyEngine.js';
import { shortId } from './ids.js';
import { eligiblePlayers, findPlayer, matchmakingView, nextSeq } from './roomState.js';
import { fillKey, planMatch, rememberStories, slotFor, storyById } from './story.js';
import type { MatchState, MatchupRecord, RoomState } from './types.js';

/* ------------------------------------------------------------------ *
 * Timing
 * ------------------------------------------------------------------ */

export function answerMs(state: RoomState): number {
  return TIMER_PRESETS[state.settings.timerSpeed].answerMs;
}

export function voteMs(state: RoomState): number {
  return TIMER_PRESETS[state.settings.timerSpeed].voteMs;
}

/** The whole drawing phase — every artist draws inside this one window, together. */
export function drawMs(state: RoomState): number {
  return DRAWING_ACTIVE_MS[state.settings.timerSpeed];
}

/** Deterministic per-room, per-round randomness so every draw is reproducible. */
export function rngFor(state: RoomState, index: number, purpose: string): Rng {
  return makeRng(roundSeed(state.code, index, purpose));
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

/** The only function in the server that changes a score. */
export function applyEvents(state: RoomState, events: readonly ScoreEvent[]): void {
  for (const event of events) {
    const player = findPlayer(state, event.playerId);
    if (player === undefined) continue;
    player.score += event.points;
  }
  state.match?.scoreLog.push(...events);
}

/* ------------------------------------------------------------------ *
 * Starting a match
 * ------------------------------------------------------------------ */

export interface StartResult {
  ok: boolean;
  reason?: string;
}

export function startMatch(state: RoomState, now: number): StartResult {
  const rng = rngFor(state, state.seq, 'story');
  const planned = planMatch(state, (max) => randomInt(rng, max));
  if (planned === null || planned.plan.length === 0) {
    return { ok: false, reason: 'No stories are available for that mode.' };
  }

  const match: MatchState = {
    storyIds: planned.storyIds,
    plan: planned.plan,
    matchupIndex: 0,
    matchups: [],
    fills: {},
    storyUpdatedThrough: 0,
    titleRevealed: false,
    drawings: [],
    drawingIndex: 0,
    finalePlanned: false,
    scoreLog: [],
    startedAt: now,
  };

  state.match = match;
  rememberStories(state, planned.storyIds);
  for (const player of state.players) {
    player.score = 0;
    player.ready = false;
  }
  return { ok: true };
}

/** Wipe scores and stats for PLAY AGAIN while keeping the people in their seats. */
export function resetForNewMatch(state: RoomState): void {
  state.match = null;
  for (const player of state.players) {
    player.score = 0;
    player.ready = false;
    player.stats = {
      appearances: 0,
      wins: 0,
      votesReceived: 0,
      votesCast: 0,
      decoysPlanted: 0,
      playersFooled: 0,
      correctGuesses: 0,
      drawingsIdentified: 0,
      drawingsMade: 0,
      cleanSweeps: 0,
      fallbackFills: 0,
      darkVotesReceived: 0,
      longestWinningAnswer: 0,
      houseLosses: 0,
    };
  }
}

/* ------------------------------------------------------------------ *
 * Matchups
 * ------------------------------------------------------------------ */

/**
 * Open the matchup at `match.matchupIndex`: choose competitors, choose voters, and
 * bank the appearance so matchmaking stays balanced even if the round is abandoned.
 */
export function beginMatchup(state: RoomState, now: number): MatchupRecord | null {
  const match = state.match;
  if (match === null) return null;

  const assignment = match.plan[match.matchupIndex];
  if (assignment === undefined) return null;

  const rng = rngFor(state, match.matchupIndex, 'competitors');
  const pool = matchmakingView(state, now);
  const competitorIds = selectCompetitors(pool, match.matchupIndex, rng);
  const voterIds = votersForMatchup(pool, competitorIds);

  const record: MatchupRecord = {
    index: match.matchupIndex,
    roundId: shortId('r', nextSeq(state)),
    storyId: assignment.storyId,
    slotId: assignment.slotId,
    competitorIds,
    voterIds,
    answers: [],
    votes: {},
    resolved: null,
  };

  for (const id of competitorIds) {
    const player = findPlayer(state, id);
    if (player !== undefined) player.stats.appearances += 1;
  }

  match.matchups[match.matchupIndex] = record;
  return record;
}

/** Record or replace a competitor's answer. Idempotent before the deadline. */
export function submitAnswer(state: RoomState, playerId: string, text: string): void {
  const matchup = state.match?.matchups[state.match.matchupIndex];
  if (matchup === undefined) return;

  const existing = matchup.answers.find((a) => a.authorId === playerId);
  if (existing !== undefined) {
    existing.text = text;
    existing.isFallback = false;
    return;
  }
  matchup.answers.push({
    id: shortId('a', nextSeq(state)),
    authorId: playerId,
    text,
    isFallback: false,
  });
}

export function hasSubmitted(matchup: MatchupRecord, playerId: string): boolean {
  return matchup.answers.some((a) => a.authorId === playerId && !a.isFallback);
}

/**
 * Fill in for anyone who ran out of time, and add THE HOUSE at two players.
 *
 * A fallback answer is still eligible to win the slot — the story has to stay
 * intact — but it is marked so the awards can tell the difference between a joke
 * somebody wrote and a joke the game wrote for them.
 */
export function fillMissingAnswers(state: RoomState, now: number): void {
  const match = state.match;
  const matchup = match?.matchups[match.matchupIndex];
  if (match === undefined || match === null || matchup === undefined) return;

  // The house only plays when the *room* has two people, not when a matchup happens
  // to have two competitors — which is every matchup from 2 to 5 players.
  const roomSize = eligiblePlayers(state, now).length;

  const story = storyById(matchup.storyId);
  const slot = slotFor(matchup.storyId, matchup.slotId);
  if (story === undefined || slot === undefined) return;

  const rng = rngFor(state, matchup.index, 'fallback');

  for (const competitorId of matchup.competitorIds) {
    if (matchup.answers.some((a) => a.authorId === competitorId)) continue;
    const player = findPlayer(state, competitorId);
    if (player !== undefined) player.stats.fallbackFills += 1;
    matchup.answers.push({
      id: shortId('a', nextSeq(state)),
      authorId: competitorId,
      text: slot.fallback[randomInt(rng, slot.fallback.length)] ?? houseFallbackFor(story, slot),
      isFallback: true,
    });
  }

  // Two players means no impartial voters, so THE HOUSE joins the matchup and both
  // players vote. Losing to it is a documented, celebrated outcome.
  if (needsHouseAnswer(roomSize) && !matchup.answers.some((a) => a.authorId === null)) {
    const used = new Set(matchup.answers.map((a) => a.text));
    const unused = slot.fallback.filter((f) => !used.has(f));
    const pool = unused.length > 0 ? unused : slot.fallback;
    matchup.answers.push({
      id: shortId('a', nextSeq(state)),
      authorId: null,
      text: pool[randomInt(rng, pool.length)] ?? houseFallbackFor(story, slot),
      isFallback: true,
    });
  }

  // Present the answers in a stable shuffled order so position never hints at author.
  const order = rngFor(state, matchup.index, 'answer-order');
  matchup.answers = matchup.answers
    .map((answer) => ({ answer, key: order.next() }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.answer);
}

/* ------------------------------------------------------------------ *
 * Voting and resolution
 * ------------------------------------------------------------------ */

export function recordVote(state: RoomState, voterId: string, answerId: string): void {
  const matchup = state.match?.matchups[state.match.matchupIndex];
  if (matchup === undefined) return;
  matchup.votes[voterId] = answerId;
}

/**
 * Resolve the current matchup: score it, update stats, and write the winning answer
 * into the story. Safe to call once — the handler guards against a second call.
 */
export function resolveCurrentMatchup(state: RoomState, now: number): void {
  const match = state.match;
  const matchup = match?.matchups[match.matchupIndex];
  if (match === null || matchup === undefined || matchup.resolved !== null) return;

  const slot = slotFor(matchup.storyId, matchup.slotId);
  const rng = rngFor(state, matchup.index, 'resolve');

  const answers: MatchupAnswer[] = matchup.answers.map((a) => ({
    id: a.id,
    authorId: a.authorId,
    text: a.text,
    isFallback: a.isFallback,
  }));
  const votes = new Map(Object.entries(matchup.votes));
  const outcome = resolveMatchup(answers, votes, matchup.voterIds.length, rng);

  // Stats.
  for (const [voterId] of votes) {
    const voter = findPlayer(state, voterId);
    if (voter !== undefined) voter.stats.votesCast += 1;
  }
  for (const answer of matchup.answers) {
    const count = outcome.voteCounts[answer.id] ?? 0;
    if (answer.authorId === null) continue;
    const author = findPlayer(state, answer.authorId);
    if (author === undefined) continue;
    author.stats.votesReceived += count;
    if (slot?.tone === 'dark') author.stats.darkVotesReceived += count;
  }
  for (const answerId of outcome.tiedAnswerIds) {
    const answer = matchup.answers.find((a) => a.id === answerId);
    if (answer?.authorId == null) continue;
    const author = findPlayer(state, answer.authorId);
    if (author === undefined) continue;
    author.stats.wins += 1;
    if (!answer.isFallback) {
      author.stats.longestWinningAnswer = Math.max(
        author.stats.longestWinningAnswer,
        [...answer.text].length,
      );
    }
  }
  if (outcome.wasCleanSweep) {
    const winner = matchup.answers.find((a) => a.id === outcome.winningAnswerId);
    if (winner?.authorId != null) {
      const author = findPlayer(state, winner.authorId);
      if (author !== undefined) author.stats.cleanSweeps += 1;
    }
  }

  // Two-player mode: losing the slot to THE HOUSE is its own award.
  const winningAnswer = matchup.answers.find((a) => a.id === outcome.winningAnswerId);
  if (winningAnswer?.authorId === null && needsHouseAnswer(eligiblePlayers(state, now).length)) {
    for (const id of matchup.competitorIds) {
      const player = findPlayer(state, id);
      if (player !== undefined) player.stats.houseLosses += 1;
    }
  }

  applyEvents(state, outcome.events);

  matchup.resolved = {
    winningAnswerId: outcome.winningAnswerId,
    tiedAnswerIds: outcome.tiedAnswerIds,
    wasCoinFlip: outcome.wasCoinFlip,
    wasCleanSweep: outcome.wasCleanSweep,
    nobodyVoted: votes.size === 0,
    voteCounts: outcome.voteCounts,
    events: outcome.events,
  };

  // Write the winner into the story.
  if (winningAnswer !== undefined) {
    const author = winningAnswer.authorId === null ? undefined : findPlayer(state, winningAnswer.authorId);
    match.fills[fillKey(matchup.storyId, matchup.slotId)] = {
      storyId: matchup.storyId,
      slotId: matchup.slotId,
      text: winningAnswer.text,
      authorId: winningAnswer.authorId,
      authorName: author?.name ?? 'THE HOUSE',
      authorAvatarId: author?.avatarId ?? null,
      matchupIndex: matchup.index,
    };
  }
}

/* ------------------------------------------------------------------ *
 * Progress
 * ------------------------------------------------------------------ */

export function isLastMatchup(state: RoomState): boolean {
  const match = state.match;
  return match === null || match.matchupIndex >= match.plan.length - 1;
}

export function advanceMatchupIndex(state: RoomState): void {
  if (state.match !== null) state.match.matchupIndex += 1;
}
