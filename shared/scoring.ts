/**
 * BLURT — scoring.
 *
 * Every point in the game is minted by a function in this file and emitted as a
 * `ScoreEvent`. Nothing anywhere else adds to a score directly. That gives the QA
 * harness a cheap, total invariant: recompute the events from the match log, sum
 * them, and compare against the leaderboard. If they disagree, something cheated.
 *
 * ── On the finale constants ────────────────────────────────────────────────────
 * The brief fixes the *standard round* values (100 / 250 / 200) and asks that the
 * drawing finale land at 25–35% of all points awarded, tuning constants until the
 * balance test passes. Those two requirements are in tension: a finale that pays
 * 300 per correct guess dominates a five-round match by a factor of two, because a
 * finale round mints a payout for *every* voter on *every* drawing.
 *
 * So the standard-round constants are kept exactly as specified — they are the
 * numbers players see every single round — and the finale constants are the ones
 * tuned, which is what `tests/scoring.balance.test.ts` governs. See GAME_DESIGN.md.
 */

import type { Rng } from './rng.js';
import { randomInt } from './rng.js';

/* ------------------------------------------------------------------ *
 * Standard round
 * ------------------------------------------------------------------ */

/** Paid to an answer's author for each vote it attracts. */
export const VOTE_RECEIVED = 100;

/** Paid to the author of the answer that wins a matchup. Split on a tie. */
export const MATCHUP_WIN = 250;

/** Bonus for taking every available vote. Requires at least two voters to exist. */
export const CLEAN_SWEEP_BONUS = 200;

/** A clean sweep is only meaningful when there was a real crowd to sweep. */
export const CLEAN_SWEEP_MIN_VOTERS = 2;

/* ------------------------------------------------------------------ *
 * Drawing finale
 * ------------------------------------------------------------------ */

/** Paid to a voter who picks the real prompt out of the decoys. */
export const GUESSER_CORRECT = 110;

/** Paid to a decoy's author for each player who falls for it. */
export const DECOY_FOOLED_SOMEONE = 65;

/** Paid to the artist for each player who identifies what they actually drew. */
export const ARTIST_PER_CORRECT = 70;

/** Paid to the artist when *everybody* identified the real prompt. */
export const ARTIST_PERFECT_BONUS = 140;

/**
 * The one knob that moves the finale's share of a match.
 *
 * The four payouts above are the values the design fixed, and they stay readable as
 * those values. Everybody drawing (rather than three people) put more artists in a
 * position to earn, which pushed the finale's share of total points up; scaling every
 * finale payout by one number brings it back without quietly rewriting the individual
 * figures and losing the reasoning behind each.
 *
 * Tuned against `tests/scoring.balance.test.ts`, which holds the share to 22–38%.
 */
export const FINALE_MULTIPLIER = 0.8;

/** Every finale payout goes through here, so the multiplier cannot be half-applied. */
export function finalePoints(base: number): number {
  return Math.round(base * FINALE_MULTIPLIER);
}

/* ------------------------------------------------------------------ *
 * Score events
 * ------------------------------------------------------------------ */

export type ScoreReason =
  | 'vote_received'
  | 'matchup_win'
  | 'matchup_win_shared'
  | 'clean_sweep'
  | 'guesser_correct'
  | 'decoy_fooled'
  | 'artist_identified'
  | 'artist_perfect'
  | 'artist_unshown';

export interface ScoreEvent {
  playerId: string;
  points: number;
  reason: ScoreReason;
}

/** Human-readable labels for the results screens. Keyed by reason so copy lives once. */
export const SCORE_REASON_LABELS: Readonly<Record<ScoreReason, string>> = {
  vote_received: 'Votes',
  matchup_win: 'Won the matchup',
  matchup_win_shared: 'Shared the win',
  clean_sweep: 'Clean sweep',
  guesser_correct: 'Nailed the prompt',
  decoy_fooled: 'Fooled somebody',
  artist_identified: 'Recognisable, somehow',
  artist_perfect: 'Everyone got it',
  artist_unshown: 'Gallery scale',
};

