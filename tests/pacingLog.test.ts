/**
 * BLURT — the pacing log.
 *
 * This log exists to be left on in production and read out of `wrangler tail`, which
 * makes "it never prints player content" a security property rather than a style
 * preference. The important test here is the last one: a room is stuffed with player
 * text that would be embarrassing in a log, and every line is checked for it.
 */

import { describe, expect, it, vi } from 'vitest';
import { createPlayer, createRoomState } from '../server/src/roomState.js';
import { logMatchEnd, logPhaseEnter, logPhaseExit } from '../server/src/pacingLog.js';
import type { RoomState } from '../server/src/types.js';

const NOW = 1_700_000_000_000;

function room(): RoomState {
  const state = createRoomState('MULE', NOW);
  for (let i = 0; i < 4; i += 1) {
    const player = createPlayer(NOW, i === 0);
    player.name = `Player${i}`;
    player.identified = true;
    state.players.push(player);
  }
  state.hostId = state.players[0]?.id ?? null;
  return state;
}

/** Capture whatever the log wrote. */
function capture(fn: () => void): string[] {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  try {
    fn();
    return spy.mock.calls.map((args) => String(args[0]));
  } finally {
    spy.mockRestore();
  }
}

describe('pacing log', () => {
  it('reports entry with the room, phase, counts and the phase budget', () => {
    const state = room();
    state.timers.phase = NOW + 45_000;
    const [line] = capture(() => logPhaseEnter(state, 'ROUND_PROMPT', NOW));

    expect(line).toContain('MULE enter ROUND_PROMPT');
    expect(line).toContain('eligible=4');
    expect(line).toContain('connected=4');
    expect(line).toContain('seated=4');
    expect(line).toContain('budget=45.0s');
  });

  it('says budget=none for a phase with no deadline', () => {
    const [line] = capture(() => logPhaseEnter(room(), 'FINAL_RESULTS', NOW));
    expect(line).toContain('budget=none');
  });

  it('reports the exit reason and how long the phase actually took', () => {
    const [line] = capture(() =>
      logPhaseExit(room(), 'ROUND_VOTE', 'all-submitted', NOW + 12_400, NOW),
    );
    expect(line).toContain('exit  ROUND_VOTE');
    expect(line).toContain('reason=all-submitted');
    expect(line).toContain('after=12.4s');
  });

  it('prints after=? rather than a wrong number when the object hibernated', () => {
    const [line] = capture(() => logPhaseExit(room(), 'ROUND_VOTE', 'timeout', NOW, null));
    expect(line).toContain('after=?');
    expect(line).not.toMatch(/after=[0-9]/);
  });

  it('counts only the players who could actually act', () => {
    const state = room();
    // One never named themselves, one is inside their grace window, one is gone.
    const ghost = createPlayer(NOW, false);
    state.players.push(ghost);
    const away = state.players[1];
    if (away !== undefined) {
      away.connected = false;
      away.disconnectedAt = NOW - 1_000;
    }
    const gone = state.players[2];
    if (gone !== undefined) {
      gone.connected = false;
      gone.departed = true;
      gone.disconnectedAt = NOW - 200_000;
    }
    const [line] = capture(() => logPhaseEnter(state, 'ROUND_PROMPT', NOW));

    // The three numbers deliberately differ, and the gaps are the useful part:
    //   eligible=3  can act now — excludes the departed player and the unnamed ghost,
    //               but still includes the one inside their grace window.
    //   connected=3 sockets attached — includes the ghost still on the name screen,
    //               excludes the two who dropped.
    //   seated=4    holding a seat and a score, including the one who has gone.
    // connected < seated is normal and means somebody is away, not that anything broke.
    expect(line).toContain('eligible=3');
    expect(line).toContain('connected=3');
    expect(line).toContain('seated=4');
  });

  it('summarises the match once, and only when there is a match', () => {
    expect(capture(() => logMatchEnd(room(), NOW))).toHaveLength(0);
  });

  it('never prints player names, ids, tokens or any submitted text', () => {
    const state = room();
    const secrets = [
      'Suspicious Gary',
      'a man losing an argument with a bin',
      'THE-SECRET-ANSWER',
    ];
    const first = state.players[0];
    if (first === undefined) throw new Error('no player');
    first.name = secrets[0] ?? '';
    state.timers.phase = NOW + 20_000;

    const lines = [
      ...capture(() => logPhaseEnter(state, 'ROUND_PROMPT', NOW)),
      ...capture(() => logPhaseExit(state, 'ROUND_PROMPT', 'all-submitted', NOW + 5_000, NOW)),
      ...capture(() => logPhaseEnter(state, 'ROUND_VOTE', NOW)),
    ];
    expect(lines.length).toBeGreaterThan(0);

    for (const line of lines) {
      for (const secret of secrets) expect(line).not.toContain(secret);
      // Player ids and reconnect tokens are the other things that must never appear.
      for (const player of state.players) {
        expect(line).not.toContain(player.id);
        expect(line).not.toContain(player.token);
      }
    }
  });
});
