/**
 * BLURT — end-of-match awards.
 *
 * Every award is derived from a stat the game actually tracked. Nothing here is
 * random, and nothing is decorative: if an award appears, a specific number earned
 * it, and the detail line says which number.
 *
 * Every award also has a documented "nobody qualified" outcome, so the awards screen
 * is never blank and never claims something absurd. That fallback is a real design
 * artefact — it is what the room reads out loud when the category didn't happen.
 */

import type { Award, PlayerStats } from './types.js';

export interface AwardCandidate {
  id: string;
  name: string;
  avatarId: string;
  score: number;
  stats: PlayerStats;
}

export interface AwardContext {
  candidates: readonly AwardCandidate[];
  /** Players who were in the match, including anyone who dropped. */
  playerCount: number;
  drawingFinalePlayed: boolean;
}

interface AwardDefinition {
  id: string;
  title: string;
  blurb: string;
  /** Shown when nobody qualifies. Never blank. */
  emptyDetail: string;
  /** Skip the award entirely (not even a fallback) when this returns false. */
  applies?: (ctx: AwardContext) => boolean;
  /** Higher is better; return null to disqualify a candidate. */
  score: (c: AwardCandidate, ctx: AwardContext) => number | null;
  /** Evidence string for the winner. */
  detail: (c: AwardCandidate) => string;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export const AWARD_DEFINITIONS: readonly AwardDefinition[] = [
  {
    id: 'most_votes',
    title: 'MOST VOTES',
    blurb: 'The people have spoken, repeatedly.',
    emptyDetail: 'Nobody voted for anybody. Bleak.',
    score: (c) => (c.stats.votesReceived > 0 ? c.stats.votesReceived : null),
    detail: (c) => plural(c.stats.votesReceived, 'vote', 'votes'),
  },
  {
    id: 'crowd_pleaser',
    title: 'CROWD PLEASER',
    blurb: 'Highest win rate. Alarmingly consistent.',
    emptyDetail: 'Nobody played enough rounds to prove anything.',
    score: (c) => (c.stats.appearances >= 2 ? c.stats.wins / c.stats.appearances : null),
    detail: (c) =>
      `${c.stats.wins}/${c.stats.appearances} matchups (${Math.round(
        (c.stats.wins / Math.max(1, c.stats.appearances)) * 100,
      )}%)`,
  },
  {
    id: 'professional_liar',
    title: 'PROFESSIONAL LIAR',
    blurb: 'Wrote decoys people believed. Genuinely concerning.',
    emptyDetail: 'Every decoy failed. This group is too honest.',
    applies: (ctx) => ctx.drawingFinalePlayed,
    score: (c) => (c.stats.playersFooled > 0 ? c.stats.playersFooled : null),
    detail: (c) => `fooled ${plural(c.stats.playersFooled, 'player', 'players')}`,
  },
  {
    id: 'questionable_artist',
    title: 'QUESTIONABLE ARTIST',
    blurb: 'Drew something. Nobody could tell what.',
    emptyDetail: 'Every drawing was identified. Suspiciously competent room.',
    applies: (ctx) => ctx.drawingFinalePlayed,
    score: (c) =>
      c.stats.drawingsMade >= 1 && c.stats.drawingsIdentified === 0 ? c.stats.drawingsMade : null,
    detail: (c) => `${plural(c.stats.drawingsMade, 'drawing', 'drawings')}, zero recognised`,
  },
  {
    id: 'picassos_disappointment',
    title: "PICASSO'S DISAPPOINTMENT",
    blurb: 'Technically drew. Debatably communicated.',
    emptyDetail: 'Nobody drew anything. Cowards.',
    applies: (ctx) => ctx.drawingFinalePlayed,
    // Fewest identifications among people who actually drew → negate for "higher is better".
    score: (c) => (c.stats.drawingsMade >= 1 ? -c.stats.drawingsIdentified : null),
    detail: (c) => `${plural(c.stats.drawingsIdentified, 'person', 'people')} worked it out`,
  },
  {
    id: 'human_red_flag',
    title: 'HUMAN RED FLAG',
    blurb: 'Kept winning the questions we should not have asked.',
    emptyDetail: 'Nobody leaned into the dark ones. Disappointing.',
    score: (c) => (c.stats.darkVotesReceived > 0 ? c.stats.darkVotesReceived : null),
    detail: (c) => `${plural(c.stats.darkVotesReceived, 'vote', 'votes')} on the unhinged prompts`,
  },
  {
    id: 'biggest_trainwreck',
    title: 'BIGGEST TRAINWRECK',
    blurb: 'On stage constantly. Winning almost never.',
    emptyDetail: 'Everybody won something. Weirdly wholesome.',
    score: (c) => {
      if (c.stats.appearances < 2) return null;
      const losses = c.stats.appearances - c.stats.wins;
      return losses > 0 ? losses * 10 + c.stats.appearances : null;
    },
    detail: (c) =>
      `${plural(c.stats.appearances, 'appearance', 'appearances')}, ${plural(c.stats.wins, 'win', 'wins')}`,
  },
  {
    id: 'what_is_wrong_with_you',
    title: 'WHAT IS WRONG WITH YOU',
    blurb: 'Wrote an entire paragraph. It won anyway.',
    emptyDetail: 'Everyone kept it short. How restrained.',
    score: (c) => (c.stats.longestWinningAnswer > 0 ? c.stats.longestWinningAnswer : null),
    detail: (c) => `${c.stats.longestWinningAnswer}-character winning answer`,
  },
  {
    id: 'ghost',
    title: 'GHOST',
    blurb: 'The house wrote their material for them.',
    emptyDetail: 'Nobody missed a deadline. Frankly unsettling.',
    score: (c) => (c.stats.fallbackFills > 0 ? c.stats.fallbackFills : null),
    detail: (c) => `${plural(c.stats.fallbackFills, 'timeout', 'timeouts')}`,
  },
  {
    id: 'outplayed_by_the_house',
    title: 'OUTPLAYED BY THE HOUSE',
    blurb: 'Lost a round to a pre-written answer. It has no thoughts.',
    emptyDetail: 'The house went home empty-handed.',
    applies: (ctx) => ctx.playerCount === 2,
    score: (c) => (c.stats.houseLosses > 0 ? c.stats.houseLosses : null),
    detail: (c) => `${plural(c.stats.houseLosses, 'round', 'rounds')} lost to a computer`,
  },
];

/**
 * Compute the awards screen.
 *
 * Ties are broken by (a) preferring somebody who has not already won an award, so the
 * screen spreads the love, then (b) higher match score, then (c) player id for
 * determinism. No randomness anywhere.
 */
export function computeAwards(ctx: AwardContext): Award[] {
  const alreadyHonoured = new Set<string>();
  const awards: Award[] = [];

  for (const definition of AWARD_DEFINITIONS) {
    if (definition.applies !== undefined && !definition.applies(ctx)) continue;

    let best: { candidate: AwardCandidate; value: number } | null = null;
    for (const candidate of ctx.candidates) {
      const value = definition.score(candidate, ctx);
      if (value === null) continue;
      if (best === null || betterThan(candidate, value, best, alreadyHonoured)) {
        best = { candidate, value };
      }
    }

    if (best === null) {
      awards.push({
        id: definition.id,
        title: definition.title,
        blurb: definition.blurb,
        winnerId: null,
        winnerName: 'NOBODY',
        winnerAvatarId: null,
        detail: definition.emptyDetail,
      });
      continue;
    }

    alreadyHonoured.add(best.candidate.id);
    awards.push({
      id: definition.id,
      title: definition.title,
      blurb: definition.blurb,
      winnerId: best.candidate.id,
      winnerName: best.candidate.name,
      winnerAvatarId: best.candidate.avatarId,
      detail: definition.detail(best.candidate),
    });
  }

  return awards;
}

function betterThan(
  candidate: AwardCandidate,
  value: number,
  best: { candidate: AwardCandidate; value: number },
  alreadyHonoured: ReadonlySet<string>,
): boolean {
  if (value !== best.value) return value > best.value;

  const candidateFresh = !alreadyHonoured.has(candidate.id);
  const bestFresh = !alreadyHonoured.has(best.candidate.id);
  if (candidateFresh !== bestFresh) return candidateFresh;

  if (candidate.score !== best.candidate.score) return candidate.score > best.candidate.score;
  return candidate.id.localeCompare(best.candidate.id) < 0;
}
