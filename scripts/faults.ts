/**
 * BLURT — fault-injection cases.
 *
 * Every case in the brief's fault list, expressed as a match configuration plus the
 * extra assertion that proves the fault was actually handled rather than merely
 * survived. A case that passes because nothing happened is a case that proves
 * nothing, so most of these assert on a specific server response.
 */

import type { Bot, InvariantFailure } from './botHarness.js';
import type { RunConfig } from './simulate.js';

export interface FaultCase {
  config: RunConfig;
}

const sawError = (bots: readonly Bot[], code: string): boolean =>
  bots.some((b) => b.errors.some((e) => e.code === code));

const expectError =
  (code: string, what: string) =>
  (bots: readonly Bot[]): InvariantFailure[] =>
    sawError(bots, code) ? [] : [{ name: what, detail: `expected a ${code} error, never saw one` }];

const expectNoError =
  (code: string, what: string) =>
  (bots: readonly Bot[]): InvariantFailure[] =>
    sawError(bots, code) ? [{ name: what, detail: `unexpected ${code} error` }] : [];

/** Somebody, somewhere, had the house write for them. */
const expectFallbackUsed = (bots: readonly Bot[]): InvariantFailure[] => {
  const final = bots.map((b) => b.state).find((s) => s?.phase === 'FINAL_RESULTS');
  const total = final?.players.reduce((sum, p) => sum + p.stats.fallbackFills, 0) ?? 0;
  return total > 0 ? [] : [{ name: 'house filled in', detail: 'no fallback fills were recorded' }];
};

/** The room found its way to a new host. */
const expectHostMigration = (bots: readonly Bot[]): InvariantFailure[] => {
  const sawToast = bots.some((b) =>
    b.received.some((m) => m.t === 'toast' && /is now the host/i.test(m.message)),
  );
  return sawToast ? [] : [{ name: 'host migration', detail: 'authority never moved to a present player' }];
};

/** The player who dropped came back to the right screen with their score intact. */
const expectReconnectRestored = (index: number) =>
  (bots: readonly Bot[]): InvariantFailure[] => {
    const bot = bots[index];
    if (bot === undefined) return [{ name: 'reconnect', detail: 'bot missing' }];
    const restored = bot.state !== null && !bot.errors.some((e) => e.code === 'SESSION_NOT_RESTORED');
    const onScoreboard =
      bot.state?.players.some((p) => p.id === bot.playerId && p.identified) === true;
    if (!restored) return [{ name: 'reconnect', detail: 'session was refused' }];
    if (!onScoreboard) return [{ name: 'reconnect', detail: 'player was not restored to the roster' }];
    return [];
  };

