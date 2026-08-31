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
    <path d="M20 6h16v26c0 4 4 6 10 8 6 2 10 4 10 9v5H20z" fill="#A8552F" />
    <path d="M20 44h36v6H20z" fill="#7A3B1E" />
    <path d="M20 18h16" strokeWidth={2.6} />
    <path d="M24 10l4 4-4 4M32 10l-4 4 4 4" strokeWidth={2.4} stroke="currentColor" />
    <circle cx="46" cy="53" r="4" fill="#D8C15E" />
    <path d="M42 53h8M46 49v8" strokeWidth={2} />
  </Frame>
);

const AngryToaster = (): React.JSX.Element => (
  <Frame>
    <rect x="8" y="22" width="48" height="30" rx="7" fill="#D9D9D9" />
    <path d="M18 22h12v-4H18zM34 22h12v-4H34z" fill="#8C8C8C" />
    <path d="M18 33l8 3M46 33l-8 3" strokeWidth={3} />
    <circle cx="24" cy="41" r="2.6" fill={INK} stroke="none" />
    <circle cx="40" cy="41" r="2.6" fill={INK} stroke="none" />
    <path d="M26 48c4-3 8-3 12 0" strokeWidth={2.6} />
    <rect x="48" y="30" width="5" height="14" rx="2.5" fill="currentColor" />
  </Frame>
);

const CreepyDoll = (): React.JSX.Element => (
  <Frame>
    <path d="M12 30c0-12 9-20 20-20s20 8 20 20-9 22-20 22-20-10-20-22z" fill="#FFE9D6" />
    <path d="M12 26c2-12 10-18 20-18s18 6 20 18c-4-6-11-9-20-9s-16 3-20 9z" fill="#8B5E3C" />
    <circle cx="23" cy="32" r="5.5" fill="#FFFBF2" />
    <circle cx="41" cy="32" r="5.5" fill="#FFFBF2" />
    <circle cx="23" cy="32" r="2.6" fill={INK} stroke="none" />
    <circle cx="41" cy="33.5" r="2.6" fill={INK} stroke="none" />
    <path d="M27 44h10" strokeWidth={2.6} />
    <circle cx="17" cy="40" r="3" fill="#E9788E" stroke="none" opacity="0.8" />
    <circle cx="47" cy="40" r="3" fill="#E9788E" stroke="none" opacity="0.8" />
    <path d="M50 14c3-3 7-2 8 1" stroke="currentColor" strokeWidth={2.6} />
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
    <path d="M30 10c8 0 13 6 13 13 0 6-3 9-3 14 0 8 4 12 4 18H22c0-8 4-10 4-18 0-5-4-8-4-14 0-7 5-13 8-13z" fill="#F5D547" />
    <path d="M30 6c3-3 8-2 9 2-3 0-5 1-6 3" fill="#E4572E" />
    <path d="M43 20l8 3-8 3z" fill="#F0A202" />
    <circle cx="36" cy="19" r="2.4" fill={INK} stroke="none" />
    <path d="M22 55h20" strokeWidth={2.6} />
    <path d="M26 45c4 3 8 3 12 0" stroke="currentColor" strokeWidth={2.4} />
  </Frame>
);

const Meatball = (): React.JSX.Element => (
  <Frame>
    <circle cx="32" cy="34" r="21" fill="#8D4A2E" />
    <path d="M14 26c5-4 10-3 13 0M38 22c5-3 9-1 11 2M16 44c4 3 9 3 12 0M38 46c4 2 8 1 10-1" stroke="#6B3520" strokeWidth={2.4} />
    <path d="M12 20c8-6 32-6 40 0-4 4-10 6-20 6s-16-2-20-6z" fill="#C4553B" />
    <circle cx="25" cy="34" r="3.6" fill="#FFFBF2" />
    <circle cx="39" cy="34" r="3.6" fill="#FFFBF2" />
    <circle cx="25" cy="34" r="1.7" fill={INK} stroke="none" />
    <circle cx="39" cy="34" r="1.7" fill={INK} stroke="none" />
    <path d="M27 44c3 3 7 3 10 0" strokeWidth={2.6} stroke="currentColor" />
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
