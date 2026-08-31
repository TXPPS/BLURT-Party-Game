/**
 * BLURT — sound design.
 *
 * Every `SfxEventId` maps to a *weighted pool* of recipes, so the same event does
 * not produce a byte-identical sound twice in a row. Fifteen rounds of the same
 * `ding` is how a party game becomes annoying.
 *
 * All of it is oscillators and noise. See `synth.ts` for the renderer.
 */

import type { SfxEventId } from '@shared/sfx.js';
import { CRUDE_ONLY_SFX } from '@shared/sfx.js';
import type { Recipe } from './synth.js';

interface Variant {
  weight: number;
  recipe: Recipe;
}

/* ---- Building blocks ---------------------------------------------- */

const blip = (freq: number, dur = 0.07, wave: OscillatorType = 'square', gain = 0.18): Recipe => [
  { kind: 'tone', wave, freq, dur, gain, attack: 0.004, decay: 0.02, sustain: 0.4, release: dur * 0.6 },
];

const sweep = (from: number, to: number, dur: number, wave: OscillatorType = 'sine', gain = 0.22): Recipe => [
  { kind: 'tone', wave, freq: from, freqEnd: to, dur, gain, attack: 0.01, release: dur * 0.4 },
];

/** A little arpeggio. `step` is the gap between notes in seconds. */
const arp = (freqs: number[], step: number, dur: number, wave: OscillatorType = 'triangle', gain = 0.2): Recipe =>
  freqs.map((freq, index) => ({
    kind: 'tone' as const,
    wave,
    freq,
    dur,
    gain,
    delay: index * step,
    attack: 0.005,
    release: dur * 0.5,
  }));

const thump = (freq = 90, dur = 0.22, gain = 0.34): Recipe => [
  { kind: 'tone', wave: 'sine', freq: freq * 2.2, freqEnd: freq * 0.6, dur, gain, attack: 0.002, release: dur * 0.7 },
];

const hiss = (
  dur: number,
  filterFreq: number,
  filterEnd: number,
  gain = 0.2,
  type: BiquadFilterType = 'bandpass',
): Recipe => [
  {
    kind: 'noise',
    dur,
    gain,
    attack: 0.006,
    release: dur * 0.6,
    filter: { type, freq: filterFreq, freqEnd: filterEnd, q: 1.2 },
  },
];

const one = (recipe: Recipe): Variant[] => [{ weight: 1, recipe }];

/* ---- The library --------------------------------------------------- */

