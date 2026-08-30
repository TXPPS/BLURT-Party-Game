import { describe, expect, it } from 'vitest';
import {
  ARTIST_PERFECT_BONUS,
  ARTIST_PER_CORRECT,
  CLEAN_SWEEP_BONUS,
  DECOY_FOOLED_SOMEONE,
  GUESSER_CORRECT,
  MATCHUP_WIN,
  VOTE_RECEIVED,
  pointsByPlayer,
  resolveDrawing,
  resolveMatchup,
  totalPoints,
  type DrawingOption,
  type MatchupAnswer,
} from '../shared/scoring.js';
import { makeRng } from '../shared/rng.js';

const answers: MatchupAnswer[] = [
  { id: 'a1', authorId: 'p1', text: 'a wet glove', isFallback: false },
  { id: 'a2', authorId: 'p2', text: 'four hundred paperclips', isFallback: false },
];

const rng = () => makeRng(12345);

describe('resolveMatchup — votes', () => {
  it('pays every vote to its author, winner or loser', () => {
    const votes = new Map([
      ['v1', 'a1'],
      ['v2', 'a1'],
      ['v3', 'a2'],
    ]);
    const result = resolveMatchup(answers, votes, 3, rng());
    const totals = pointsByPlayer(result.events);
    expect(totals.get('p1')).toBe(VOTE_RECEIVED * 2 + MATCHUP_WIN);
    expect(totals.get('p2')).toBe(VOTE_RECEIVED * 1);
    expect(result.winningAnswerId).toBe('a1');
    expect(result.wasCleanSweep).toBe(false);
  });

  it('never pays the house', () => {
    const withHouse: MatchupAnswer[] = [
      answers[0] as MatchupAnswer,
      { id: 'house', authorId: null, text: 'a single wet glove', isFallback: true },
    ];
    const result = resolveMatchup(withHouse, new Map([['v1', 'house']]), 1, rng());
    expect(result.winningAnswerId).toBe('house');
    expect(pointsByPlayer(result.events).size).toBe(0);
    expect(totalPoints(result.events)).toBe(0);
  });

  it('still scores an answer the house wrote for a player who timed out', () => {
    const fallbackAnswers: MatchupAnswer[] = [
      { id: 'a1', authorId: 'p1', text: 'auto-filled', isFallback: true },
      answers[1] as MatchupAnswer,
    ];
    const result = resolveMatchup(fallbackAnswers, new Map([['v1', 'a1']]), 1, rng());
    expect(result.winningAnswerId).toBe('a1');
    expect(pointsByPlayer(result.events).get('p1')).toBe(VOTE_RECEIVED + MATCHUP_WIN);
  });
});

describe('resolveMatchup — clean sweep', () => {
  it('awards the bonus when one answer takes every vote from ≥2 voters', () => {
    const votes = new Map([
      ['v1', 'a1'],
      ['v2', 'a1'],
    ]);
    const result = resolveMatchup(answers, votes, 2, rng());
    expect(result.wasCleanSweep).toBe(true);
    expect(pointsByPlayer(result.events).get('p1')).toBe(
      VOTE_RECEIVED * 2 + MATCHUP_WIN + CLEAN_SWEEP_BONUS,
    );
  });

  it('does not award it with a single voter', () => {
    const result = resolveMatchup(answers, new Map([['v1', 'a1']]), 1, rng());
    expect(result.wasCleanSweep).toBe(false);
    expect(pointsByPlayer(result.events).get('p1')).toBe(VOTE_RECEIVED + MATCHUP_WIN);
  });

  it('does not award it when somebody abstained', () => {
    const result = resolveMatchup(answers, new Map([['v1', 'a1']]), 3, rng());
    expect(result.wasCleanSweep).toBe(false);
  });
});

