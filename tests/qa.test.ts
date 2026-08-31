/**
 * BLURT — the manual-QA aids.
 *
 * The token check is the only security-relevant code in this repo, so it is the part
 * worth testing hardest. Everything else here is a convenience; that function is what
 * stands between a public URL and a stranger resetting somebody's game.
 */

import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS } from '../shared/constants.js';
import { createRoomState } from '../server/src/roomState.js';
import { addBots, removeBots, tokenMatches } from '../server/src/qa.js';

const NOW = 1_700_000_000_000;

describe('tokenMatches', () => {
  it('accepts only the exact token', () => {
    expect(tokenMatches('sekrit', 'sekrit')).toBe(true);
    expect(tokenMatches('sekrit', 'sekrix')).toBe(false);
    expect(tokenMatches('sekrit', 'sekri')).toBe(false);
    expect(tokenMatches('sekrit', 'sekrit ')).toBe(false);
  });

  it('refuses when no secret is configured, whatever is presented', () => {
    // This is the fail-closed case: an unconfigured deployment must not be unlockable
    // by guessing, by sending nothing, or by sending the empty string.
    expect(tokenMatches(undefined, 'anything')).toBe(false);
    expect(tokenMatches(undefined, null)).toBe(false);
    expect(tokenMatches(undefined, '')).toBe(false);
    expect(tokenMatches('', '')).toBe(false);
    expect(tokenMatches('', 'anything')).toBe(false);
  });

  it('refuses a missing header', () => {
    expect(tokenMatches('sekrit', null)).toBe(false);
  });
});

describe('QA stand-ins', () => {
  it('adds the number asked for, already named and ready to play', () => {
    const state = createRoomState('TEST', NOW);
    expect(addBots(state, 4, NOW, MAX_PLAYERS)).toBe(4);

    expect(state.players).toHaveLength(4);
    for (const bot of state.players) {
      expect(bot.isBot).toBe(true);
      expect(bot.identified).toBe(true);
      expect(bot.ready).toBe(true);
      expect(bot.name.length).toBeGreaterThan(0);
      expect(bot.avatarId.length).toBeGreaterThan(0);
      // A Crude QA room must not stall waiting for a stand-in to pass the 18+ gate.
      expect(bot.adultAcknowledged).toBe(true);
    }
    // Obviously fake, so nobody mistakes one for a real player on the roster.
    for (const bot of state.players) expect(bot.name.startsWith('QA ')).toBe(true);
  });

  it('never exceeds the room limit, however many are asked for', () => {
    const state = createRoomState('TEST', NOW);
    addBots(state, 99, NOW, MAX_PLAYERS);
    expect(state.players).toHaveLength(MAX_PLAYERS);

    // And a second call cannot push it over.
    expect(addBots(state, 5, NOW, MAX_PLAYERS)).toBe(0);
    expect(state.players).toHaveLength(MAX_PLAYERS);
  });

  it('counts existing humans against the limit', () => {
    const state = createRoomState('TEST', NOW);
    addBots(state, 3, NOW, 5);
    expect(addBots(state, 5, NOW, 5)).toBe(2);
    expect(state.players).toHaveLength(5);
  });

  it('removes only the stand-ins, and forgets their readiness', () => {
    const state = createRoomState('TEST', NOW);
    addBots(state, 3, NOW, MAX_PLAYERS);
    const human = { ...state.players[0]!, id: 'human', isBot: false };
    state.players.push(human);
    state.readyToAdvance = state.players.map((p) => p.id);

    expect(removeBots(state)).toBe(3);
    expect(state.players).toHaveLength(1);
    expect(state.players[0]?.id).toBe('human');
    // A stale id left in here would make the room wait for a player that is gone.
    expect(state.readyToAdvance).toEqual(['human']);
  });
});