/**
 * What an artist earns when their drawing never made it to the showcase.
 *
 * Everybody draws, but only `DRAWING_SHOWCASE_MAX` drawings can be shown without the
 * finale costing a guess/vote/results cycle per player. That leaves artists who did
 * the work and had no chance to earn from it, which would be a straightforward
 * injustice — so they are paid the *median* of what the showcased artists actually
 * made on the night.
 *
 * Median rather than mean on purpose: one artist that everybody recognised should not
 * inflate what the unshown are owed, and one nobody got should not deflate it. Paying
 * the median means being left out is never better *or* worse than average luck.
 */
export function unshownArtistComp(showcasedArtistEarnings: readonly number[]): number {
  if (showcasedArtistEarnings.length === 0) return 0;
  const sorted = [...showcasedArtistEarnings].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? (sorted[mid] ?? 0)
      : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  return Math.round(median);
}

export function totalPoints(events: readonly ScoreEvent[]): number {
  return events.reduce((sum, event) => sum + event.points, 0);
}

export function pointsByPlayer(events: readonly ScoreEvent[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const event of events) {
    totals.set(event.playerId, (totals.get(event.playerId) ?? 0) + event.points);
  }
  return totals;
}

/* ------------------------------------------------------------------ *
 * Matchup resolution
 * ------------------------------------------------------------------ */

/** One answer in a head-to-head. `authorId` is null for THE HOUSE. */
export interface MatchupAnswer {
  readonly id: string;
  readonly authorId: string | null;
  readonly text: string;
  /** True when the house auto-filled for a player who ran out of time. */
  readonly isFallback: boolean;
}

export interface MatchupResolution {
  /** Votes each answer attracted, keyed by answer id. */
  voteCounts: Record<string, number>;
  /** The answer that goes into the story. Never null when at least one answer exists. */
  winningAnswerId: string | null;
  /** Every answer that tied for the lead — length > 1 means a coin flip happened. */
  tiedAnswerIds: string[];
  /** True when the lead was shared and the winner was drawn at random. */
  wasCoinFlip: boolean;
  /** True when a single answer took every vote and there were ≥2 voters. */
  wasCleanSweep: boolean;
  events: ScoreEvent[];
}

/**
 * Resolve one matchup into score events plus the answer that gets written into the
 * story. Pure: identical inputs and rng seed always produce the identical outcome,
 * which is what lets the coin flip be *announced* and still be trustworthy.
 *
 * @param votes  answerId per voter. A voter who timed out simply is not in the map.
 * @param voterCount how many people *could* have voted (drives the clean-sweep rule)
 */
