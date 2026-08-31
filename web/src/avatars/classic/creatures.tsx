/**
 * BLURT — classic avatars, part one: things that are alive (mostly).
 *
 * House style, non-negotiable across every pack: flat colour, bold ink outline, no
 * gradients, no shading, no realism. Each icon has to read as a silhouette at 40px
 * and still look deliberate at 128px, so details are few and large.
 *
 * `var(--c-ink)` is the outline everywhere, so the whole set re-themes with the
 * brand. One highlight per icon uses `currentColor`, which the avatar ring sets.
 */

import type { AvatarEntry } from '../registry.js';

const INK = 'var(--c-ink)';
const S = 3.2;

/** Shared wrapper: one viewBox, one stroke style, nothing else to remember. */
function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke={INK} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

const Raccoon = (): React.JSX.Element => (
  <Frame>
    {/* Big triangular ears set wide: the silhouette has to say "raccoon" before any
        detail resolves. */}
    <path d="M9 26 6 6l17 9z" fill="#8E9AA6" />
    <path d="M55 26 58 6 41 15z" fill="#8E9AA6" />
    <path d="M32 13c13 0 21 9 21 20 0 12-9 20-21 20s-21-8-21-20c0-11 8-20 21-20z" fill="#C3CCD4" />
    {/* The mask runs the full width of the face and is the darkest thing here, so it
        survives being 12 pixels tall. */}
    <path d="M11 31c6-4 12-6 21-6s15 2 21 6c-1 6-4 10-8 11-4-1-7-3-13-3s-9 2-13 3c-4-1-7-5-8-11z" fill={INK} stroke="none" />
    <circle cx="23" cy="34" r="4" fill="#FFFBF2" stroke="none" />
    <circle cx="41" cy="34" r="4" fill="#FFFBF2" stroke="none" />
    <circle cx="23" cy="34" r="1.7" fill={INK} stroke="none" />
    <circle cx="41" cy="34" r="1.7" fill={INK} stroke="none" />
    <path d="M32 43a3.4 3.4 0 0 0-3.4 3.4h6.8A3.4 3.4 0 0 0 32 43z" fill={INK} stroke="none" />
    <path d="M26 51c4 3 8 3 12 0" />
  </Frame>
);

const Possum = (): React.JSX.Element => (
  <Frame>
    {/* Bare prehensile tail curling out of the silhouette — reads even as a blob. */}
    <path d="M50 44c9 2 10 12 2 15" stroke="#E9C9D6" strokeWidth={5} />
    <path d="M13 22 9 8l13 7z" fill="#F0DCE4" />
    <path d="M51 22 55 8 42 15z" fill="#F0DCE4" />
    <path d="M32 12c11 0 18 8 18 18 0 6-2 10-5 13l-13 12-13-12c-3-3-5-7-5-13 0-10 7-18 18-18z" fill="#E4E9ED" />
    {/* Long pointed snout, the possum's actual signature. */}
    <path d="M32 34c4 0 7 3 7 7 0 5-4 9-7 12-3-3-7-7-7-12 0-4 3-7 7-7z" fill="#F0DCE4" />
    <circle cx="24" cy="29" r="3" fill={INK} stroke="none" />
    <circle cx="40" cy="29" r="3" fill={INK} stroke="none" />
    <circle cx="32" cy="42" r="2.2" fill={INK} stroke="none" />
    {/* Two teeth. Small, but they are what make it funny rather than generic. */}
    <path d="M29 47l1.6 4M35 47l-1.6 4" stroke="#FFFBF2" strokeWidth={2.4} />
  </Frame>
);

const ScreamingBanana = (): React.JSX.Element => (
  <Frame>
    <path d="M18 8c-1 22 6 40 26 46-6 6-16 6-24 1C10 49 6 30 12 12z" fill="#F5D547" />
    <path d="M18 8c2-2 6-2 7 1" strokeWidth={S} />
    <circle cx="22" cy="26" r="2.6" fill={INK} stroke="none" />
    <circle cx="32" cy="30" r="2.6" fill={INK} stroke="none" />
    <ellipse cx="28" cy="42" rx="7" ry="9" fill={INK} stroke="none" transform="rotate(-18 28 42)" />
    <path d="M44 42c3 2 6 2 8 0" stroke="currentColor" strokeWidth={4} />
  </Frame>
);

const Pickle = (): React.JSX.Element => (
  <Frame>
    <path d="M22 8c9-3 18 3 20 13 3 15-3 30-13 35-9 4-17-2-18-12C9 30 12 12 22 8z" fill="#7CB342" />
    <circle cx="22" cy="24" r="1.8" fill="#4E7A22" stroke="none" />
    <circle cx="32" cy="34" r="1.8" fill="#4E7A22" stroke="none" />
    <circle cx="20" cy="42" r="1.8" fill="#4E7A22" stroke="none" />
    <circle cx="31" cy="17" r="1.8" fill="#4E7A22" stroke="none" />
    <circle cx="25" cy="30" r="3" fill="#FFFBF2" />
    <circle cx="36" cy="26" r="3" fill="#FFFBF2" />
    <circle cx="25" cy="30" r="1.3" fill={INK} stroke="none" />
    <circle cx="36" cy="26" r="1.3" fill={INK} stroke="none" />
    <path d="M25 44c4 3 9 2 12-2" />
  </Frame>
);

