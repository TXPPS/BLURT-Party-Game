/**
 * BLURT — who competes, who votes.
 *
 * Fairness here is load-bearing for the comedy: a player who never gets picked has
 * nothing in the story, and a player picked twice in a row feels like they are doing
 * all the work. Both are prevented structurally rather than hoped for.
 *
 * The algorithm is *tiered least-appearances-first*:
 *   1. Everyone eligible is bucketed by how many times they have competed.
 *   2. Buckets are consumed lowest-first, so appearance counts can never spread by
 *      more than one (proof: incrementing the K smallest values of a multiset whose
 *      spread is ≤1 always yields a multiset whose spread is ≤1).
 *   3. *Inside* a bucket, anyone who competed in the immediately preceding matchup is
 *      pushed to the back, then longest-waiting first, then a seeded jitter.
 *
 * Because the back-to-back rule only reorders *within* a bucket, it can never break
 * the balance invariant — it simply stops applying when every eligible player is
 * level and was in the last round, which is exactly the "no eligible alternative
 * exists" escape hatch the design calls for.
 */

import {
  COMPETITORS_MAX,
  COMPETITORS_MIN,
  COMPETITORS_THREE_FROM,
  COMPETITORS_TWO_UP_TO,
  DRAWING_ARTISTS_LARGE_ROOM,
  DRAWING_LARGE_ROOM_FROM,
  DRAWING_MAX_ARTISTS,
  MATCHMAKING_BACK_TO_BACK_PENALTY,
  MATCHMAKING_W_RECENCY,
} from './constants.js';
import type { Rng } from './rng.js';

export interface MatchmakingPlayer {
  readonly id: string;
  /** How many matchups this player has already competed in this match. */
  readonly appearances: number;
  /** Index of the last matchup they competed in, or -1 if they never have. */
  readonly lastAppearanceRound: number;
  /** Connected, identified, and not inside a lapsed disconnect grace window. */
  readonly eligible: boolean;
}

/**
 * How many players go head to head this matchup.
 *
 * 2–5 players → 2. 6–8 → alternates 2 / 3 by matchup index so the count varies
 * without ever starving the voting pool. 9–10 → 3.
 */
export function competitorCount(eligibleCount: number, matchupIndex: number): number {
  if (eligibleCount <= COMPETITORS_TWO_UP_TO) return COMPETITORS_MIN;
  if (eligibleCount >= COMPETITORS_THREE_FROM) return COMPETITORS_MAX;
  return matchupIndex % 2 === 0 ? COMPETITORS_MIN : COMPETITORS_MAX;
}

/**
 * At exactly two players there is nobody left to vote impartially, so THE HOUSE
 * enters the matchup with an answer from the slot's fallback pool.
 */
export function needsHouseAnswer(eligibleCount: number): boolean {
  return eligibleCount === 2;
}

/** Select the competitors for one matchup. Deterministic for a given `rng` seed. */
export function selectCompetitors(
  players: readonly MatchmakingPlayer[],
  matchupIndex: number,
  rng: Rng,
): string[] {
  const eligible = players.filter((p) => p.eligible);
  if (eligible.length === 0) return [];

  const wanted = Math.min(competitorCount(eligible.length, matchupIndex), eligible.length);

  const byAppearances = new Map<number, MatchmakingPlayer[]>();
  for (const player of eligible) {
    const bucket = byAppearances.get(player.appearances);
    if (bucket === undefined) byAppearances.set(player.appearances, [player]);
    else bucket.push(player);
  }

  // Jitter is drawn once per player so the ordering is stable within this call.
  const jitter = new Map<string, number>();
  for (const player of eligible) jitter.set(player.id, rng.next());

  const previousMatchup = matchupIndex - 1;
  const rank = (player: MatchmakingPlayer): number => {
    const waited =
      player.lastAppearanceRound < 0
        ? matchupIndex + 1
        : matchupIndex - player.lastAppearanceRound;
    const backToBack =
      player.lastAppearanceRound === previousMatchup && previousMatchup >= 0
        ? MATCHMAKING_BACK_TO_BACK_PENALTY
        : 0;
    return MATCHMAKING_W_RECENCY * waited - backToBack + (jitter.get(player.id) ?? 0);
  };

  const selected: string[] = [];
  const tiers = [...byAppearances.keys()].sort((a, b) => a - b);
  for (const tier of tiers) {
    if (selected.length >= wanted) break;
    const bucket = (byAppearances.get(tier) ?? []).slice().sort((a, b) => {
      const diff = rank(b) - rank(a);
      // Ids as the final tiebreak keep the result stable across engines.
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });
    for (const player of bucket) {
      if (selected.length >= wanted) break;
      selected.push(player.id);
    }
  }

  return selected;
}

/**
 * Everyone eligible who is not competing. At two players this is empty, which is
 * exactly why `needsHouseAnswer` exists — there the competitors vote on each other.
 */
export function selectVoters(
  players: readonly MatchmakingPlayer[],
  competitorIds: readonly string[],
): string[] {
  const competing = new Set(competitorIds);
  return players.filter((p) => p.eligible && !competing.has(p.id)).map((p) => p.id);
}

/**
 * At two players both competitors also vote (they simply cannot vote for
 * themselves). Above that, competitors sit out the vote.
 */
export function votersForMatchup(
  players: readonly MatchmakingPlayer[],
  competitorIds: readonly string[],
): string[] {
  const eligible = players.filter((p) => p.eligible);
  if (needsHouseAnswer(eligible.length)) return eligible.map((p) => p.id);
  return selectVoters(players, competitorIds);
}

/**
 * How many drawings the finale runs.
 *
 * Small rooms: everybody draws once (up to four). Big rooms: three drawings, chosen
 * lowest-score-first as a comeback mechanic. Always capped by how many drawable
 * subjects the story actually produced — a three-round match cannot supply four.
 */
export function artistCount(eligibleCount: number, availablePrompts: number): number {
  const byRoomSize =
    eligibleCount >= DRAWING_LARGE_ROOM_FROM ? DRAWING_ARTISTS_LARGE_ROOM : DRAWING_MAX_ARTISTS;
  return Math.max(0, Math.min(eligibleCount, availablePrompts, byRoomSize));
}

/**
 * Pick the artists: lowest score first, so the finale is a genuine comeback slot.
 * Ties break on player id, keeping the choice reproducible in tests and replays.
 */
export function selectArtists(
  players: readonly { id: string; score: number; eligible: boolean }[],
  availablePrompts: number,
): string[] {
  const eligible = players.filter((p) => p.eligible);
  const wanted = artistCount(eligible.length, availablePrompts);
  return [...eligible]
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
    .slice(0, wanted)
    .map((p) => p.id);
}

/** Test/diagnostic helper: the spread between the busiest and quietest player. */
export function appearanceSpread(appearances: readonly number[]): number {
  if (appearances.length === 0) return 0;
  return Math.max(...appearances) - Math.min(...appearances);
}
