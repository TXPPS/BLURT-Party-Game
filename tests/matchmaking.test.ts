import { describe, expect, it } from 'vitest';
import {
  appearanceSpread,
  competitorCount,
  needsHouseAnswer,
  selectCompetitors,
  selectVoters,
  votersForMatchup,
  type MatchmakingPlayer,
} from '../shared/matchmaking.js';
import { COMPETITORS_MAX, COMPETITORS_MIN } from '../shared/constants.js';
import { makeRng, roundSeed } from '../shared/rng.js';

function makePlayers(count: number): MatchmakingPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    appearances: 0,
    lastAppearanceRound: -1,
    eligible: true,
  }));
}

/** Play `rounds` matchups, mutating appearance bookkeeping exactly as the server does. */
function runMatch(playerCount: number, rounds: number, seed = 'room') {
  let players = makePlayers(playerCount);
  const history: string[][] = [];

  for (let round = 0; round < rounds; round += 1) {
    const rng = makeRng(roundSeed(seed, round, 'competitors'));
    const chosen = selectCompetitors(players, round, rng);
    history.push(chosen);
    players = players.map((p) =>
      chosen.includes(p.id)
        ? { ...p, appearances: p.appearances + 1, lastAppearanceRound: round }
        : p,
    );
  }

  return { players, history };
}

describe('competitorCount', () => {
  it.each([
    [2, 2],
    [3, 2],
    [4, 2],
    [5, 2],
    [9, 3],
    [10, 3],
  ])('uses a fixed count at %i players', (count, expected) => {
    expect(competitorCount(count, 0)).toBe(expected);
    expect(competitorCount(count, 1)).toBe(expected);
  });

  it('alternates 2 and 3 in the middle band', () => {
    for (const count of [6, 7, 8]) {
      expect(competitorCount(count, 0)).toBe(COMPETITORS_MIN);
      expect(competitorCount(count, 1)).toBe(COMPETITORS_MAX);
    }
  });

  it('never exceeds three or drops below two', () => {
    for (let count = 2; count <= 10; count += 1) {
      for (let round = 0; round < 6; round += 1) {
        const k = competitorCount(count, round);
        expect(k).toBeGreaterThanOrEqual(COMPETITORS_MIN);
        expect(k).toBeLessThanOrEqual(COMPETITORS_MAX);
        // Leaves at least two voters wherever the player count allows it.
        if (count >= 5) expect(count - k).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('fairness over 100 rounds', () => {
  for (const playerCount of [4, 5, 6, 7, 8, 9, 10]) {
    it(`keeps appearances within 1 at ${playerCount} players`, () => {
      const { players } = runMatch(playerCount, 100);
      const counts = players.map((p) => p.appearances);
      expect(appearanceSpread(counts)).toBeLessThanOrEqual(1);
      expect(Math.min(...counts)).toBeGreaterThan(0);
    });
  }

  it('holds across many different room seeds', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const { players } = runMatch(7, 25, `room-${seed}`);
      expect(appearanceSpread(players.map((p) => p.appearances))).toBeLessThanOrEqual(1);
    }
  });

  it('avoids back-to-back appearances whenever an alternative exists', () => {
    const { history } = runMatch(6, 60);
    let backToBack = 0;
    for (let i = 1; i < history.length; i += 1) {
      const previous = new Set(history[i - 1]);
      for (const id of history[i] ?? []) if (previous.has(id)) backToBack += 1;
    }
    expect(backToBack).toBe(0);
  });

  it('permits back-to-back only when there is genuinely no alternative', () => {
    // Three players, two competitors: somebody must repeat every third round.
    const { history } = runMatch(3, 30);
    for (const round of history) expect(round).toHaveLength(2);
    const counts = new Map<string, number>();
    for (const round of history) for (const id of round) counts.set(id, (counts.get(id) ?? 0) + 1);
    expect(appearanceSpread([...counts.values()])).toBeLessThanOrEqual(1);
  });

  it('is deterministic for a given room and round', () => {
    const a = selectCompetitors(makePlayers(8), 3, makeRng(roundSeed('ROOM', 3, 'competitors')));
    const b = selectCompetitors(makePlayers(8), 3, makeRng(roundSeed('ROOM', 3, 'competitors')));
    expect(a).toEqual(b);
  });
});

describe('eligibility', () => {
  it('never selects an ineligible player', () => {
    const players = makePlayers(6).map((p, i) => ({ ...p, eligible: i % 2 === 0 }));
    for (let round = 0; round < 20; round += 1) {
      const chosen = selectCompetitors(players, round, makeRng(round));
      for (const id of chosen) expect(['p0', 'p2', 'p4']).toContain(id);
    }
  });

  it('returns nothing when nobody is eligible', () => {
    const players = makePlayers(4).map((p) => ({ ...p, eligible: false }));
    expect(selectCompetitors(players, 0, makeRng(1))).toEqual([]);
  });

  it('copes with a single eligible player', () => {
    const players = makePlayers(4).map((p, i) => ({ ...p, eligible: i === 0 }));
    expect(selectCompetitors(players, 0, makeRng(1))).toEqual(['p0']);
  });
});

describe('voters', () => {
  it('excludes competitors above two players', () => {
    const players = makePlayers(6);
    const voters = votersForMatchup(players, ['p0', 'p1']);
    expect(voters).not.toContain('p0');
    expect(voters).not.toContain('p1');
    expect(voters).toHaveLength(4);
  });

  it('leaves exactly one voter at three players', () => {
    expect(votersForMatchup(makePlayers(3), ['p0', 'p1'])).toEqual(['p2']);
  });

  it('lets both players vote at two players, with the house in the mix', () => {
    expect(needsHouseAnswer(2)).toBe(true);
    expect(votersForMatchup(makePlayers(2), ['p0', 'p1'])).toEqual(['p0', 'p1']);
    expect(selectVoters(makePlayers(2), ['p0', 'p1'])).toEqual([]);
  });

  it('does not inject the house above two players', () => {
    for (let count = 3; count <= 10; count += 1) expect(needsHouseAnswer(count)).toBe(false);
  });
});
