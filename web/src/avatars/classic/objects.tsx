/**
 * BLURT — classic avatars, part two: things that are not alive but have opinions.
 *
 * Same house style as `creatures.tsx`: flat colour, bold ink outline, no gradients,
 * no shading, legible at 40px.
 */

import type { AvatarEntry } from '../registry.js';

const INK = 'var(--c-ink)';
const S = 3.2;

function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke={INK} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

const HotDog = (): React.JSX.Element => (
  <Frame>
    <path d="M8 38c0-8 8-12 24-12s24 4 24 12-8 12-24 12S8 46 8 38z" fill="#E8B87D" />
    <path d="M10 34c4-6 12-8 22-8s18 2 22 8c-4 4-12 6-22 6s-18-2-22-6z" fill="#C4553B" />
    <path d="M14 32c4 4 8-4 12 0s8-4 12 0 8-4 12 0" stroke="#F0C808" strokeWidth={3.4} />
    <circle cx="24" cy="42" r="2.2" fill={INK} stroke="none" />
    <circle cx="40" cy="42" r="2.2" fill={INK} stroke="none" />
    <path d="M29 46c2 2 4 2 6 0" strokeWidth={2.4} />
  </Frame>
);

const CowboyBoot = (): React.JSX.Element => (
  <Frame>
    <path d="M19 8h17v24c0 3 2 5 6 6l10 3c4 1 6 4 6 8v3H19z" fill="#B4643A" />
    {/* Heel notched out of the sole: the gap is what makes the L read as a boot. */}
    <path d="M19 52h33v5H19zM40 57h11v4H40z" fill="#63301A" />
    <path d="M19 20h17" strokeWidth={2.8} />
    <path d="M23 12l5 4-5 4M33 12l-5 4 5 4" strokeWidth={2.6} stroke="currentColor" />
    {/* Spur breaks the outline, which is worth more than any surface detail. */}
    <circle cx="59" cy="47" r="5" fill="#E8C84F" />
    <path d="M54 47h10M59 42v10" strokeWidth={2.2} />
  </Frame>
);

const AngryToaster = (): React.JSX.Element => (
  <Frame>
    {/* Toast first, so it sits behind the body and breaks the top edge. */}
    <path d="M21 20h9v-6c0-3 4-3 4 0v6h9v-8H21z" fill="#E8A33D" />
    <rect x="19" y="4" width="26" height="12" rx="3" fill="#E8A33D" />
    <rect x="7" y="18" width="50" height="34" rx="8" fill="#CFD6DB" />
    <path d="M17 18h13v-3H17zM34 18h13v-3H34z" fill="#4C5964" />
    {/* Heavy angled brows: the one shape carrying the expression at 40px. */}
    <path d="M15 30l10 4M49 30l-10 4" strokeWidth={4} />
    <circle cx="23" cy="39" r="3" fill={INK} stroke="none" />
    <circle cx="41" cy="39" r="3" fill={INK} stroke="none" />
    <path d="M25 48c4-4 10-4 14 0" strokeWidth={2.8} />
    <rect x="49" y="26" width="6" height="16" rx="3" fill="currentColor" />
  </Frame>
);

const CreepyDoll = (): React.JSX.Element => (
  <Frame>
    <path d="M11 30c0-13 9-22 21-22s21 9 21 22-9 23-21 23-21-10-21-23z" fill="#FBE3D0" />
    {/* Blunt fringe, straight across. Dolls do not have soft hair. */}
    <path d="M11 27c1-13 9-20 21-20s20 7 21 20c-3-7-11-10-21-10s-18 3-21 10z" fill="#5B3A22" />
    <path d="M32 8v9M22 10l2 8M42 10l-2 8" stroke="#3E2716" strokeWidth={2} />
    {/* One eye open, one shut. Asymmetry is the cheapest way to make a face wrong. */}
    <circle cx="23" cy="33" r="6.5" fill="#FFFBF2" />
    <circle cx="23" cy="33" r="3.2" fill={INK} stroke="none" />
    <path d="M35 33c3-3 8-3 11 0" strokeWidth={2.8} />
    <path d="M30 46a2.6 2.6 0 1 0 5 0 2.6 2.6 0 1 0-5 0z" fill="#C23B4B" stroke="none" />
    {/* The crack. Reads as a dark line even when everything else has muddied. */}
    <path d="M44 18l-4 9 5 4-3 7" stroke={INK} strokeWidth={2.2} />
    <circle cx="15" cy="41" r="3.4" fill="#E9788E" stroke="none" opacity="0.85" />
    <circle cx="49" cy="41" r="3.4" fill="#E9788E" stroke="none" opacity="0.85" />
  </Frame>
);

const Toilet = (): React.JSX.Element => (
  <Frame>
    <rect x="12" y="8" width="34" height="20" rx="4" fill="#E8EEF2" />
    <path d="M14 30h38c0 12-8 20-19 20s-19-8-19-20z" fill="#F4F8FA" />
    <ellipse cx="33" cy="34" rx="13" ry="6" fill="#CBD8E0" />
    <rect x="22" y="50" width="22" height="6" rx="2" fill="#E8EEF2" />
    <rect x="46" y="12" width="6" height="4" rx="2" fill="currentColor" />
    <circle cx="27" cy="34" r="1.8" fill={INK} stroke="none" />
    <circle cx="39" cy="34" r="1.8" fill={INK} stroke="none" />
  </Frame>
);

