/**
 * BLURT — the synthesis engine.
 *
 * There are no audio files in this project and there never will be. Every sound is
 * built at runtime from oscillators, a noise buffer, filters and envelopes. That
 * guarantees originality, removes all licensing risk, and costs the bundle a couple
 * of kilobytes instead of a couple of megabytes.
 *
 * A sound is a `Recipe`: a list of `Voice`s, each of which is one oscillator or one
 * burst of noise with its own envelope, optional pitch glide, optional filter sweep
 * and optional vibrato. Layering two or three of those covers everything from a UI
 * click to a sad trombone.
 */

export interface Voice {
  /** `tone` is an oscillator; `noise` is a filtered burst of white noise. */
  kind: 'tone' | 'noise';
  wave?: OscillatorType;
  /** Starting frequency in Hz (ignored for noise). */
  freq?: number;
  /** Glide to this frequency across the voice's duration. */
  freqEnd?: number;
  /** Exponential rather than linear glide — the right shape for a slide whistle. */
  glide?: 'linear' | 'exponential';
  /** Seconds. */
  dur: number;
  /** Seconds to wait before this voice starts. */
  delay?: number;
  /** Peak gain, 0–1, before the mixer. */
  gain?: number;
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  filter?: {
    type: BiquadFilterType;
    freq: number;
    freqEnd?: number;
    q?: number;
  };
  vibrato?: { rate: number; depth: number };
  detune?: number;
}

export type Recipe = Voice[];

export interface MixerLevels {
  master: number;
  sfx: number;
  music: number;
  muted: boolean;
}

/**
 * Owns the AudioContext and the mixer graph.
 *
 * The context is created lazily and resumed on the first user gesture, because
 * browsers refuse to make noise before one — and because a party game that beeps
 * before anybody has touched it is a bad party game.
 */
export class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private levels: MixerLevels = { master: 0.7, sfx: 0.9, music: 0.4, muted: false };

  /** True once a user gesture has unlocked audio. */
  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Call from a real user gesture (pointerdown, keydown). Safe to call repeatedly. */
  async unlock(): Promise<void> {
    this.ensureContext();
    if (this.ctx !== null && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // Some browsers refuse outside a gesture; the next tap will get it.
      }
    }
  }

  setLevels(levels: MixerLevels): void {
    this.levels = levels;
    if (this.master !== null && this.ctx !== null) {
      const value = levels.muted ? 0 : levels.master;
      this.master.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
    }
    if (this.sfxBus !== null && this.ctx !== null) {
      this.sfxBus.gain.setTargetAtTime(levels.sfx, this.ctx.currentTime, 0.02);
    }
  }

  private ensureContext(): void {
    if (this.ctx !== null) return;
    const Ctor: typeof AudioContext | undefined =
      globalThis.AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor === undefined) return;

    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = this.levels.muted ? 0 : this.levels.master;
    master.connect(ctx.destination);

    const sfx = ctx.createGain();
    sfx.gain.value = this.levels.sfx;
    sfx.connect(master);

    this.ctx = ctx;
    this.master = master;
    this.sfxBus = sfx;
  }

  /** One second of white noise, generated once and reused by every noise voice. */
  private noise(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer !== null) return this.noiseBuffer;
    const length = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }

  /** Render a recipe. Silent (and free) when audio has not been unlocked. */
  play(recipe: Recipe): void {
    this.ensureContext();
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (ctx === null || bus === null || ctx.state !== 'running' || this.levels.muted) return;

    const start = ctx.currentTime;
    for (const voice of recipe) this.renderVoice(ctx, bus, voice, start);
  }

  private renderVoice(ctx: AudioContext, bus: GainNode, voice: Voice, start: number): void {
    const at = start + (voice.delay ?? 0);
    const dur = Math.max(0.01, voice.dur);
    const peak = voice.gain ?? 0.3;

    const amp = ctx.createGain();
    amp.gain.value = 0;

    // ADSR, clamped so the four stages always fit inside the voice.
    const attack = Math.min(voice.attack ?? 0.005, dur * 0.5);
    const decay = Math.min(voice.decay ?? dur * 0.3, dur * 0.5);
    const sustain = voice.sustain ?? 0.6;
    const release = Math.min(voice.release ?? dur * 0.3, dur);

    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.linearRampToValueAtTime(peak, at + attack);
    amp.gain.linearRampToValueAtTime(peak * sustain, at + attack + decay);
    amp.gain.setValueAtTime(peak * sustain, Math.max(at + attack + decay, at + dur - release));
    amp.gain.exponentialRampToValueAtTime(0.0001, at + dur);

    let tail: AudioNode = amp;
    if (voice.filter !== undefined) {
      const filter = ctx.createBiquadFilter();
      filter.type = voice.filter.type;
      filter.frequency.setValueAtTime(voice.filter.freq, at);
      if (voice.filter.freqEnd !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(20, voice.filter.freqEnd), at + dur);
      }
      if (voice.filter.q !== undefined) filter.Q.value = voice.filter.q;
      amp.connect(filter);
      tail = filter;
    }
    tail.connect(bus);

    if (voice.kind === 'noise') {
      const source = ctx.createBufferSource();
      source.buffer = this.noise(ctx);
      source.loop = true;
      source.connect(amp);
      source.start(at);
      source.stop(at + dur + 0.02);
      return;
    }

    const osc = ctx.createOscillator();
    osc.type = voice.wave ?? 'sine';
    const from = voice.freq ?? 440;
    osc.frequency.setValueAtTime(from, at);
    if (voice.freqEnd !== undefined) {
      const to = Math.max(20, voice.freqEnd);
      if ((voice.glide ?? 'exponential') === 'exponential') {
        osc.frequency.exponentialRampToValueAtTime(to, at + dur);
      } else {
        osc.frequency.linearRampToValueAtTime(to, at + dur);
      }
    }
    if (voice.detune !== undefined) osc.detune.value = voice.detune;

    if (voice.vibrato !== undefined) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = voice.vibrato.rate;
      depth.gain.value = voice.vibrato.depth;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(at);
      lfo.stop(at + dur + 0.02);
    }

    osc.connect(amp);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  /** Release the audio hardware — used when the tab is hidden for a long time. */
  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.noiseBuffer = null;
  }
}
