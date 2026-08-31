/**
 * BLURT — colour contrast.
 *
 * WCAG AA is checked as a unit test rather than eyeballed in a screenshot, because
 * a ratio is a number and a number can be asserted. Every text/background pair the
 * design actually uses is listed here, in both palettes.
 *
 * If somebody re-themes the game by editing `brand.ts` — which is the whole point of
 * that file — this test tells them immediately whether the new palette is legible.
 */

import { describe, expect, it } from 'vitest';
import { classicPalette, crudePalette, type Palette } from '../web/src/brand.js';

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (linear[0] as number) + 0.7152 * (linear[1] as number) + 0.0722 * (linear[2] as number);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light as number) + 0.05) / ((dark as number) + 0.05);
}

/** AA: 4.5 for body text, 3.0 for large text (≥24px, or ≥19px bold) and UI borders. */
const AA_BODY = 4.5;
const AA_LARGE = 3;

interface Pair {
  what: string;
  fg: keyof Palette;
  bg: keyof Palette;
  min: number;
}

/** Every combination the components actually render. */
const PAIRS: Pair[] = [
  { what: 'body text on the page', fg: 'ink', bg: 'paper', min: AA_BODY },
  { what: 'body text on a card', fg: 'ink', bg: 'card', min: AA_BODY },
  { what: 'body text on a sunken card', fg: 'ink', bg: 'cardSunken', min: AA_BODY },
  { what: 'secondary text on a card', fg: 'inkSoft', bg: 'card', min: AA_BODY },
  { what: 'secondary text on the page', fg: 'inkSoft', bg: 'paper', min: AA_BODY },
  { what: 'hint text on a card', fg: 'inkFaint', bg: 'card', min: AA_BODY },
  { what: 'hint text on the page', fg: 'inkFaint', bg: 'paper', min: AA_BODY },
  { what: 'primary button label', fg: 'primaryInk', bg: 'primary', min: AA_LARGE },
  { what: 'danger button label', fg: 'card', bg: 'danger', min: AA_LARGE },
  { what: 'ink on the marigold room-code panel', fg: 'ink', bg: 'marigold', min: AA_BODY },
  { what: 'ink on a mint winning answer', fg: 'ink', bg: 'mint', min: AA_BODY },
  { what: 'ink on a tomato toast', fg: 'primaryInk', bg: 'tomato', min: AA_LARGE },
  { what: 'ink outline against the page', fg: 'ink', bg: 'paper', min: AA_LARGE },
  { what: 'focus ring against a card', fg: 'focus', bg: 'card', min: AA_LARGE },
  { what: 'delta text on a card', fg: 'good', bg: 'card', min: AA_LARGE },
];

describe.each([
  ['classic', classicPalette],
  ['crude', crudePalette],
])('%s palette meets WCAG AA', (_name, palette) => {
  for (const pair of PAIRS) {
    it(`${pair.what}`, () => {
      const ratio = contrast(palette[pair.fg], palette[pair.bg]);
      expect(
        Number(ratio.toFixed(2)),
        `${pair.fg} (${palette[pair.fg]}) on ${pair.bg} (${palette[pair.bg]}) = ${ratio.toFixed(2)}:1, needs ${pair.min}:1`,
      ).toBeGreaterThanOrEqual(pair.min);
    });
  }
});

describe('palette sanity', () => {
  it.each([
    ['classic', classicPalette],
    ['crude', crudePalette],
  ])('%s uses well-formed six-digit hex everywhere', (_name, palette) => {
    for (const [key, value] of Object.entries(palette)) {
      expect(value, key).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('never puts pure black on the cream paper', () => {
    // A deliberate design rule: warm paper wants warm ink, not #000.
    expect(classicPalette.ink.toUpperCase()).not.toBe('#000000');
    expect(crudePalette.ink.toUpperCase()).not.toBe('#000000');
  });
});