const LIBRARY: Record<SfxEventId, Variant[]> = {
  /* UI feedback — short, dry, unobtrusive. */
  ui_click: [
    { weight: 3, recipe: blip(660, 0.045, 'square', 0.12) },
    { weight: 2, recipe: blip(720, 0.04, 'square', 0.11) },
    { weight: 1, recipe: blip(590, 0.05, 'triangle', 0.13) },
  ],
  ui_back: one(sweep(520, 320, 0.09, 'triangle', 0.14)),
  join: [
    { weight: 2, recipe: arp([523, 784], 0.06, 0.11, 'triangle', 0.17) },
    { weight: 1, recipe: arp([587, 880], 0.055, 0.1, 'triangle', 0.17) },
  ],
  ready: one(arp([659, 880, 1047], 0.05, 0.09, 'square', 0.14)),
  submit: [
    { weight: 2, recipe: arp([784, 1047], 0.045, 0.09, 'sine', 0.18) },
    { weight: 1, recipe: arp([698, 1047], 0.05, 0.1, 'sine', 0.18) },
  ],
  vote_cast: one([
    ...blip(880, 0.05, 'square', 0.14),
    { kind: 'tone', wave: 'square', freq: 1320, dur: 0.06, gain: 0.1, delay: 0.05 },
  ]),

  /* Dramatic cues — bigger, and only played on the shared screen by default. */
  game_start: one([
    ...arp([392, 523, 659, 784], 0.09, 0.24, 'square', 0.2),
    ...thump(70, 0.4, 0.3),
  ]),
  prompt_in: [
    { weight: 2, recipe: sweep(300, 900, 0.16, 'triangle', 0.18) },
    { weight: 1, recipe: sweep(340, 1020, 0.15, 'sawtooth', 0.14) },
  ],
  timer_warning: one([
    ...blip(880, 0.09, 'square', 0.2),
    { kind: 'tone', wave: 'square', freq: 880, dur: 0.09, gain: 0.2, delay: 0.16 },
  ]),
  timer_out: one([...sweep(600, 120, 0.42, 'sawtooth', 0.24), ...hiss(0.3, 1800, 300, 0.12)]),
  reveal: [
    { weight: 2, recipe: [...sweep(180, 720, 0.34, 'triangle', 0.2), ...hiss(0.2, 4000, 900, 0.08, 'highpass')] },
    { weight: 1, recipe: [...arp([440, 554, 659, 880], 0.06, 0.2, 'triangle', 0.18)] },
  ],
  votes_locked: one([...thump(120, 0.18, 0.3), ...blip(220, 0.12, 'square', 0.14)]),
  win_sting: [
    { weight: 2, recipe: arp([523, 659, 784, 1047], 0.07, 0.28, 'triangle', 0.22) },
    { weight: 1, recipe: arp([587, 740, 880, 1175], 0.065, 0.26, 'square', 0.18) },
  ],
  lose_sting: one(arp([392, 349, 294], 0.11, 0.3, 'sawtooth', 0.18)),
  buzzer: one([
    { kind: 'tone', wave: 'sawtooth', freq: 148, dur: 0.55, gain: 0.24, attack: 0.006, sustain: 0.9, release: 0.1 },
    { kind: 'tone', wave: 'sawtooth', freq: 151, dur: 0.55, gain: 0.2, detune: 12 },
  ]),
  ding: [
    { weight: 2, recipe: [{ kind: 'tone', wave: 'sine', freq: 1568, dur: 0.5, gain: 0.22, attack: 0.002, decay: 0.12, sustain: 0.25, release: 0.34 }] },
    { weight: 1, recipe: [{ kind: 'tone', wave: 'sine', freq: 2093, dur: 0.45, gain: 0.2, attack: 0.002, decay: 0.1, sustain: 0.22, release: 0.3 }] },
  ],
  applause: one([
    { kind: 'noise', dur: 1.5, gain: 0.2, attack: 0.14, decay: 0.5, sustain: 0.7, release: 0.7, filter: { type: 'bandpass', freq: 1600, freqEnd: 2600, q: 0.7 } },
    { kind: 'noise', dur: 1.3, gain: 0.12, delay: 0.09, attack: 0.2, release: 0.6, filter: { type: 'highpass', freq: 2400, q: 0.5 } },
  ]),
  gasp: one([
    { kind: 'noise', dur: 0.5, gain: 0.2, attack: 0.16, decay: 0.1, sustain: 0.7, release: 0.22, filter: { type: 'bandpass', freq: 700, freqEnd: 1700, q: 3 } },
  ]),
  airhorn: one([
    { kind: 'tone', wave: 'sawtooth', freq: 232, dur: 0.75, gain: 0.24, attack: 0.02, sustain: 0.95, release: 0.14, vibrato: { rate: 6, depth: 7 } },
    { kind: 'tone', wave: 'sawtooth', freq: 349, dur: 0.75, gain: 0.18, attack: 0.03, sustain: 0.95, release: 0.14 },
    { kind: 'tone', wave: 'square', freq: 466, dur: 0.7, gain: 0.1, delay: 0.03 },
  ]),
  sad_trombone: one([
    { kind: 'tone', wave: 'sawtooth', freq: 330, freqEnd: 294, dur: 0.3, gain: 0.2, glide: 'linear', filter: { type: 'lowpass', freq: 1400, q: 2 } },
    { kind: 'tone', wave: 'sawtooth', freq: 294, freqEnd: 262, dur: 0.3, gain: 0.2, delay: 0.3, glide: 'linear', filter: { type: 'lowpass', freq: 1200, q: 2 } },
    { kind: 'tone', wave: 'sawtooth', freq: 262, freqEnd: 196, dur: 0.6, gain: 0.22, delay: 0.6, glide: 'linear', vibrato: { rate: 5, depth: 6 }, filter: { type: 'lowpass', freq: 1000, q: 2 } },
  ]),
  record_scratch: one([
    { kind: 'noise', dur: 0.26, gain: 0.24, attack: 0.004, release: 0.1, filter: { type: 'bandpass', freq: 2600, freqEnd: 420, q: 6 } },
    { kind: 'tone', wave: 'sawtooth', freq: 700, freqEnd: 90, dur: 0.24, gain: 0.16 },
  ]),
  spring: one([
    { kind: 'tone', wave: 'triangle', freq: 300, freqEnd: 1500, dur: 0.34, gain: 0.18, vibrato: { rate: 26, depth: 120 } },
  ]),
  splat: one([...thump(60, 0.16, 0.3), ...hiss(0.2, 900, 180, 0.22, 'lowpass')]),
  glass_break: one([
    ...hiss(0.1, 5200, 3200, 0.22, 'highpass'),
    { kind: 'noise', dur: 0.45, gain: 0.14, delay: 0.05, attack: 0.002, release: 0.3, filter: { type: 'highpass', freq: 3400, q: 0.8 } },
    ...arp([2400, 3100, 2790], 0.05, 0.1, 'sine', 0.09),
  ]),
  distant_scream: one([
    { kind: 'tone', wave: 'sawtooth', freq: 620, freqEnd: 400, dur: 1.1, gain: 0.1, attack: 0.16, sustain: 0.7, release: 0.5, vibrato: { rate: 8, depth: 22 }, filter: { type: 'lowpass', freq: 1100, q: 1.4 } },
  ]),
  angel_choir: one([
    { kind: 'tone', wave: 'sine', freq: 523, dur: 1.4, gain: 0.12, attack: 0.35, sustain: 0.85, release: 0.6 },
    { kind: 'tone', wave: 'sine', freq: 659, dur: 1.4, gain: 0.1, attack: 0.45, sustain: 0.85, release: 0.6 },
    { kind: 'tone', wave: 'sine', freq: 784, dur: 1.4, gain: 0.09, attack: 0.55, sustain: 0.85, release: 0.6 },
    { kind: 'tone', wave: 'sine', freq: 1047, dur: 1.2, gain: 0.06, delay: 0.3, attack: 0.4, release: 0.5 },
  ]),
  awkward_cough: one([
    { kind: 'noise', dur: 0.13, gain: 0.2, attack: 0.004, release: 0.07, filter: { type: 'bandpass', freq: 520, freqEnd: 320, q: 4 } },
    { kind: 'noise', dur: 0.1, gain: 0.14, delay: 0.2, filter: { type: 'bandpass', freq: 460, q: 4 } },
  ]),
  censor_beep: one([
    { kind: 'tone', wave: 'sine', freq: 1000, dur: 0.42, gain: 0.2, attack: 0.004, sustain: 1, release: 0.01 },
  ]),
  drumroll: one([
    { kind: 'noise', dur: 1.1, gain: 0.16, attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.2, filter: { type: 'bandpass', freq: 260, freqEnd: 420, q: 1.6 } },
    ...thump(80, 0.25, 0.26).map((v) => ({ ...v, delay: 1.05 })),
  ]),
  story_stamp: one([
    ...thump(150, 0.14, 0.3),
    { kind: 'noise', dur: 0.11, gain: 0.16, filter: { type: 'lowpass', freq: 1600, freqEnd: 500, q: 1 } },
  ]),
  final_fanfare: one([
    ...arp([392, 523, 659, 784, 1047], 0.1, 0.34, 'square', 0.19),
    { kind: 'tone', wave: 'triangle', freq: 1568, dur: 0.9, gain: 0.16, delay: 0.5, attack: 0.02, sustain: 0.7, release: 0.5 },
    ...thump(65, 0.5, 0.28),
  ]),

  /* Crude pool — gated on room mode by `playFor` below. */
  fart_small: one([
    { kind: 'tone', wave: 'sawtooth', freq: 132, freqEnd: 86, dur: 0.2, gain: 0.2, vibrato: { rate: 34, depth: 26 }, filter: { type: 'lowpass', freq: 620, q: 3 } },
  ]),
  fart_large: one([
    { kind: 'tone', wave: 'sawtooth', freq: 108, freqEnd: 52, dur: 0.72, gain: 0.24, vibrato: { rate: 19, depth: 34 }, filter: { type: 'lowpass', freq: 480, freqEnd: 200, q: 4 } },
    { kind: 'noise', dur: 0.6, gain: 0.09, filter: { type: 'lowpass', freq: 380, q: 2 } },
  ]),
  toilet_flush: one([
    { kind: 'noise', dur: 1.5, gain: 0.18, attack: 0.1, decay: 0.4, sustain: 0.7, release: 0.55, filter: { type: 'bandpass', freq: 700, freqEnd: 2100, q: 0.9 } },
    { kind: 'tone', wave: 'sine', freq: 150, freqEnd: 70, dur: 1.3, gain: 0.1, delay: 0.2 },
  ]),
  wet_splat: one([
    ...thump(52, 0.14, 0.3),
    { kind: 'noise', dur: 0.24, gain: 0.2, filter: { type: 'lowpass', freq: 1300, freqEnd: 260, q: 3 } },
  ]),
  wheeze_laugh: one([
    { kind: 'noise', dur: 0.1, gain: 0.16, filter: { type: 'bandpass', freq: 1200, q: 5 } },
    { kind: 'noise', dur: 0.09, gain: 0.15, delay: 0.16, filter: { type: 'bandpass', freq: 1400, q: 5 } },
    { kind: 'noise', dur: 0.09, gain: 0.14, delay: 0.3, filter: { type: 'bandpass', freq: 1100, q: 5 } },
    { kind: 'noise', dur: 0.22, gain: 0.12, delay: 0.44, filter: { type: 'bandpass', freq: 900, freqEnd: 1900, q: 6 } },
  ]),
};

