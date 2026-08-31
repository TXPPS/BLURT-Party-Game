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
    {/* Peel flaps break the outline and say "banana" before any detail resolves. */}
    <path d="M32 9 20 3l-3 12zM32 9l12-6 3 12z" fill="#E8C33D" />
    <path d="M32 8c11 0 17 9 17 21 0 16-8 27-17 27s-17-11-17-27c0-12 6-21 17-21z" fill="#F5D547" />
    <path d="M26 6h12l-2 5h-8z" fill="#7A6853" />
    {/* Eyes squeezed shut, mouth wide: a scream is a big black hole, not a frown. */}
    <path d="M20 26c3-4 8-4 11 0M33 26c3-4 8-4 11 0" strokeWidth={3} />
    <ellipse cx="32" cy="42" rx="9" ry="12" fill={INK} stroke="none" />
    <ellipse cx="32" cy="49" rx="4" ry="4.5" fill="#E4572E" stroke="none" />
  </Frame>
);

const Pickle = (): React.JSX.Element => (
  <Frame>
    {/* Scalloped edge: the one thing that stops this being a green blob. */}
    <path d="M25 6c5-2 10 1 12 5 4-1 7 2 7 6 1 4-2 6-1 10 1 4 4 6 3 10-1 5-5 6-6 10-1 5 1 9-3 12-4 4-10 3-14 0-4-2-4-7-6-11-2-4-6-6-6-11 0-4 3-7 3-11 0-5-2-9 1-13 2-4 6-5 10-7z" fill="#5E9E2E" />
    <path d="M22 20a2.2 2.2 0 1 0 0 .1M31 32a2.2 2.2 0 1 0 0 .1M20 44a2.2 2.2 0 1 0 0 .1M34 14a2.2 2.2 0 1 0 0 .1M36 47a2.2 2.2 0 1 0 0 .1" fill="#38661A" stroke="none" />
    <circle cx="25" cy="29" r="4.6" fill="#FFFBF2" />
    <circle cx="38" cy="26" r="4.6" fill="#FFFBF2" />
    <circle cx="25" cy="29" r="2.1" fill={INK} stroke="none" />
    <circle cx="38" cy="26" r="2.1" fill={INK} stroke="none" />
    <path d="M25 43c5 4 11 2 14-3" strokeWidth={2.8} />
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
    {/* Huge hair well outside the head: this is the silhouette doing all the work. */}
    <circle cx="11" cy="28" r="11" fill="#E4572E" />
    <circle cx="53" cy="28" r="11" fill="#E4572E" />
    <circle cx="32" cy="34" r="18" fill="#FFF4E4" />
    <path d="M14 20c5-9 31-9 36 0-5-5-31-5-36 0z" fill="#7D5BA6" />
    {/* Painted eye triangles read where two dots would not. */}
    <path d="M24 24l5 9-9 0zM40 24l-5 9 9 0z" fill={INK} stroke="none" />
    <circle cx="32" cy="38" r="7" fill="#E4572E" />
    <path d="M19 43c6 10 20 10 26 0" strokeWidth={4} stroke={INK} />
  </Frame>
);

const Grandma = (): React.JSX.Element => (
  <Frame>
    {/* The bun is the silhouette. It has to sit proud of the head to survive 40px. */}
    <circle cx="32" cy="10" r="10" fill="#CFC7DB" />
    <path d="M27 6c3-3 7-3 10 0" stroke="#9E93B5" strokeWidth={2.2} />
    <path d="M13 37c0-11 8-19 19-19s19 8 19 19c0 10-8 17-19 17s-19-7-19-17z" fill="#FFE0C2" />
    <path d="M13 33c1-9 8-14 19-14s18 5 19 14c-4-4-11-6-19-6s-15 2-19 6z" fill="#CFC7DB" />
    {/* Thick spectacle rings: a hairline circle disappears when it is three pixels. */}
    <circle cx="23" cy="36" r="7.5" fill="#FFFBF2" strokeWidth={3.4} />
    <circle cx="42" cy="36" r="7.5" fill="#FFFBF2" strokeWidth={3.4} />
    <circle cx="23" cy="36" r="2.4" fill={INK} stroke="none" />
    <circle cx="42" cy="36" r="2.4" fill={INK} stroke="none" />
    <path d="M30.5 36h4" strokeWidth={3} />
    <path d="M26 48c4 3 8 3 12 0" strokeWidth={2.8} />
    <circle cx="16" cy="44" r="3.4" fill="#E9788E" stroke="none" opacity="0.8" />
    <circle cx="49" cy="44" r="3.4" fill="#E9788E" stroke="none" opacity="0.8" />
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
    <path d="M6 34c8-12 21-15 30-11 6 2 10 6 12 11-2 5-6 9-12 11-9 4-22 1-30-11z" fill="#3E93C4" />
    <path d="M48 34c4-4 9-7 9-7v14s-5-3-9-7z" fill="#26688F" />
    <path d="M22 22c4-3 9-3 12 0" stroke="#26688F" strokeWidth={2.4} />
    <circle cx="19" cy="30" r="4.4" fill="#FFFBF2" />
    <circle cx="19" cy="30" r="2" fill={INK} stroke="none" />
    <path d="M13 40c5 3 10 3 14 0" strokeWidth={2.6} />
    {/* Cigarette: long, white, with a lit end. Small enough to be a detail before. */}
    <path d="M27 42h16" stroke="#FFFBF2" strokeWidth={6} />
    <path d="M43 42h5" stroke="#E4572E" strokeWidth={6} />
    <path d="M27 42h4" stroke="#D9A441" strokeWidth={6} />
    {/* Smoke leaves the icon's box, which is exactly why it reads. */}
    <path d="M50 38c3-4 0-7 3-10 2-3 0-5 1-7" stroke={INK} strokeWidth={2.6} />
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
