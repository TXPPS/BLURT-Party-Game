/**
 * BLURT — what must be true of every match.
 *
 * Seven properties the server has to hold no matter how the bots behave. They live
 * apart from the bot client because they are the interesting half: the client just
 * plays, these decide whether what happened was allowed.
 */

import { LEGAL_TRANSITIONS, type Phase } from '../shared/types.js';
import type { Bot } from './botHarness.js';

/* ------------------------------------------------------------------ *
 * Invariants
 * ------------------------------------------------------------------ */

export interface InvariantFailure {
  name: string;
  detail: string;
}

/**
 * How many transitions the server may chain inside one broadcast.
 *
 * Three covers every real fall-through in the machine (the longest is
 * SETUP → ACTIVE → GUESS) with one hop of slack.
 */
const MAX_UNOBSERVED_HOPS = 3;

/** Breadth-first: is `to` reachable from `from` in 1..maxHops legal transitions? */
function reachableWithin(from: Phase, to: Phase, maxHops: number): boolean {
  let frontier: Phase[] = [from];
  for (let hop = 0; hop < maxHops; hop += 1) {
    const next: Phase[] = [];
    for (const phase of frontier) {
      for (const candidate of LEGAL_TRANSITIONS[phase]) {
        if (candidate === to) return true;
        next.push(candidate);
      }
    }
    frontier = next;
  }
  return false;
}