/** Weighted pick, so a repeated event does not sound identical twice running. */
export function recipeFor(event: SfxEventId): Recipe | null {
  const variants = LIBRARY[event];
  if (variants === undefined || variants.length === 0) return null;
  const total = variants.reduce((sum, v) => sum + v.weight, 0);
  let roll = Math.random() * total;
  for (const variant of variants) {
    roll -= variant.weight;
    if (roll <= 0) return variant.recipe;
  }
  return variants[variants.length - 1]?.recipe ?? null;
}

/** A crude-pool sound is silent in a classic room, so it can never leak modes. */
export function isPlayableInMode(event: SfxEventId, mode: 'classic' | 'crude'): boolean {
  return mode === 'crude' || !CRUDE_ONLY_SFX.has(event);
}

/**
 * Crude mode swaps some cues for their gross-out equivalents. The *event* the server
 * sends is unchanged — only what it sounds like differs.
 */
const CRUDE_SUBSTITUTIONS: Partial<Record<SfxEventId, SfxEventId>> = {
  sad_trombone: 'fart_large',
  buzzer: 'fart_small',
  splat: 'wet_splat',
  applause: 'wheeze_laugh',
  awkward_cough: 'wheeze_laugh',
};

export function resolveEvent(event: SfxEventId, mode: 'classic' | 'crude'): SfxEventId {
  if (mode !== 'crude') return event;
  // Substitute only half the time, so a crude room still hears the real cue often
  // enough to keep the joke funny rather than exhausting.
  if (Math.random() < 0.5) return event;
  return CRUDE_SUBSTITUTIONS[event] ?? event;
}
