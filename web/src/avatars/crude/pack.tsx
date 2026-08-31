/**
 * BLURT — the 18+ avatar pack.
 *
 * Loaded only in Crude mode, and only after the player has passed the gate. This
 * module is a separate chunk; a classic-only player never downloads it.
 *
 * **Style mandate, enforced by review:** flat, dumb, exaggerated cartoon stickers.
 * Bold outlines, three to five flat colours, no shading, no realism, no anatomical
 * detail. These should read as things drawn on a toilet door with a marker, not as
 * illustration. Nothing here is rendered explicitly, and nothing depicts a person.
 */

import type { AvatarEntry } from '../registry.js';

const INK = 'var(--c-ink)';
const S = 3.4;

function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke={INK} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** ONE-NUT WONDER — one comically oversized lopsided orb, tiny sad eyes. */
const OneNutWonder = (): React.JSX.Element => (
  <Frame>
    <path d="M32 12c10 0 20 9 20 22s-9 22-22 22c-12 0-20-8-20-18 0-8 5-13 9-17 3-3 6-9 13-9z" fill="#F0C9A4" />
    <circle cx="22" cy="24" r="6" fill="#E0B189" />
    <path d="M28 34c3-2 6-2 9 0" strokeWidth={2.4} />
    <circle cx="27" cy="42" r="1.9" fill={INK} stroke="none" />
    <circle cx="38" cy="42" r="1.9" fill={INK} stroke="none" />
    <path d="M29 50c2-2 5-2 7 0" strokeWidth={2.4} />
    <path d="M14 20c2-3 5-4 8-3" stroke="currentColor" strokeWidth={2.4} />
  </Frame>
);

/** WIENER IN THE WIND — streaming sideways like a heroic windsock. */
const WienerInTheWind = (): React.JSX.Element => (
  <Frame>
    <path d="M12 38c0-8 5-13 12-13 10 0 14 6 24 6 6 0 10-2 12-4-2 8-8 13-16 13-10 0-14-4-22-4-5 0-8 1-10 2z" fill="#F0A88A" />
    <circle cx="14" cy="44" r="7" fill="#E08E6E" />
    <circle cx="24" cy="46" r="6" fill="#E08E6E" />
    <path d="M53 24c-6 3-11 3-15 2" stroke="currentColor" strokeWidth={2.6} />
    <path d="M6 22h14M2 30h12M6 54h10" strokeWidth={2.6} stroke="currentColor" />
    <circle cx="46" cy="34" r="1.7" fill={INK} stroke="none" />
  </Frame>
);

/** CENSOR BAR — a black bar with confused eyes peeking over it. */
const CensorBar = (): React.JSX.Element => (
  <Frame>
    <circle cx="24" cy="20" r="6" fill="#FFFBF2" />
    <circle cx="42" cy="20" r="6" fill="#FFFBF2" />
    <circle cx="25" cy="21" r="2.6" fill={INK} stroke="none" />
    <circle cx="41" cy="22" r="2.6" fill={INK} stroke="none" />
    <path d="M16 12c3-3 7-3 10-1M38 11c3-2 7-2 10 1" strokeWidth={2.6} />
    <rect x="6" y="30" width="52" height="18" rx="3" fill={INK} />
    <path d="M14 56h36" stroke="currentColor" strokeWidth={3} />
  </Frame>
);

const Butt = (): React.JSX.Element => (
  <Frame>
    <path d="M32 14c12 0 20 9 20 20s-8 18-20 18-20-8-20-18 8-20 20-20z" fill="#F0C9A4" />
    <path d="M32 16v34" strokeWidth={3} />
    <path d="M20 30c-4 2-6 6-6 10M44 30c4 2 6 6 6 10" strokeWidth={2.4} stroke="currentColor" />
  </Frame>
);

const HairyButt = (): React.JSX.Element => (
  <Frame>
    <path d="M32 14c12 0 20 9 20 20s-8 18-20 18-20-8-20-18 8-20 20-20z" fill="#E8BE96" />
    <path d="M32 16v34" strokeWidth={3} />
    <path d="M18 22c-2-3-5-4-8-3M46 22c2-3 5-4 8-3M14 34h-6M50 34h6M18 46c-2 3-5 4-8 4M46 46c2 3 5 4 8 4" strokeWidth={2.4} />
    <path d="M24 12c0-3 2-5 4-6M36 12c0-3 2-5 4-6" strokeWidth={2.4} stroke="currentColor" />
  </Frame>
);

const Poop = (): React.JSX.Element => (
  <Frame>
    <path d="M22 22c0-5 4-8 9-8s9 3 9 8c5 0 9 3 9 8 0 3-1 5-3 6 3 1 5 4 5 7 0 5-4 9-10 9H23c-6 0-10-4-10-9 0-3 2-6 5-7-2-1-3-3-3-6 0-5 4-8 7-8z" fill="#8D5A3B" />
    <circle cx="26" cy="38" r="3.4" fill="#FFFBF2" />
    <circle cx="39" cy="38" r="3.4" fill="#FFFBF2" />
    <circle cx="26" cy="38" r="1.6" fill={INK} stroke="none" />
    <circle cx="39" cy="38" r="1.6" fill={INK} stroke="none" />
    <path d="M27 47c3 3 8 3 11 0" strokeWidth={2.6} stroke="currentColor" />
  </Frame>
);