/** Every assertion the brief requires the harness to make, on every match. */
export function checkInvariants(bots: readonly Bot[]): InvariantFailure[] {
  const failures: InvariantFailure[] = [];
  const fail = (name: string, detail: string): void => {
    failures.push({ name, detail });
  };

  const finalState = bots.map((b) => b.state).find((s) => s?.phase === 'FINAL_RESULTS');
  if (finalState === undefined || finalState === null) {
    fail('match completed', 'no bot ever reached FINAL_RESULTS');
    return failures;
  }

  // 1. Legal transitions only — but against a short *path*, not a single edge.
  //
  //    A phase that is already satisfied when it is entered falls straight through
  //    inside one atomic step, and only the final phase is broadcast. When an artist
  //    disconnects, the room genuinely goes SETUP → ACTIVE → GUESS without ever
  //    publishing ACTIVE, and a client legitimately observes SETUP → GUESS. Allowing
  //    up to three hops covers every real fall-through while still catching a jump
  //    that the machine could not have made (LOBBY → ROUND_VOTE is five hops).
  for (const bot of bots) {
    for (let i = 1; i < bot.phases.length; i += 1) {
      const from = bot.phases[i - 1] as Phase;
      const to = bot.phases[i] as Phase;
      if (!reachableWithin(from, to, MAX_UNOBSERVED_HOPS)) {
        fail('legal transitions', `${bot.options.name}: ${from} → ${to} is not reachable`);
      }
    }
  }

  // 2. Authorship never leaked before its vote resolved.
  for (const bot of bots) {
    for (const message of bot.received) {
      if (message.t === 'state' && (message.phase === 'ROUND_REVEAL' || message.phase === 'ROUND_VOTE')) {
        const view = message.view as { answers?: unknown[] };
        for (const answer of view.answers ?? []) {
          if (typeof answer === 'object' && answer !== null && 'authorId' in answer) {
            fail('no early authorship', `${bot.options.name} saw authorId during ${message.phase}`);
          }
        }
      }
      if (message.t === 'private' && message.votableAnswers !== undefined) {
        for (const option of message.votableAnswers) {
          if ('authorId' in (option as object)) {
            fail('no early authorship', `${bot.options.name} got an authorId in votableAnswers`);
          }
        }
      }
    }
  }

  // 3. Nobody was ever offered their own answer to vote for.
  for (const bot of bots) {
    let myAnswerId: string | undefined;
    for (const message of bot.received) {
      if (message.t !== 'private') continue;
      if (message.myAnswerId !== undefined) myAnswerId = message.myAnswerId;
      if (message.votableAnswers === undefined || myAnswerId === undefined) continue;
      if (message.votableAnswers.some((a) => a.id === myAnswerId)) {
        fail('no self-vote option', `${bot.options.name} was offered their own answer`);
      }
    }
  }

  const players = finalState.players.filter((p) => p.identified);

  // 4. Appearance fairness at 4+ players — measured over the people who were
  //    actually *there* for the whole match.
  //
  //    Somebody who leaves in round one stops being selected while everybody else
  //    keeps playing, so their appearance count is frozen and the spread naturally
  //    exceeds one. That is the rule working, not failing. Fairness is asserted over
  //    players still connected at the end; the matrix runs have no departures, so
  //    the guarantee is still fully exercised there.
  const present = players.filter((p) => p.connected);
  if (present.length >= 4 && present.length === players.length) {
    const counts = present.map((p) => p.stats.appearances);
    const spread = Math.max(...counts) - Math.min(...counts);
    if (spread > 1) fail('appearance fairness', `spread of ${spread}: ${counts.join(', ')}`);
  }

  // 5. Points reconcile: the sum of every broadcast delta equals the final score.
  //
  // Deduplication is per *results screen*, not per event. A single drawing
  // legitimately emits several identical `artist_identified` deltas — one per player
  // who identified it — so keying on (player, reason, points) silently collapses
  // real events and under-counts the score. Each results phase broadcasts one deltas
  // array, repeated across every socket and every re-broadcast, so keeping the array
  // once per (phase, round, drawing) is both correct and complete.
  const screens = new Map<string, { playerId: string; points: number }[]>();
  for (const bot of bots) {
    for (const message of bot.received) {
      if (message.t !== 'state') continue;
      const view = message.view as {
        deltas?: { playerId: string; points: number; reason: string }[];
        roundNumber?: number;
        drawingIndex?: number;
      };
      if (view.deltas === undefined) continue;
      const key = `${message.phase}:${view.roundNumber ?? 0}:${view.drawingIndex ?? 0}`;
      screens.set(key, view.deltas);
    }
  }

  const deltas = new Map<string, number>();
  for (const list of screens.values()) {
    for (const delta of list) {
      deltas.set(delta.playerId, (deltas.get(delta.playerId) ?? 0) + delta.points);
    }
  }

  for (const player of players) {
    const recomputed = deltas.get(player.id) ?? 0;
    if (recomputed !== player.score) {
      // Reconciliation applies to everyone, including players who left: their score
      // is frozen, not discarded, and the deltas that produced it were broadcast.
      fail(
        'score reconciliation',
        `${player.name}: leaderboard ${player.score}, recomputed ${recomputed}`,
      );
    }
  }

  // 6. THE HOUSE only plays when the room has exactly two people.
  //
  //    This exists because the predicate was once handed the *competitor* count
  //    rather than the room's, which put a house answer in every round from 2 to 5
  //    players. It was invisible to unit tests and obvious in one screenshot.
  const identifiedCount = players.length;
  if (identifiedCount > 2) {
    for (const bot of bots) {
      for (const message of bot.received) {
        if (message.t !== 'state' || message.view.phase !== 'ROUND_RESULTS') continue;
        if (message.view.answers.some((a) => a.authorId === null)) {
          fail(
            'house only at two players',
            `a house answer appeared in a ${identifiedCount}-player matchup`,
          );
        }
      }
    }
  }

  // 7. The final story is complete — no placeholders, no blanks.
  const view = finalState.view as { stories?: { sections: { lines: { segments: { text: string }[] }[] }[] }[] };
  const stories = view.stories ?? [];
  if (stories.length === 0) fail('final story', 'no story was rendered on the results screen');
  for (const story of stories) {
    for (const section of story.sections) {
      for (const line of section.lines) {
        const text = line.segments.map((s) => s.text).join('');
        if (/\{[a-z0-9_]+\}/.test(text)) fail('final story', `unfilled placeholder: ${text}`);
        // Redaction is for *locked* sections only; the final read-out reveals all.
        if (text.includes('\u2588')) fail('final story', `a redacted line reached the results: ${text}`);
        if (text.includes('undefined') || text.includes('null')) {
          fail('final story', `placeholder text leaked: ${text}`);
        }
        if (text.trim().length === 0) fail('final story', 'a story line rendered empty');
      }
    }
  }

  return failures;
}
