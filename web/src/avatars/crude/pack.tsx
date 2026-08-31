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
    {/* Two overlapping lobes: an actual outline rather than a disc with a line on it. */}
    <path d="M32 15c-4-4-11-4-15 0-5 5-6 15-3 22 3 8 10 12 18 12s15-4 18-12c3-7 2-17-3-22-4-4-11-4-15 0z" fill="#F0C9A4" />
    <path d="M32 15v33" strokeWidth={3.4} />
  </Frame>
);

const HairyButt = (): React.JSX.Element => (
  <Frame>
    {/* Tufts drawn first and left proud of the body: a spiky outline reads at any size. */}
    <path d="M13 26c-4-3-6-7-5-11M51 26c4-3 6-7 5-11M9 38H2M55 38h7M15 51c-3 3-7 4-10 3M49 51c3 3 7 4 10 3M22 13c-1-4 0-8 2-10M42 13c1-4 0-8-2-10"
      stroke={INK} strokeWidth={3.4} />
    <path d="M32 15c-4-4-11-4-15 0-5 5-6 15-3 22 3 8 10 12 18 12s15-4 18-12c3-7 2-17-3-22-4-4-11-4-15 0z" fill="#D9A87E" />
    <path d="M32 15v33" strokeWidth={3.4} />
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
    {/* Torn top edge. A clean rectangle is a box; a ragged one is a wrapper. */}
    <path d="M11 18l5-4 5 4 5-4 5 4 5-4 5 4 5-4 5 4v30c0 2-2 4-4 4H15c-2 0-4-2-4-4z" fill="#E8622F" />
    <path d="M11 24h42" stroke="#A63C15" strokeWidth={2.4} />
    {/* The ring pressed through the foil, which is the giveaway. */}
    <circle cx="32" cy="38" r="9" fill="none" stroke="#A63C15" strokeWidth={3} />
    <circle cx="32" cy="38" r="3.4" fill="#A63C15" stroke="none" />
    <path d="M17 52h12" stroke="#A63C15" strokeWidth={2.2} />
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
    <path d="M13 26c0-7 9-12 19-12s19 5 19 12c0 5-1 7-1 12 0 11-8 19-18 19s-18-8-18-19c0-5-1-7-1-12z" fill="#F0C9A4" />
    {/* Waistband cutting across the bottom: the gut has to be overhanging something. */}
    <path d="M13 44c6 5 32 5 38 0v7c-6 5-32 5-38 0z" fill="#3E5C76" />
    <path d="M28 44v7M36 44v7" stroke="#243A4D" strokeWidth={2.2} />
    <circle cx="32" cy="33" r="4.4" fill="none" strokeWidth={3} />
    {/* A can, held. Outside the body, so it survives being tiny. */}
    <rect x="48" y="20" width="12" height="17" rx="2.5" fill="#C23B4B" />
    <path d="M48 26h12" strokeWidth={2.2} />
  </Frame>
);

const GasCloud = (): React.JSX.Element => (
  <Frame>
    {/* Stink lines outside the cloud — the universal shorthand, and free silhouette. */}
    <path d="M12 12c-3-3-2-7 1-9M32 8c-3-3-2-8 1-10M52 12c3-3 2-7-1-9" stroke={INK} strokeWidth={2.8} />
    {/* Billows, not a rounded rectangle. */}
    <path d="M17 47c-6 0-10-5-10-10 0-4 3-8 7-9 0-8 6-14 14-14 6 0 11 3 13 8 6-1 12 3 13 9 4 1 6 5 6 8 0 5-4 8-10 8z" fill="#9FCB6B" />
    <circle cx="24" cy="30" r="3" fill={INK} stroke="none" />
    <circle cx="40" cy="30" r="3" fill={INK} stroke="none" />
    {/* A smug little smile beats a neutral curve. */}
    <path d="M25 37c4 5 10 5 14 0" strokeWidth={2.8} />
    <path d="M18 54c5 3 9 0 14 3s9 0 14 3" strokeWidth={2.6} stroke="currentColor" />
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
    {/* Stars outside the body: instant "space", and free silhouette. */}
    <path d="M9 14v6M6 17h6M55 44v6M52 47h6" stroke={INK} strokeWidth={2.6} />
    {/* A real crescent. The concave bite is what stops this being a coin. */}
    <path d="M40 6c-14 0-25 11-25 25s11 25 25 25c4 0 8-1 11-3-11-3-19-12-19-22s8-19 19-22c-3-2-7-3-11-3z" fill="#F2E3A8" />
    {/* Cheeks sitting in the crescent's mouth, mooning out of it. */}
    <path d="M43 20c-3-3-8-3-11 0-4 4-4 12-2 17 2 5 6 8 11 8s9-3 11-8c2-5 2-13-2-17-3-3-8-3-11 0z" fill="#F0C9A4" />
    <path d="M43 20v25" strokeWidth={3} />
    <circle cx="24" cy="20" r="2.4" fill="#D9C77E" stroke="none" />
    <circle cx="21" cy="38" r="3" fill="#D9C77E" stroke="none" />
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