export function resolveMatchup(
  answers: readonly MatchupAnswer[],
  votes: ReadonlyMap<string, string>,
  voterCount: number,
  rng: Rng,
): MatchupResolution {
  const voteCounts: Record<string, number> = {};
  for (const answer of answers) voteCounts[answer.id] = 0;
  for (const answerId of votes.values()) {
    if (answerId in voteCounts) voteCounts[answerId] = (voteCounts[answerId] ?? 0) + 1;
  }

  const events: ScoreEvent[] = [];

  // 1. Every vote pays its author, winner or not.
  for (const answer of answers) {
    const count = voteCounts[answer.id] ?? 0;
    if (count > 0 && answer.authorId !== null) {
      events.push({
        playerId: answer.authorId,
        points: VOTE_RECEIVED * count,
        reason: 'vote_received',
      });
    }
  }

  if (answers.length === 0) {
    return {
      voteCounts,
      winningAnswerId: null,
      tiedAnswerIds: [],
      wasCoinFlip: false,
      wasCleanSweep: false,
      events,
    };
  }

  // 2. Find the lead. Nobody voting leaves every answer on zero, which is a tie
  //    between all of them — resolved by the same announced coin flip.
  const best = Math.max(...answers.map((a) => voteCounts[a.id] ?? 0));
  const tied = answers.filter((a) => (voteCounts[a.id] ?? 0) === best);
  const tiedAnswerIds = tied.map((a) => a.id);
  const wasCoinFlip = tied.length > 1;

  const winner = wasCoinFlip ? tied[randomInt(rng, tied.length)] : tied[0];
  const winningAnswerId = winner?.id ?? null;

  // 3. The win itself. Shared leads split the pot, rounded up so nobody feels robbed.
  const share = wasCoinFlip ? Math.ceil(MATCHUP_WIN / tied.length) : MATCHUP_WIN;
  for (const answer of tied) {
    if (answer.authorId === null) continue;
    events.push({
      playerId: answer.authorId,
      points: share,
      reason: wasCoinFlip ? 'matchup_win_shared' : 'matchup_win',
    });
  }

  // 4. Clean sweep: one answer, every vote, a crowd worth sweeping.
  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0);
  const wasCleanSweep =
    !wasCoinFlip &&
    voterCount >= CLEAN_SWEEP_MIN_VOTERS &&
    totalVotes === voterCount &&
    best === voterCount;

  if (wasCleanSweep && winner?.authorId != null) {
    events.push({ playerId: winner.authorId, points: CLEAN_SWEEP_BONUS, reason: 'clean_sweep' });
  }

  return { voteCounts, winningAnswerId, tiedAnswerIds, wasCoinFlip, wasCleanSweep, events };
}

/* ------------------------------------------------------------------ *
 * Finale resolution
 * ------------------------------------------------------------------ */

/** One option on the drawing vote screen: the real prompt, or somebody's decoy. */
export interface DrawingOption {
  readonly id: string;
  /** Null for the real prompt; otherwise the player who wrote the decoy. */
  readonly authorId: string | null;
  readonly text: string;
  readonly isReal: boolean;
}

export interface DrawingResolution {
  voteCounts: Record<string, number>;
  /** Voters who picked the real prompt. */
  correctVoterIds: string[];
  /** decoyAuthorId → how many players they fooled. */
  fooledCounts: Record<string, number>;
  perfect: boolean;
  events: ScoreEvent[];
}

/**
 * Score one drawing. `votes` maps voterId → optionId; the artist is not a voter and
 * must not appear in it.
 */
export function resolveDrawing(
  artistId: string,
  options: readonly DrawingOption[],
  votes: ReadonlyMap<string, string>,
  eligibleVoterCount: number,
): DrawingResolution {
  const voteCounts: Record<string, number> = {};
  for (const option of options) voteCounts[option.id] = 0;

  const byId = new Map(options.map((o) => [o.id, o]));
  const correctVoterIds: string[] = [];
  const fooledCounts: Record<string, number> = {};
  const events: ScoreEvent[] = [];

  for (const [voterId, optionId] of votes) {
    const option = byId.get(optionId);
    if (option === undefined) continue;
    voteCounts[optionId] = (voteCounts[optionId] ?? 0) + 1;

    if (option.isReal) {
      correctVoterIds.push(voterId);
      events.push({ playerId: voterId, points: finalePoints(GUESSER_CORRECT), reason: 'guesser_correct' });
      events.push({
        playerId: artistId,
        points: finalePoints(ARTIST_PER_CORRECT),
        reason: 'artist_identified',
      });
    } else if (option.authorId !== null) {
      fooledCounts[option.authorId] = (fooledCounts[option.authorId] ?? 0) + 1;
      events.push({
        playerId: option.authorId,
        points: finalePoints(DECOY_FOOLED_SOMEONE),
        reason: 'decoy_fooled',
      });
    }
  }

  const perfect = eligibleVoterCount > 0 && correctVoterIds.length === eligibleVoterCount;
  if (perfect) {
    events.push({
      playerId: artistId,
      points: finalePoints(ARTIST_PERFECT_BONUS),
      reason: 'artist_perfect',
    });
  }

  return { voteCounts, correctVoterIds, fooledCounts, perfect, events };
}
