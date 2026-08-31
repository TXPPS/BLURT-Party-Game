/**
 * BLURT — brand.
 *
 * **This is the only file you edit to rename or re-theme the game.** The name, the
 * tagline and every colour live here; nothing is hardcoded in a component, and
 * `tokens.css` holds only *structural* tokens (spacing, radii, motion) with no
 * palette of its own.
 *
 * The palette is written into `:root` as CSS custom properties by `applyBrand()`,
 * called synchronously in `main.tsx` before React's first render — so there is no
 * flash of unstyled colour, and there is exactly one source of truth.
 */

export const brand = {
  name: 'BLURT',
  tagline: 'You said it. We decide what it meant.',
  /** Shown under the logo on the home screen. */
  blurb: 'Answer the question. Watch it end up somewhere it absolutely should not.',
  /** Used in the document title and share text. */
  shortDescription: 'A party game about being quoted out of context.',
} as const;

/**
 * The look: bright, warm, printed-card. Deliberately *not* a dashboard, not
 * cyberpunk, not a gradient. Everything sits on warm cream paper with hard offset
 * shadows and a heavy ink outline, like a boxed game from a charity shop.
 */
export interface Palette {
  /** Page background — warm cream, never white. */
  paper: string;
  /** Card surface, a shade lighter than the paper. */
  card: string;
  /** A second surface for nested panels. */
  cardSunken: string;
  /** Text and outlines. A warm brown-black; pure #000 on cream is harsh. */
  ink: string;
  /** Secondary text. */
  inkSoft: string;
  /** Disabled / hint text. Still AA on `card`. */
  inkFaint: string;
  /** The five accents. */
  tomato: string;
  marigold: string;
  teal: string;
  grape: string;
  mint: string;
  /** Semantic roles, mapped from the accents so a re-theme only touches the five. */
  primary: string;
  primaryInk: string;
  danger: string;
  good: string;
  focus: string;
}

export const classicPalette: Palette = {
  paper: '#FBF3E4',
  card: '#FFFBF2',
  cardSunken: '#F4E9D5',
  ink: '#241C14',
  inkSoft: '#5B4B3A',
  inkFaint: '#7A6853',

  tomato: '#E4572E',
  marigold: '#F0A202',
  teal: '#17A398',
  grape: '#7D5BA6',
  mint: '#8FD694',

  primary: '#E4572E',
  primaryInk: '#FFFBF2',
  danger: '#C1292E',
  good: '#17A398',
  focus: '#7D5BA6',
};

/**
 * Crude mode is the same design system with a swapped accent set — hotter, dirtier,
 * more marker-pen. It is applied via `[data-mode="crude"]` on the root, alongside a
 * handful of extra decorative components. There is no second UI.
 */
export const crudePalette: Palette = {
  paper: '#F6EBD9',
  card: '#FFF6E6',
  cardSunken: '#EFDFC5',
  ink: '#1F1710',
  inkSoft: '#54402C',
  inkFaint: '#77604A',

  tomato: '#D6263B',
  marigold: '#FFB300',
  teal: '#00897B',
  grape: '#9C27B0',
  mint: '#AEEA00',

  primary: '#D6263B',
  primaryInk: '#FFF6E6',
  danger: '#8E0000',
  good: '#00897B',
  focus: '#9C27B0',
};

/** The accent ramp components cycle through for players, cards and stamps. */
export const accentOrder: (keyof Palette)[] = ['tomato', 'marigold', 'teal', 'grape', 'mint'];

export type BrandMode = 'classic' | 'crude';

export function paletteFor(mode: BrandMode): Palette {
  return mode === 'crude' ? crudePalette : classicPalette;
}

/**
 * Write a palette into `:root` as custom properties.
 *
 * Called once before first paint and again whenever the room mode changes, which is
 * what makes the crude re-skin a data-attribute flip rather than a second stylesheet.
 */
export function applyBrand(mode: BrandMode, root: HTMLElement = document.documentElement): void {
  const palette = paletteFor(mode);
  for (const [key, value] of Object.entries(palette)) {
    root.style.setProperty(`--c-${kebab(key)}`, value);
  }
  root.dataset.mode = mode;
}

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** A stable accent for a given id, so a player keeps their colour all match. */
export function accentFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const key = accentOrder[hash % accentOrder.length] ?? 'tomato';
  return `var(--c-${kebab(key)})`;
}