const Condom = (): React.JSX.Element => (
  <Frame>
    <rect x="12" y="14" width="40" height="36" rx="6" fill="#E4572E" />
    <path d="M12 24h40M12 40h40" strokeWidth={2.4} />
    <circle cx="32" cy="32" r="7" fill="#FFFBF2" />
    <path d="M28 32h8M32 28v8" strokeWidth={2.6} />
    <path d="M18 8c3 3 9 3 12 0M36 8c3 3 9 3 10 0" strokeWidth={2.4} stroke="currentColor" />
  </Frame>
);

const WhoopeeCushion = (): React.JSX.Element => (
  <Frame>
    <ellipse cx="30" cy="36" rx="21" ry="15" fill="#D6263B" />
    <path d="M49 32c5-1 9 0 11 2-3 2-7 3-11 2z" fill="#B01B2E" />
    <circle cx="23" cy="34" r="2.4" fill={INK} stroke="none" />
    <circle cx="35" cy="34" r="2.4" fill={INK} stroke="none" />
    <path d="M24 42c4 3 9 3 12 0" strokeWidth={2.4} />
    <path d="M56 24c3-2 6-2 8 0M56 44c3 2 6 2 8 0" strokeWidth={2.4} stroke="currentColor" />
  </Frame>
);

const BeerGut = (): React.JSX.Element => (
  <Frame>
    <path d="M14 24c0-6 8-10 18-10s18 4 18 10c0 4-1 6-1 10 0 10-7 18-17 18s-17-8-17-18c0-4-1-6-1-10z" fill="#F0C9A4" />
    <path d="M14 26c6 4 30 4 36 0" strokeWidth={2.6} />
    <circle cx="32" cy="40" r="4" fill="none" strokeWidth={2.6} />
    <path d="M22 18c2-3 6-4 9-3M40 18c-2-3-5-4-8-3" strokeWidth={2.4} />
    <path d="M8 44c-3 2-4 5-3 8M56 44c3 2 4 5 3 8" strokeWidth={2.4} stroke="currentColor" />
  </Frame>
);

const GasCloud = (): React.JSX.Element => (
  <Frame>
    <path d="M18 40c-6 0-10-4-10-9s4-9 9-9c1-7 7-12 14-12s13 5 14 12c5 0 9 4 9 9s-4 9-10 9z" fill="#B8D98D" />
    <circle cx="25" cy="28" r="2.4" fill={INK} stroke="none" />
    <circle cx="39" cy="28" r="2.4" fill={INK} stroke="none" />
    <path d="M27 34c3 2 7 2 10 0" strokeWidth={2.4} />
    <path d="M20 48c4 3 8 0 12 3s8 0 12 3" strokeWidth={2.6} stroke="currentColor" />
  </Frame>
);

const Plunger = (): React.JSX.Element => (
  <Frame>
    <rect x="28" y="6" width="8" height="28" rx="4" fill="#A8703C" />
    <path d="M12 40c0-8 9-12 20-12s20 4 20 12c0 7-9 14-20 14s-20-7-20-14z" fill="#D6263B" />
    <path d="M14 42c8 4 28 4 36 0" strokeWidth={2.4} />
    <circle cx="26" cy="46" r="2" fill={INK} stroke="none" />
    <circle cx="38" cy="46" r="2" fill={INK} stroke="none" />
    <path d="M26 12h12" strokeWidth={2.4} stroke="currentColor" />
  </Frame>
);

const MoonedMoon = (): React.JSX.Element => (
  <Frame>
    <circle cx="32" cy="32" r="22" fill="#F5E6A8" />
    <circle cx="21" cy="22" r="4" fill="#E0CE84" stroke="none" />
    <circle cx="44" cy="20" r="3" fill="#E0CE84" stroke="none" />
    <circle cx="46" cy="42" r="5" fill="#E0CE84" stroke="none" />
    <path d="M22 34c0-6 4-10 10-10s10 4 10 10-4 12-10 12-10-6-10-12z" fill="#F0C9A4" />
    <path d="M32 26v18" strokeWidth={2.6} />
    <path d="M8 12l4 4M56 12l-4 4" strokeWidth={2.4} stroke="currentColor" />
  </Frame>
);

export const crudeAvatars: AvatarEntry[] = [
  { id: 'onenut', name: 'One-Nut Wonder', pack: 'crude', tags: ['rude'], Component: OneNutWonder },
  { id: 'windsock', name: 'Wiener in the Wind', pack: 'crude', tags: ['rude'], Component: WienerInTheWind },
  { id: 'censorbar', name: 'Censor Bar', pack: 'crude', tags: ['rude', 'meta'], Component: CensorBar },
  { id: 'butt', name: 'Butt', pack: 'crude', tags: ['rude'], Component: Butt },
  { id: 'hairybutt', name: 'Hairy Butt', pack: 'crude', tags: ['rude'], Component: HairyButt },
  { id: 'poop', name: 'Poop', pack: 'crude', tags: ['rude', 'gross'], Component: Poop },
  { id: 'condom', name: 'Novelty Condom', pack: 'crude', tags: ['rude'], Component: Condom },
  { id: 'whoopee', name: 'Whoopee Cushion', pack: 'crude', tags: ['gag'], Component: WhoopeeCushion },
  { id: 'beergut', name: 'Beer Gut', pack: 'crude', tags: ['rude'], Component: BeerGut },
  { id: 'gascloud', name: 'Gas Cloud', pack: 'crude', tags: ['gross'], Component: GasCloud },
  { id: 'plunger', name: 'Plunger', pack: 'crude', tags: ['gross', 'object'], Component: Plunger },
  { id: 'moon', name: 'Mooning Moon', pack: 'crude', tags: ['rude', 'space'], Component: MoonedMoon },
];
