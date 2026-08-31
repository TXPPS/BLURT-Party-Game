import { describe, expect, it } from 'vitest';
import { LEGAL_TRANSITIONS, PHASES, isLegalTransition, type Phase } from '../shared/types.js';

describe('the phase machine', () => {
  it('declares an edge list for every phase', () => {
    for (const phase of PHASES) {
      expect(LEGAL_TRANSITIONS[phase], phase).toBeDefined();
      expect(Array.isArray(LEGAL_TRANSITIONS[phase]), phase).toBe(true);
    }
    expect(Object.keys(LEGAL_TRANSITIONS).sort()).toEqual([...PHASES].sort());
  });

  it('only ever points at real phases', () => {
    for (const phase of PHASES) {
      for (const target of LEGAL_TRANSITIONS[phase]) {
        expect(PHASES, `${phase} → ${target}`).toContain(target);
      }
    }
  });

  it('has no phase that transitions to itself', () => {
    for (const phase of PHASES) {
      expect(LEGAL_TRANSITIONS[phase], phase).not.toContain(phase);
    }
  });

  it('lists no duplicate edges', () => {
    for (const phase of PHASES) {
      const targets = LEGAL_TRANSITIONS[phase];
      expect(new Set(targets).size, phase).toBe(targets.length);
    }
  });

  it('can always get back to the lobby, from anywhere', () => {
    // A room that cannot be recovered is the one unforgivable multiplayer bug.
    for (const phase of PHASES) {
      if (phase === 'LOBBY') continue;
      expect(LEGAL_TRANSITIONS[phase], phase).toContain('LOBBY');
    }
  });

  it('makes every phase reachable from the lobby', () => {
    const seen = new Set<Phase>(['LOBBY']);
    const queue: Phase[] = ['LOBBY'];
    while (queue.length > 0) {
      const current = queue.shift() as Phase;
      for (const next of LEGAL_TRANSITIONS[current]) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect([...seen].sort()).toEqual([...PHASES].sort());
  });

  it('accepts the happy path of a full match', () => {
    const path: Phase[] = [
      'LOBBY',
      'GAME_SETUP',
      'ROUND_PROMPT',
      'ROUND_WAITING',
      'ROUND_REVEAL',
      'ROUND_VOTE',
      'ROUND_RESULTS',
      'STORY_UPDATE',
      'ROUND_PROMPT',
      'ROUND_WAITING',
      'ROUND_REVEAL',
      'ROUND_VOTE',
      'ROUND_RESULTS',
      'FINAL_STORY',
      'DRAWING_SETUP',
      'DRAWING_ACTIVE',
      'DRAWING_GUESS',
      'DRAWING_VOTE',
      'DRAWING_RESULTS',
      'FINAL_RESULTS',
      'LOBBY',
    ];
    for (let i = 1; i < path.length; i += 1) {
      const from = path[i - 1] as Phase;
      const to = path[i] as Phase;
      expect(isLegalTransition(from, to), `${from} → ${to}`).toBe(true);
    }
  });

  it('accepts a finale-free match', () => {
    expect(isLegalTransition('FINAL_STORY', 'FINAL_RESULTS')).toBe(true);
  });

  it('showcases drawings back to back without re-entering setup or drawing', () => {
    // Everybody draws at once, so SETUP and ACTIVE happen once. The showcase then
    // loops GUESS → VOTE → RESULTS → GUESS for each picture in turn.
    expect(isLegalTransition('DRAWING_RESULTS', 'DRAWING_GUESS')).toBe(true);

    // Going back to either would mean a second drawing window, which is the pacing
    // bug this structure exists to prevent.
    expect(isLegalTransition('DRAWING_RESULTS', 'DRAWING_SETUP')).toBe(false);
    expect(isLegalTransition('DRAWING_RESULTS', 'DRAWING_ACTIVE')).toBe(false);
  });

  it('accepts PLAY AGAIN straight from the results screen', () => {
    expect(isLegalTransition('FINAL_RESULTS', 'GAME_SETUP')).toBe(true);
  });

  it.each([
    ['LOBBY', 'ROUND_VOTE'],
    ['ROUND_PROMPT', 'ROUND_VOTE'],
    ['ROUND_PROMPT', 'ROUND_RESULTS'],
    ['ROUND_VOTE', 'ROUND_PROMPT'],
    ['ROUND_REVEAL', 'ROUND_RESULTS'],
    ['GAME_SETUP', 'FINAL_RESULTS'],
    ['DRAWING_ACTIVE', 'DRAWING_VOTE'],
    ['DRAWING_GUESS', 'DRAWING_RESULTS'],
    ['FINAL_RESULTS', 'ROUND_PROMPT'],
    ['STORY_UPDATE', 'ROUND_VOTE'],
  ] as [Phase, Phase][])('rejects the illegal jump %s → %s', (from, to) => {
    expect(isLegalTransition(from, to)).toBe(false);
  });

  it('never lets a vote be skipped on the way to results', () => {
    // The only way into ROUND_RESULTS is through ROUND_VOTE.
    const inbound = PHASES.filter((p) => LEGAL_TRANSITIONS[p].includes('ROUND_RESULTS'));
    expect(inbound).toEqual(['ROUND_VOTE']);
  });

  it('never lets a drawing be scored without a vote', () => {
    const inbound = PHASES.filter((p) => LEGAL_TRANSITIONS[p].includes('DRAWING_RESULTS'));
    expect(inbound).toEqual(['DRAWING_VOTE']);
  });

  it('never lets answers be revealed before they are collected', () => {
    const inbound = PHASES.filter((p) => LEGAL_TRANSITIONS[p].includes('ROUND_REVEAL'));
    expect(inbound).toEqual(['ROUND_WAITING']);
  });
});
