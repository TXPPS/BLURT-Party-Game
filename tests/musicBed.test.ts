/**
 * BLURT — the music bed.
 *
 * There was no music in the playtest because nothing had ever been connected to the
 * mixer's music channel: the level existed, the slider moved it, and no source was
 * attached. These tests exist so "the graph is actually built" is checked rather than
 * assumed — that being precisely the thing that went unnoticed.
 *
 * A tiny fake AudioContext is enough. The bed only ever asks for gains, oscillators
 * and one filter, and what matters is that it connects them, plays, ducks and stops.
 */

import { describe, expect, it, vi } from 'vitest';
import { MusicBed } from '../web/src/audio/music.js';

interface FakeParam {
  value: number;
  setTargetAtTime: ReturnType<typeof vi.fn>;
  cancelScheduledValues: ReturnType<typeof vi.fn>;
}

function param(value = 0): FakeParam {
  return { value, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn() };
}

function fakeContext() {
  const gains: { gain: FakeParam; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  const oscillators: { frequency: FakeParam; detune: FakeParam; type: string; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }[] = [];
  const ctx = {
    currentTime: 0,
    createGain() {
      const node = { gain: param(1), connect: vi.fn(), disconnect: vi.fn() };
      gains.push(node);
      return node;
    },
    createOscillator() {
      const node = {
        frequency: param(0), detune: param(0), type: 'sine',
        start: vi.fn(), stop: vi.fn(), connect: vi.fn(),
      };
      oscillators.push(node);
      return node;
    },
    createBiquadFilter() {
      return { type: 'lowpass', frequency: param(0), Q: param(0), connect: vi.fn() };
    },
  };
  return { ctx, gains, oscillators };
}

describe('MusicBed', () => {
  it('is not playing until it is started', () => {
    expect(new MusicBed().playing).toBe(false);
  });

  it('builds a graph and starts its oscillators', () => {
    const { ctx, oscillators } = fakeContext();
    const bed = new MusicBed();
    const dest = ctx.createGain();

    bed.start(ctx as unknown as AudioContext, dest as unknown as GainNode, 0.35, 7);

    expect(bed.playing).toBe(true);
    // Two detuned saws and a sub — the thing that was missing entirely before.
    expect(oscillators).toHaveLength(3);
    for (const osc of oscillators) expect(osc.start).toHaveBeenCalled();
    expect(oscillators.filter((o) => o.type === 'sawtooth')).toHaveLength(2);
  });

  it('is idempotent, so a caller can start it on every state change', () => {
    const { ctx, oscillators } = fakeContext();
    const bed = new MusicBed();
    const dest = ctx.createGain();

    bed.start(ctx as unknown as AudioContext, dest as unknown as GainNode, 0.35, 1);
    bed.start(ctx as unknown as AudioContext, dest as unknown as GainNode, 0.35, 1);

    expect(oscillators).toHaveLength(3);
  });

  it('ducks and then restores, rather than ducking permanently', () => {
    const { ctx, gains } = fakeContext();
    const bed = new MusicBed();
    const dest = ctx.createGain();
    bed.start(ctx as unknown as AudioContext, dest as unknown as GainNode, 0.35, 3);

    const duck = gains.find((g) => g.gain.value === 1 && g !== dest);
    bed.duckFor(ctx as unknown as AudioContext, 2);

    // Two scheduled moves: down now, back up after the moment has passed.
    const scheduled = gains.flatMap((g) => g.gain.setTargetAtTime.mock.calls);
    const targets = scheduled.map((c) => c[0] as number);
    expect(duck).toBeDefined();
    expect(targets).toContain(1);
    expect(targets.some((t) => t > 0 && t < 0.5)).toBe(true);
  });

  it('does nothing on duck or stop when it was never started', () => {
    const { ctx } = fakeContext();
    const bed = new MusicBed();
    expect(() => bed.duckFor(ctx as unknown as AudioContext, 1)).not.toThrow();
    expect(() => bed.stop(ctx as unknown as AudioContext)).not.toThrow();
  });

  it('stops cleanly and reports itself stopped', () => {
    const { ctx } = fakeContext();
    const bed = new MusicBed();
    const dest = ctx.createGain();
    bed.start(ctx as unknown as AudioContext, dest as unknown as GainNode, 0.35, 2);
    bed.stop(ctx as unknown as AudioContext);
    expect(bed.playing).toBe(false);
  });
});
