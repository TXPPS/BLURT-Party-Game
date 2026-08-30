import { describe, expect, it } from 'vitest';
import { AWARD_DEFINITIONS, computeAwards, type AwardCandidate } from '../shared/awards.js';
import { emptyStats, type PlayerStats } from '../shared/types.js';

function candidate(id: string, stats: Partial<PlayerStats>, score = 0): AwardCandidate {
  return { id, name: id.toUpperCase(), avatarId: 'raccoon', score, stats: { ...emptyStats(), ...stats } };
}

const finaleContext = (candidates: AwardCandidate[], playerCount = candidates.length) => ({
  candidates,
  playerCount,
  drawingFinalePlayed: true,
});

describe('every award always resolves to something printable', () => {
  it('produces a fallback line rather than a blank when nobody qualifies', () => {
    const blank = [candidate('a', {}), candidate('b', {})];
    const awards = computeAwards(finaleContext(blank));
    expect(awards.length).toBeGreaterThan(0);
    for (const award of awards) {
      expect(award.title.length).toBeGreaterThan(0);
      expect(award.detail.length).toBeGreaterThan(0);
      expect(award.winnerName.length).toBeGreaterThan(0);
    }
  });

  it('covers every player count from 2 to 10 with no empty details', () => {
    for (let n = 2; n <= 10; n += 1) {
      const candidates = Array.from({ length: n }, (_, i) =>
        candidate(`p${i}`, { appearances: 2, wins: i % 2, votesReceived: i }, i * 100),
      );
      for (const finale of [true, false]) {
        const awards = computeAwards({ candidates, playerCount: n, drawingFinalePlayed: finale });
        expect(awards.length).toBeGreaterThan(0);
        for (const award of awards) expect(award.detail.trim()).not.toBe('');
      }
    }
  });

  it('hides finale awards entirely when the finale did not run', () => {
    const awards = computeAwards({
      candidates: [candidate('a', {}), candidate('b', {})],
      playerCount: 2,
      drawingFinalePlayed: false,
    });
    const ids = awards.map((a) => a.id);
    expect(ids).not.toContain('professional_liar');
    expect(ids).not.toContain('questionable_artist');
    expect(ids).not.toContain('picassos_disappointment');
  });

  it('only offers OUTPLAYED BY THE HOUSE in a two-player match', () => {
    const two = computeAwards(finaleContext([candidate('a', { houseLosses: 2 }), candidate('b', {})], 2));
    expect(two.map((a) => a.id)).toContain('outplayed_by_the_house');

    const four = computeAwards(
      finaleContext(
        [candidate('a', { houseLosses: 2 }), candidate('b', {}), candidate('c', {}), candidate('d', {})],
        4,
      ),
    );
    expect(four.map((a) => a.id)).not.toContain('outplayed_by_the_house');
  });
});

describe('award derivation is real, not decorative', () => {
  it('MOST VOTES goes to the highest votesReceived', () => {
    const awards = computeAwards(
      finaleContext([
        candidate('a', { votesReceived: 3 }),
        candidate('b', { votesReceived: 9 }),
        candidate('c', { votesReceived: 1 }),
      ]),
    );
    const award = awards.find((a) => a.id === 'most_votes');
    expect(award?.winnerId).toBe('b');
    expect(award?.detail).toBe('9 votes');
  });

  it('CROWD PLEASER needs at least two appearances', () => {
    const awards = computeAwards(
      finaleContext([
        candidate('a', { appearances: 1, wins: 1 }), // 100% but only one appearance
        candidate('b', { appearances: 4, wins: 3 }),
      ]),
    );
    const award = awards.find((a) => a.id === 'crowd_pleaser');
    expect(award?.winnerId).toBe('b');
    expect(award?.detail).toContain('3/4');
  });

  it('QUESTIONABLE ARTIST requires a drawing that nobody identified', () => {
    const awards = computeAwards(
      finaleContext([
        candidate('a', { drawingsMade: 1, drawingsIdentified: 2 }),
        candidate('b', { drawingsMade: 1, drawingsIdentified: 0 }),
      ]),
    );
    expect(awards.find((a) => a.id === 'questionable_artist')?.winnerId).toBe('b');
  });

  it("PICASSO'S DISAPPOINTMENT takes the fewest identifications among people who drew", () => {
    const awards = computeAwards(
      finaleContext([
        candidate('a', { drawingsMade: 1, drawingsIdentified: 4 }),
        candidate('b', { drawingsMade: 1, drawingsIdentified: 1 }),
        candidate('c', { drawingsMade: 0, drawingsIdentified: 0 }),
      ]),
    );
    expect(awards.find((a) => a.id === 'picassos_disappointment')?.winnerId).toBe('b');
  });

  it('BIGGEST TRAINWRECK wants appearances without wins', () => {
    const awards = computeAwards(
      finaleContext([
        candidate('a', { appearances: 6, wins: 5 }),
        candidate('b', { appearances: 6, wins: 0 }),
        candidate('c', { appearances: 1, wins: 0 }),
      ]),
    );
    expect(awards.find((a) => a.id === 'biggest_trainwreck')?.winnerId).toBe('b');
  });

  it('GHOST counts the house answering on your behalf', () => {
    const awards = computeAwards(
      finaleContext([candidate('a', { fallbackFills: 1 }), candidate('b', { fallbackFills: 4 })]),
    );
    const award = awards.find((a) => a.id === 'ghost');
    expect(award?.winnerId).toBe('b');
    expect(award?.detail).toBe('4 timeouts');
  });

  it('WHAT IS WRONG WITH YOU reports the actual character count', () => {
    const awards = computeAwards(
      finaleContext([candidate('a', { longestWinningAnswer: 41 }), candidate('b', { longestWinningAnswer: 157 })]),
    );
    const award = awards.find((a) => a.id === 'what_is_wrong_with_you');
    expect(award?.winnerId).toBe('b');
    expect(award?.detail).toContain('157');
  });

  it('is entirely deterministic — the same stats always produce the same screen', () => {
    const candidates = [
      candidate('a', { votesReceived: 4, appearances: 3, wins: 2 }, 500),
      candidate('b', { votesReceived: 4, appearances: 3, wins: 2 }, 500),
    ];
    const first = computeAwards(finaleContext(candidates));
    for (let i = 0; i < 20; i += 1) {
      expect(computeAwards(finaleContext(candidates))).toEqual(first);
    }
  });

  it('spreads awards around when candidates are otherwise tied', () => {
    const candidates = [
      candidate('a', { votesReceived: 5, appearances: 2, wins: 1, fallbackFills: 2 }),
      candidate('b', { votesReceived: 5, appearances: 2, wins: 1, fallbackFills: 2 }),
    ];
    const winners = computeAwards(finaleContext(candidates))
      .filter((a) => a.winnerId !== null)
      .map((a) => a.winnerId);
    expect(new Set(winners).size).toBeGreaterThan(1);
  });
});

describe('award registry', () => {
  it('covers every award named in the design brief', () => {
    const ids = AWARD_DEFINITIONS.map((d) => d.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'most_votes',
        'crowd_pleaser',
        'professional_liar',
        'questionable_artist',
        'picassos_disappointment',
        'human_red_flag',
        'biggest_trainwreck',
        'what_is_wrong_with_you',
        'ghost',
        'outplayed_by_the_house',
      ]),
    );
  });

  it('gives every definition a non-empty fallback line', () => {
    for (const definition of AWARD_DEFINITIONS) {
      expect(definition.emptyDetail.trim().length, definition.id).toBeGreaterThan(0);
    }
  });
});