export const FAULT_CASES: readonly FaultCase[] = [
  {
    config: {
      label: 'competitor never submits',
      players: 4, rounds: 3, mode: 'classic', drawing: false, timer: 'fast',
      behaviours: { 1: { skipAnswers: true } },
      expect: expectFallbackUsed,
    },
  },
  {
    config: {
      label: 'nobody votes at all',
      players: 4, rounds: 3, mode: 'classic', drawing: false, timer: 'fast',
      behaviours: { 0: { skipVotes: true }, 1: { skipVotes: true }, 2: { skipVotes: true }, 3: { skipVotes: true } },
      expect: (bots) => {
        const sawNoVotes = bots.some((b) =>
          b.received.some((m) => m.t === 'state' && m.view.phase === 'ROUND_RESULTS' && m.view.nobodyVoted),
        );
        return sawNoVotes ? [] : [{ name: 'nobody voted', detail: 'the universe never had to decide' }];
      },
    },
  },
  {
    config: {
      label: 'blank + 160-char + double submit',
      players: 4, rounds: 3, mode: 'classic', drawing: false, timer: 'fast',
      behaviours: {
        1: { blankAnswers: true },
        2: { longAnswers: true, doubleSubmit: true },
        3: { doubleSubmit: true },
      },
      expect: (bots) => [
        ...expectError('INVALID_MESSAGE', 'blank answer refused')(bots),
        // A double submit must never produce two answers in one matchup.
        ...bots.flatMap((bot) => {
          const bad = bot.received.filter(
            (m) =>
              m.t === 'state' &&
              m.view.phase === 'ROUND_RESULTS' &&
              new Set(m.view.answers.map((a) => a.authorId)).size !== m.view.answers.length,
          );
          return bad.length > 0
            ? [{ name: 'no duplicate answers', detail: 'a player appeared twice in one matchup' }]
            : [];
        }),
      ],
    },
  },
  {
    config: {
      // Two players is the only configuration where a competitor is also a voter,
      // so it is the only place the self-vote guard is actually reachable. The UI
      // never offers the option; this goes around it with a raw socket frame.
      label: 'self-vote via raw socket (2p)',
      players: 2, rounds: 3, mode: 'classic', drawing: false, timer: 'fast',
      behaviours: { 0: { attemptSelfVote: true }, 1: { attemptSelfVote: true } },
      expect: expectError('SELF_VOTE', 'self-vote refused'),
      timeoutMs: 300_000,
    },
  },
  {
    config: {
      // Above two players a competitor is not in the voter list at all, so the same
      // hostile frame must be refused one step earlier.
      label: 'competitor votes in own matchup (4p)',
      players: 4, rounds: 3, mode: 'classic', drawing: false, timer: 'fast',
      behaviours: { 1: { attemptSelfVote: true }, 2: { attemptSelfVote: true } },
      expect: expectError('NOT_YOUR_TURN', 'competitor refused a vote in their own matchup'),
    },
  },
  {
    config: {
      label: 'host-only action from a non-host',
      players: 4, rounds: 3, mode: 'classic', drawing: false, timer: 'fast',
      behaviours: { 2: { attemptHostAction: true } },
      expect: expectError('NOT_HOST', 'host-only action refused'),
    },
  },
  {
    config: {
      label: 'player leaves mid-round',
      players: 5, rounds: 3, mode: 'classic', drawing: false, timer: 'fast',
      behaviours: { 3: { disconnectOnPhase: 'ROUND_PROMPT' } },
    },
  },
  {
    config: {
      label: 'player leaves mid-vote',
      players: 5, rounds: 3, mode: 'classic', drawing: false, timer: 'fast',
      behaviours: { 4: { disconnectOnPhase: 'ROUND_VOTE' } },
    },
  },
  {
    config: {
      label: 'player leaves during drawing',
      players: 5, rounds: 3, mode: 'classic', drawing: true, timer: 'fast',
      behaviours: { 3: { disconnectOnPhase: 'DRAWING_ACTIVE' } },
      timeoutMs: 240_000,
    },
  },
  {
    config: {
      label: 'reconnect mid-round',
      players: 4, rounds: 3, mode: 'classic', drawing: false, timer: 'fast',
      behaviours: { 2: { disconnectOnPhase: 'ROUND_PROMPT', reconnectAfterMs: 900 } },
      expect: expectReconnectRestored(2),
    },
  },
  {
    config: {
      label: 'host leaves and returns',
      players: 4, rounds: 3, mode: 'classic', drawing: false, timer: 'fast',
      behaviours: { 0: { disconnectOnPhase: 'ROUND_VOTE', reconnectAfterMs: 1200 } },
      expect: expectReconnectRestored(0),
    },
  },
  {
    config: {
      // The host vanishes for good. Nobody is left to press ADVANCE, so this also
      // exercises every auto-advance deadline in the standard round loop.
      label: 'host leaves permanently',
      players: 4, rounds: 3, mode: 'classic', drawing: false, timer: 'fast',
      behaviours: { 0: { disconnectOnPhase: 'ROUND_VOTE' } },
      expect: expectHostMigration,
      timeoutMs: 300_000,
    },
  },
  {
    config: {
      label: 'artist never draws',
      players: 4, rounds: 3, mode: 'classic', drawing: true, timer: 'fast',
      behaviours: { 0: { skipDrawing: true }, 1: { skipDrawing: true }, 2: { skipDrawing: true }, 3: { skipDrawing: true } },
      timeoutMs: 300_000,
    },
  },
  {
    config: {
      label: 'nobody writes a decoy',
      players: 4, rounds: 3, mode: 'classic', drawing: true, timer: 'fast',
      behaviours: { 0: { skipGuesses: true }, 1: { skipGuesses: true }, 2: { skipGuesses: true }, 3: { skipGuesses: true } },
      timeoutMs: 300_000,
    },
  },
  {
    config: {
      label: 'oversized drawing payload',
      players: 3, rounds: 3, mode: 'classic', drawing: true, timer: 'fast',
      behaviours: { 0: { oversizedDrawing: true }, 1: { oversizedDrawing: true }, 2: { oversizedDrawing: true } },
      expect: (bots) => {
        const refused =
          sawError(bots, 'PAYLOAD_TOO_LARGE') || sawError(bots, 'INVALID_MESSAGE');
        return refused ? [] : [{ name: 'oversized drawing', detail: 'the server accepted an over-cap payload' }];
      },
      timeoutMs: 300_000,
    },
  },
  {
    config: {
      label: 'message flood (rate limit)',
      players: 4, rounds: 3, mode: 'classic', drawing: false, timer: 'fast',
      behaviours: { 3: { floodOnJoin: true } },
      expect: expectError('RATE_LIMITED', 'rate limiting'),
    },
  },
  {
    config: {
      label: '2 players, house answers',
      players: 2, rounds: 3, mode: 'classic', drawing: true, timer: 'fast',
      expect: (bots) => {
        const sawHouse = bots.some((b) =>
          b.received.some(
            (m) =>
              m.t === 'state' &&
              m.view.phase === 'ROUND_RESULTS' &&
              m.view.answers.some((a) => a.authorId === null),
          ),
        );
        return sawHouse ? [] : [{ name: 'the house plays', detail: 'no house answer appeared at 2 players' }];
      },
      timeoutMs: 300_000,
    },
  },
  {
    config: {
      label: '3 players, single voter',
      players: 3, rounds: 3, mode: 'classic', drawing: false, timer: 'fast',
    },
  },
  {
    config: {
      label: '15 rounds through 10-slot stories',
      players: 4, rounds: 15, mode: 'classic', drawing: false, timer: 'fast',
      timeoutMs: 300_000,
    },
  },
  {
    config: {
      label: '1 round, 10-slot story',
      players: 4, rounds: 1, mode: 'classic', drawing: false, timer: 'fast',
    },
  },
  {
    config: {
      label: 'crude mode, 8 players, finale',
      players: 8, rounds: 3, mode: 'crude', drawing: true, timer: 'fast',
      timeoutMs: 300_000,
      expect: expectNoError('SERVER_ERROR', 'crude mode is stable'),
    },
  },
  {
    config: {
      label: 'full house: 10 players',
      players: 10, rounds: 3, mode: 'classic', drawing: true, timer: 'fast',
      timeoutMs: 300_000,
    },
  },
];
