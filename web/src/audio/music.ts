/**
 * BLURT — the music bed.
 *
 * There was no music. Not muted, not failing to start: the mixer had a `music` level
 * and a slider wired to it, and nothing had ever been connected to that channel. This
 * is the source.
 *
 * It is deliberately small: two detuned saw voices through a slow filter sweep and a
 * sub, playing a four-chord loop derived from the room's own seed so two rooms are not
 * humming the same thing. No samples, no loops on disk — same rule as the SFX.
 *
 * The important behaviour is the ducking. A bed that keeps its level through a reveal
 * fights the thing everybody is trying to listen to, so anything dramatic pulls it
 * down and lets it back up afterwards.
 */

/** Semitone offsets of the loop, in the key the bed is built around. */
const PROGRESSION = [0, -3, -5, -1];
const ROOT_HZ = 110;
const CHORD_SECONDS = 3.4;

/** How far down a duck pulls the bed, and how long it takes to come back. */
const DUCK_TO = 0.22;
const DUCK_ATTACK = 0.08;
const DUCK_RELEASE = 1.6;

function hz(semitones: number): number {
  return ROOT_HZ * Math.pow(2, semitones / 12);
}

export class MusicBed {
  private bus: GainNode | null = null;
  private duck: GainNode | null = null;
  private voices: OscillatorNode[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private level = 0.35;

  get playing(): boolean {
    return this.bus !== null;
  }

  /**
   * Start the bed. Idempotent — calling it again while running is a no-op, so the
   * caller can call it on every state change without tracking whether it already did.
   */
  start(ctx: AudioContext, destination: GainNode, level: number, seed: number): void {
    if (this.bus !== null) return;
    this.level = level;

    const bus = ctx.createGain();
    bus.gain.value = 0;
    const duck = ctx.createGain();
    duck.gain.value = 1;
    bus.connect(duck);
    duck.connect(destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    filter.Q.value = 0.6;
    filter.connect(bus);

    // Two saws a few cents apart give the movement; the sub keeps it from sounding
    // like a ringtone on a phone speaker.
    for (const detune of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.detune.value = detune;
      osc.frequency.value = hz(0);
      osc.connect(filter);
      osc.start();
      this.voices.push(osc);
    }
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = hz(-12);
    const subGain = ctx.createGain();
    subGain.gain.value = 0.5;
    sub.connect(subGain);
    subGain.connect(bus);
    sub.start();
    this.voices.push(sub);

    this.bus = bus;
    this.duck = duck;
    // Seeded so a room's bed is its own, and stable across a reconnect.
    this.step = Math.abs(seed) % PROGRESSION.length;

    bus.gain.setTargetAtTime(this.level, ctx.currentTime, 1.2);
    this.advance(ctx);
    this.timer = setInterval(() => this.advance(ctx), CHORD_SECONDS * 1000);
  }

  /** Move to the next chord, gliding rather than stepping. */
  private advance(ctx: AudioContext): void {
    const semis = PROGRESSION[this.step % PROGRESSION.length] ?? 0;
    this.step += 1;
    const now = ctx.currentTime;
    for (const [index, osc] of this.voices.entries()) {
      const target = index === this.voices.length - 1 ? hz(semis - 12) : hz(semis);
      osc.frequency.setTargetAtTime(target, now, 0.35);
    }
  }

  setLevel(ctx: AudioContext, level: number): void {
    this.level = level;
    this.bus?.gain.setTargetAtTime(level, ctx.currentTime, 0.15);
  }

  /** Pull the bed down under a sting or a reveal, then let it back up. */
  duckFor(ctx: AudioContext, seconds: number): void {
    if (this.duck === null) return;
    const now = ctx.currentTime;
    this.duck.gain.cancelScheduledValues(now);
    this.duck.gain.setTargetAtTime(DUCK_TO, now, DUCK_ATTACK);
    this.duck.gain.setTargetAtTime(1, now + seconds, DUCK_RELEASE / 3);
  }

  stop(ctx: AudioContext): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.bus?.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    const voices = this.voices;
    const bus = this.bus;
    this.voices = [];
    this.bus = null;
    this.duck = null;
    setTimeout(() => {
      for (const osc of voices) {
        try {
          osc.stop();
        } catch {
          // Already stopped.
        }
      }
      bus?.disconnect();
    }, 1200);
  }
}
