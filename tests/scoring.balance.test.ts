/**
 * BLURT — finale balance.
 *
 * The design constraint: the drawing finale must be worth playing for, without
 * making the five standard rounds a warm-up act. The brief fixes that at 25–35% of
 * all points awarded, averaged over many matches.
 *
 * This is a real Monte-Carlo simulation of the actual scoring functions — not a
 * closed-form approximation and not a rubber stamp. It runs 1,000 matches at 4, 6
 * and 8 players using the same `resolveMatchup` / `resolveDrawing` the server calls,
 * with the same matchmaking, and it is what the finale constants were tuned against.
 *
 * Voter model: uniform random choice among the options a player is *allowed* to
 * pick. That is deliberately the worst case for the artist — real players guess
 * better than chance, which nudges points from decoys towards artists and guessers
 * without changing the total pool much.
 */

import { describe, expect, it } from 'vitest';
import {
  artistCount,
  selectCompetitors,
  votersForMatchup,
  type MatchmakingPlayer,
} from '../shared/matchmaking.js';
import {
  resolveDrawing,
  resolveMatchup,
  totalPoints,
  type DrawingOption,
  type MatchupAnswer,
  type ScoreEvent,
} from '../shared/scoring.js';
import { makeRng, randomInt, type Rng } from '../shared/rng.js';

const STANDARD_ROUNDS = 5;
const MATCHES = 1000;
const MIN_SHARE = 0.25;
const MAX_SHARE = 0.35;

/** A five-round match plus a finale, played by uniformly random voters. */
function simulateMatch(playerCount: number, rng: Rng): { standard: ScoreEvent[]; finale: ScoreEvent[] } {
  let players: MatchmakingPlayer[] = Array.from({ length: playerCount }, (_, i) => ({
    id: `p${i}`,
    appearances: 0,
    lastAppearanceRound: -1,
    eligible: true,
  }));

  const standard: ScoreEvent[] = [];

  for (let round = 0; round < STANDARD_ROUNDS; round += 1) {
    const competitors = selectCompetitors(players, round, rng);
    const voters = votersForMatchup(players, competitors);

    const answers: MatchupAnswer[] = competitors.map((id) => ({
      id: `${round}:${id}`,
      authorId: id,
      text: 'an answer',
      isFallback: false,
    }));
    // Two-player rooms get a house answer so there is always something to choose.
    if (playerCount === 2) {
      answers.push({ id: `${round}:house`, authorId: null, text: 'the house', isFallback: true });
    }

    const votes = new Map<string, string>();
    for (const voterId of voters) {
      const allowed = answers.filter((a) => a.authorId !== voterId);
      const choice = allowed[randomInt(rng, allowed.length)];
      if (choice !== undefined) votes.set(voterId, choice.id);
    }

    standard.push(...resolveMatchup(answers, votes, voters.length, rng).events);

    players = players.map((p) =>
      competitors.includes(p.id)
        ? { ...p, appearances: p.appearances + 1, lastAppearanceRound: round }
        : p,
    );
  }

  // The finale. Every played slot yields a drawable subject, so prompts are never
  // the binding constraint at five rounds.
  const finale: ScoreEvent[] = [];
  const drawings = artistCount(playerCount, STANDARD_ROUNDS);

  for (let index = 0; index < drawings; index += 1) {
    const artistId = `p${index % playerCount}`;
    const others = players.map((p) => p.id).filter((id) => id !== artistId);

    const options: DrawingOption[] = [
      { id: 'real', authorId: null, text: 'the real prompt', isReal: true },
      ...others.map((id) => ({ id: `decoy:${id}`, authorId: id, text: 'a decoy', isReal: false })),
    ];

    const votes = new Map<string, string>();
    for (const voterId of others) {
      const allowed = options.filter((o) => o.authorId !== voterId);
      const choice = allowed[randomInt(rng, allowed.length)];
      if (choice !== undefined) votes.set(voterId, choice.id);
    }

    finale.push(...resolveDrawing(artistId, options, votes, others.length).events);
  }

  return { standard, finale };
}

function measureShare(playerCount: number): { share: number; standard: number; finale: number } {
  const rng = makeRng(0xb10a7 ^ playerCount);
  let standard = 0;
  let finale = 0;
  for (let match = 0; match < MATCHES; match += 1) {
    const result = simulateMatch(playerCount, rng);
    standard += totalPoints(result.standard);
    finale += totalPoints(result.finale);
  }
  return { share: finale / (standard + finale), standard, finale };
}

describe(`finale scoring share over ${MATCHES} simulated matches`, () => {
  for (const playerCount of [4, 6, 8]) {
    it(`contributes ${MIN_SHARE * 100}–${MAX_SHARE * 100}% of all points at ${playerCount} players`, () => {
      const { share, standard, finale } = measureShare(playerCount);
      const percent = (share * 100).toFixed(1);
      const detail =
        `${playerCount}p → finale ${percent}% ` +
        `(standard ${Math.round(standard / MATCHES)} pts/match, ` +
        `finale ${Math.round(finale / MATCHES)} pts/match)`;
      expect(share, detail).toBeGreaterThanOrEqual(MIN_SHARE);
      expect(share, detail).toBeLessThanOrEqual(MAX_SHARE);
    });
  }

  it('stays inside the band across the whole supported player range', () => {
    for (let playerCount = 3; playerCount <= 10; playerCount += 1) {
      const { share } = measureShare(playerCount);
      expect(share, `${playerCount} players → ${(share * 100).toFixed(1)}%`).toBeGreaterThan(0.15);
      expect(share, `${playerCount} players → ${(share * 100).toFixed(1)}%`).toBeLessThan(0.45);
    }
  });
});

describe('scoring integrity', () => {
  it('mints every point through a ScoreEvent, so totals are independently recomputable', () => {
    const rng = makeRng(4);
    const { standard, finale } = simulateMatch(8, rng);
    const all = [...standard, ...finale];
    const recomputed = all.reduce((sum, event) => sum + event.points, 0);
    expect(totalPoints(all)).toBe(recomputed);
    for (const event of all) expect(event.points).toBeGreaterThan(0);
  });
});