const Skeleton = (): React.JSX.Element => (
  <Frame>
    <path d="M14 28c0-11 8-18 18-18s18 7 18 18c0 7-3 11-6 14v8H20v-8c-3-3-6-7-6-14z" fill="#FFFBF2" />
    <ellipse cx="24" cy="29" rx="5" ry="6" fill={INK} stroke="none" />
    <ellipse cx="40" cy="29" rx="5" ry="6" fill={INK} stroke="none" />
    <path d="M32 36l-3 6h6z" fill={INK} stroke="none" />
    <path d="M24 50v6M32 50v6M40 50v6" strokeWidth={2.6} />
    <path d="M20 46h24" strokeWidth={2.6} />
  </Frame>
);

const Clown = (): React.JSX.Element => (
  <Frame>
    <circle cx="32" cy="34" r="19" fill="#FFF0DC" />
    <path d="M13 30c-6-2-8-8-4-12 5-4 11 2 11 6" fill="#E4572E" />
    <path d="M51 30c6-2 8-8 4-12-5-4-11 2-11 6" fill="#E4572E" />
    <path d="M20 16c4-6 20-6 24 0-4-3-20-3-24 0z" fill="#7D5BA6" />
    <circle cx="24" cy="31" r="2.8" fill={INK} stroke="none" />
    <circle cx="40" cy="31" r="2.8" fill={INK} stroke="none" />
    <path d="M20 20c4-5 20-5 24 0" strokeWidth={2.6} />
    <circle cx="32" cy="38" r="5" fill="#E4572E" />
    <path d="M22 44c5 6 15 6 20 0" stroke="currentColor" strokeWidth={3.6} />
  </Frame>
);

const Grandma = (): React.JSX.Element => (
  <Frame>
    <circle cx="32" cy="16" r="8" fill="#C9C3D6" />
    <path d="M12 36c0-11 9-18 20-18s20 7 20 18c0 10-9 17-20 17s-20-7-20-17z" fill="#FFE0C2" />
    <circle cx="24" cy="34" r="6" fill="none" strokeWidth={2.6} />
    <circle cx="41" cy="34" r="6" fill="none" strokeWidth={2.6} />
    <path d="M30 34h5" strokeWidth={2.4} />
    <path d="M12 32c2-8 8-12 20-12s18 4 20 12c-3-2-9-4-20-4s-17 2-20 4z" fill="#C9C3D6" />
    <path d="M26 44c4 3 8 3 12 0" />
    <circle cx="18" cy="42" r="3" fill="currentColor" stroke="none" opacity="0.6" />
    <circle cx="46" cy="42" r="3" fill="currentColor" stroke="none" opacity="0.6" />
  </Frame>
);

const Alien = (): React.JSX.Element => (
  <Frame>
    <path d="M32 8c13 0 21 9 21 20 0 14-11 26-21 26S11 42 11 28C11 17 19 8 32 8z" fill="#8FD694" />
    <ellipse cx="23" cy="30" rx="6.5" ry="9" fill={INK} stroke="none" transform="rotate(-16 23 30)" />
    <ellipse cx="41" cy="30" rx="6.5" ry="9" fill={INK} stroke="none" transform="rotate(16 41 30)" />
    <path d="M27 45h10" strokeWidth={2.6} />
    <path d="M20 12 16 4M44 12l4-8" strokeWidth={2.6} />
    <circle cx="16" cy="3" r="2.6" fill="currentColor" stroke="none" />
    <circle cx="48" cy="3" r="2.6" fill="currentColor" stroke="none" />
  </Frame>
);

const SmokingFish = (): React.JSX.Element => (
  <Frame>
    <path d="M8 32c8-11 22-14 32-10 6 2 10 6 12 10-2 4-6 8-12 10-10 4-24 1-32-10z" fill="#4FA3D1" />
    <path d="M52 32c4-4 8-6 8-6v12s-4-2-8-6z" fill="#2E7BA6" />
    <circle cx="20" cy="28" r="3.6" fill="#FFFBF2" />
    <circle cx="20" cy="28" r="1.7" fill={INK} stroke="none" />
    <path d="M16 38h10" strokeWidth={2.6} />
    <path d="M26 38h12" stroke="#FFFBF2" strokeWidth={4} />
    <path d="M38 38h4" stroke="#E4572E" strokeWidth={4.4} />
    <path d="M44 34c2-3 0-5 2-7" stroke="currentColor" strokeWidth={2.4} />
  </Frame>
);

export const classicCreatures: AvatarEntry[] = [
  { id: 'raccoon', name: 'Raccoon', pack: 'classic', tags: ['animal', 'trash'], Component: Raccoon },
  { id: 'possum', name: 'Possum', pack: 'classic', tags: ['animal', 'trash'], Component: Possum },
  { id: 'banana', name: 'Screaming Banana', pack: 'classic', tags: ['food', 'loud'], Component: ScreamingBanana },
  { id: 'pickle', name: 'Pickle', pack: 'classic', tags: ['food'], Component: Pickle },
  { id: 'skeleton', name: 'Skeleton', pack: 'classic', tags: ['spooky'], Component: Skeleton },
  { id: 'clown', name: 'Clown', pack: 'classic', tags: ['spooky', 'party'], Component: Clown },
  { id: 'grandma', name: 'Grandma', pack: 'classic', tags: ['person'], Component: Grandma },
  { id: 'alien', name: 'Alien', pack: 'classic', tags: ['space'], Component: Alien },
  { id: 'fish', name: 'Smoking Fish', pack: 'classic', tags: ['animal', 'bad habits'], Component: SmokingFish },
];