describe('resolveMatchup — ties', () => {
  it('splits the win, rounds up, and keeps both vote payouts', () => {
    const votes = new Map([
      ['v1', 'a1'],
      ['v2', 'a2'],
    ]);
    const result = resolveMatchup(answers, votes, 2, rng());
    expect(result.wasCoinFlip).toBe(true);
    expect(result.tiedAnswerIds.sort()).toEqual(['a1', 'a2']);
    const totals = pointsByPlayer(result.events);
    const share = Math.ceil(MATCHUP_WIN / 2);
    expect(totals.get('p1')).toBe(VOTE_RECEIVED + share);
    expect(totals.get('p2')).toBe(VOTE_RECEIVED + share);
    expect(result.wasCleanSweep).toBe(false);
  });

  it('picks exactly one winner for the story even when tied', () => {
    const votes = new Map([
      ['v1', 'a1'],
      ['v2', 'a2'],
    ]);
    const result = resolveMatchup(answers, votes, 2, rng());
    expect(result.tiedAnswerIds).toContain(result.winningAnswerId);
  });

  it('treats "nobody voted" as a tie between everything and still picks a winner', () => {
    const result = resolveMatchup(answers, new Map(), 2, rng());
    expect(result.wasCoinFlip).toBe(true);
    expect(result.winningAnswerId).not.toBeNull();
    expect(totalPoints(result.events)).toBe(Math.ceil(MATCHUP_WIN / 2) * 2);
  });

  it('is deterministic for a given seed, so the coin flip can be announced', () => {
    const votes = new Map<string, string>();
    const a = resolveMatchup(answers, votes, 2, makeRng(777));
    const b = resolveMatchup(answers, votes, 2, makeRng(777));
    expect(a.winningAnswerId).toBe(b.winningAnswerId);
  });

  it('splits three ways when three answers tie', () => {
    const three: MatchupAnswer[] = [
      ...answers,
      { id: 'a3', authorId: 'p3', text: 'a third thing', isFallback: false },
    ];
    const result = resolveMatchup(three, new Map(), 3, rng());
    const share = Math.ceil(MATCHUP_WIN / 3);
    for (const id of ['p1', 'p2', 'p3']) {
      expect(pointsByPlayer(result.events).get(id)).toBe(share);
    }
  });

  it('handles an empty matchup without throwing', () => {
    const result = resolveMatchup([], new Map(), 0, rng());
    expect(result.winningAnswerId).toBeNull();
    expect(result.events).toEqual([]);
  });
});

describe('resolveDrawing', () => {
  const options: DrawingOption[] = [
    { id: 'real', authorId: null, text: 'a goose that has tasted lager', isReal: true },
    { id: 'd1', authorId: 'p2', text: 'a haunted bin', isReal: false },
    { id: 'd2', authorId: 'p3', text: 'two men arguing', isReal: false },
  ];

  it('pays the guesser and the artist for a correct pick', () => {
    const result = resolveDrawing('p1', options, new Map([['p2', 'real']]), 2);
    const totals = pointsByPlayer(result.events);
    expect(totals.get('p2')).toBe(GUESSER_CORRECT);
    expect(totals.get('p1')).toBe(ARTIST_PER_CORRECT);
    expect(result.correctVoterIds).toEqual(['p2']);
    expect(result.perfect).toBe(false);
  });

  it('pays the decoy author for each player fooled', () => {
    const votes = new Map([
      ['p3', 'd1'],
      ['p4', 'd1'],
    ]);
    const result = resolveDrawing('p1', options, votes, 2);
    expect(pointsByPlayer(result.events).get('p2')).toBe(DECOY_FOOLED_SOMEONE * 2);
    expect(result.fooledCounts['p2']).toBe(2);
    expect(pointsByPlayer(result.events).has('p1')).toBe(false);
  });

  it('adds the perfect bonus only when everyone got it', () => {
    const votes = new Map([
      ['p2', 'real'],
      ['p3', 'real'],
    ]);
    const result = resolveDrawing('p1', options, votes, 2);
    expect(result.perfect).toBe(true);
    expect(pointsByPlayer(result.events).get('p1')).toBe(
      ARTIST_PER_CORRECT * 2 + ARTIST_PERFECT_BONUS,
    );
  });

  it('ignores votes for options that do not exist', () => {
    const result = resolveDrawing('p1', options, new Map([['p2', 'nope']]), 2);
    expect(result.events).toEqual([]);
  });

  it('awards nothing at all when nobody voted', () => {
    const result = resolveDrawing('p1', options, new Map(), 3);
    expect(result.events).toEqual([]);
    expect(result.perfect).toBe(false);
  });
});
