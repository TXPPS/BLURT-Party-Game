/**
 * BLURT — the avatar registry.
 *
 * Adding an avatar is: draw an SVG component in a pack file, add one entry to the
 * array in that file. Adding a whole *pack* is: create the file, export an
 * `AvatarEntry[]`, and register a loader below. Nothing else in the app knows any
 * avatar's name.
 *
 * The crude pack is behind a dynamic import, so a player who never turns Crude on
 * never downloads a byte of it. See CONTENT_GUIDE.md → "Adding an avatar pack".
 */

import type { ComponentType } from 'react';
import { classicCreatures } from './classic/creatures.js';
import { classicObjects } from './classic/objects.js';

export type AvatarPack = 'classic' | 'crude';

export interface AvatarEntry {
  id: string;
  /** Accessible name. Read out by screen readers and shown in the picker. */
  name: string;
  pack: AvatarPack;
  tags: string[];
  Component: ComponentType;
}

/** Always available. */
export const classicAvatars: AvatarEntry[] = [...classicCreatures, ...classicObjects];

let crudeCache: AvatarEntry[] | null = null;

/**
 * Load the 18+ pack. Idempotent, and only ever called once a room is in Crude mode
 * *and* the player has passed the gate.
 */
export async function loadCrudeAvatars(): Promise<AvatarEntry[]> {
  if (crudeCache !== null) return crudeCache;
  const module = await import('./crude/pack.js');
  crudeCache = module.crudeAvatars;
  return crudeCache;
}

/** Everything currently loaded — classic always, crude once it has been fetched. */
export function availableAvatars(): AvatarEntry[] {
  return crudeCache === null ? classicAvatars : [...classicAvatars, ...crudeCache];
}

export function findAvatar(id: string): AvatarEntry | undefined {
  return availableAvatars().find((a) => a.id === id);
}

/**
 * The avatar to actually draw for a player, which is not always the one they picked.
 *
 * A host can switch a room from Crude back to Classic in the lobby, and players who
 * chose a crude avatar are still holding its id. Rather than rewrite what they chose,
 * this resolves an unavailable id to a stable Classic stand-in derived from their
 * player id — so they keep a consistent face, and flipping back to Crude restores the
 * original picture exactly, because the stored id was never touched.
 *
 * Names are deliberately *not* treated this way: an avatar comes from a known pack so
 * a swap is safe, but a name is free text somebody typed and the game cannot tell a
 * crude one from any other. Silently rewriting what a player wrote is worse than
 * leaving it. The mode governs what the game serves, not what players said.
 */
export function resolveAvatar(id: string, seed: string): AvatarEntry | undefined {
  const exact = findAvatar(id);
  if (exact !== undefined) return exact;
  if (id === '' || classicAvatars.length === 0) return undefined;

  let hash = 0;
  const key = seed === '' ? id : seed;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return classicAvatars[hash % classicAvatars.length];
}

/** A deterministic default, so a player who never picks still has a face. */
export function defaultAvatarId(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return classicAvatars[hash % classicAvatars.length]?.id ?? 'raccoon';
}
