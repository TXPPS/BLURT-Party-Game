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

/** A deterministic default, so a player who never picks still has a face. */
export function defaultAvatarId(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return classicAvatars[hash % classicAvatars.length]?.id ?? 'raccoon';
}

export const CLASSIC_AVATAR_COUNT = classicAvatars.length;