const Eyeball = (): React.JSX.Element => (
  <Frame>
    <circle cx="32" cy="32" r="22" fill="#FFFBF2" />
    <path d="M14 24c6 3 10 4 14 3M50 24c-6 3-10 4-14 3M14 42c6-3 12-4 16-2M50 42c-6-3-11-4-15-2" stroke="#D1495B" strokeWidth={2.2} />
    <circle cx="32" cy="32" r="11" fill="#3E7CB1" />
    <circle cx="32" cy="32" r="5" fill={INK} stroke="none" />
    <circle cx="28" cy="28" r="2.4" fill="#FFFBF2" stroke="none" />
    <path d="M32 10v-4M32 54v4" stroke="currentColor" strokeWidth={2.6} />
  </Frame>
);

const AngryMug = (): React.JSX.Element => (
  <Frame>
    <path d="M10 20h34v24c0 6-5 10-12 10H22c-7 0-12-4-12-10z" fill="#E4572E" />
    <path d="M44 26h6a7 7 0 0 1 0 14h-6" fill="none" strokeWidth={S} />
    <path d="M18 30l7 3M38 30l-7 3" strokeWidth={3} />
    <circle cx="23" cy="38" r="2.4" fill={INK} stroke="none" />
    <circle cx="33" cy="38" r="2.4" fill={INK} stroke="none" />
    <path d="M23 46c3-3 7-3 10 0" strokeWidth={2.6} />
    <path d="M20 12c0-4 4-4 4-8M32 12c0-4 4-4 4-8" stroke="currentColor" strokeWidth={2.6} />
  </Frame>
);

const RubberChicken = (): React.JSX.Element => (
  <Frame>
    {/* Head at the top, body slumping away: the silhouette does the work. */}
    <path d="M34 8c7 0 11 5 11 11 0 5-3 7-3 11 0 6 5 9 5 16 0 6-5 11-13 11s-13-5-13-11c0-8 5-10 5-17 0-5-3-7-3-10 0-6 4-11 11-11z" fill="#F5D547" />
    <path d="M30 7c1-4 6-5 8-2-2 1-3 2-3 4M36 5c2-3 7-3 8 0-2 0-4 1-5 3" fill="#D93A3A" stroke="#D93A3A" />
    <path d="M46 18l9 4-9 4z" fill="#F0A202" />
    <circle cx="39" cy="18" r="2.8" fill={INK} stroke="none" />
    {/* Limp dangling feet — the reason anybody finds one of these funny. */}
    <path d="M27 57l-5 5M27 57l1 6M37 57l5 5M37 57l-1 6" stroke="#F0A202" strokeWidth={3} />
  </Frame>
);

const Meatball = (): React.JSX.Element => (
  <Frame>
    {/* Spaghetti sits *under* the meatball and never wider than it: the first pass
        ran the strands out sideways and they read as whiskers. */}
    <path d="M14 52c6 3 30 3 36 0M12 57c8 3 32 3 40 0M17 47c5 3 25 3 30 0"
      stroke="#E8C33D" strokeWidth={3.4} strokeLinecap="round" />
    <path d="M32 12c9 0 15 4 19 10 3 5 3 12-1 17-4 6-11 9-18 9s-14-3-18-9c-4-5-4-12-1-17 4-6 10-10 19-10z" fill="#A85E38" />
    {/* Sauce as one bold shape draping over the top, with two drips. */}
    <path d="M13 26c8-8 30-8 38 0-2 5-4 8-6 7-3-1-3-5-6-4-3 2-2 6-6 6s-4-4-7-4c-3-1-3 3-6 2-2-1-5-4-7-7z" fill="#C4553B" />
    <path d="M18 33c1 4 0 6-1 8M46 33c-1 4 0 6 1 8" stroke="#C4553B" strokeWidth={3} />
    <circle cx="25" cy="37" r="4.4" fill="#FFFBF2" />
    <circle cx="39" cy="37" r="4.4" fill="#FFFBF2" />
    <circle cx="25" cy="37" r="2" fill={INK} stroke="none" />
    <circle cx="39" cy="37" r="2" fill={INK} stroke="none" />
    <path d="M27 46c4 4 9 4 11 0" strokeWidth={2.8} />
  </Frame>
);

export const classicObjects: AvatarEntry[] = [
  { id: 'hotdog', name: 'Hot Dog', pack: 'classic', tags: ['food'], Component: HotDog },
  { id: 'boot', name: 'Cowboy Boot', pack: 'classic', tags: ['object'], Component: CowboyBoot },
  { id: 'toaster', name: 'Angry Toaster', pack: 'classic', tags: ['object', 'angry'], Component: AngryToaster },
  { id: 'doll', name: 'Creepy Doll', pack: 'classic', tags: ['spooky'], Component: CreepyDoll },
  { id: 'toilet', name: 'Toilet', pack: 'classic', tags: ['object'], Component: Toilet },
  { id: 'eyeball', name: 'Weird Eyeball', pack: 'classic', tags: ['spooky'], Component: Eyeball },
  { id: 'mug', name: 'Angry Coffee Mug', pack: 'classic', tags: ['object', 'angry'], Component: AngryMug },
  { id: 'chicken', name: 'Rubber Chicken', pack: 'classic', tags: ['object', 'party'], Component: RubberChicken },
  { id: 'meatball', name: 'Sentient Meatball', pack: 'classic', tags: ['food'], Component: Meatball },
];
