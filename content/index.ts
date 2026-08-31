/**
 * BLURT — content registry.
 *
 * Everything in `/content` passes through this module, and it parses on the way
 * through. The server calls `loadContent()` once at start-up; if a story is
 * malformed the room refuses to start with a precise message instead of showing a
 * blank line to a room full of people.
 *
 * Client note: only the *name pools* are imported by the browser bundle, and the
 * crude pool is behind a dynamic import (`loadCrudeNamePools`) so a player who never
 * turns Crude on never downloads it. Stories live server-side only — the client is
 * sent rendered lines, never templates.
 */

import type { GameMode } from '../shared/types.js';
import type { NamePools } from '../shared/nameGenerator.js';
import { classicNamePools } from './classic/names.js';
import { classicStories } from './classic/stories.js';
import { crudeStories } from './crude/stories.js';
import type { Story } from './schema.js';
import { MIN_SLOTS_PER_STORY, storySchema } from './schema.js';

/** Minimum pack sizes the MVP promises. Asserted by `content/validate.test.ts`. */
export const MIN_CLASSIC_STORIES = 4;
export const MIN_CRUDE_STORIES = 3;

export interface ContentBundle {
  classic: Story[];
  crude: Story[];
}

export interface ContentIssue {
  storyIndex: number;
  storyId: string;
  mode: 'classic' | 'crude';
  message: string;
}

export interface ContentLoadResult {
  ok: boolean;
  bundle: ContentBundle;
  issues: ContentIssue[];
}

function parsePack(
  pack: readonly unknown[],
  mode: 'classic' | 'crude',
  issues: ContentIssue[],
): Story[] {
  const parsed: Story[] = [];
  pack.forEach((raw, index) => {
    const id =
      typeof raw === 'object' && raw !== null && 'id' in raw && typeof raw.id === 'string'
        ? raw.id
        : `#${index}`;
    const result = storySchema.safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const path = issue.path.length > 0 ? ` at ${issue.path.join('.')}` : '';
        issues.push({ storyIndex: index, storyId: id, mode, message: `${issue.message}${path}` });
      }
      return;
    }
    if (result.data.mode !== mode) {
      issues.push({
        storyIndex: index,
        storyId: id,
        mode,
        message: `declared mode "${result.data.mode}" but lives in the ${mode} pack`,
      });
      return;
    }
    parsed.push(result.data);
  });
  return parsed;
}

/**
 * Parse and validate the whole content library. Never throws — the caller decides
 * whether a partial library is survivable (it is: a room only needs one story).
 */
export function loadContent(): ContentLoadResult {
  const issues: ContentIssue[] = [];
  const classic = parsePack(classicStories, 'classic', issues);
  const crude = parsePack(crudeStories, 'crude', issues);

  const ids = new Set<string>();
  for (const story of [...classic, ...crude]) {
    if (ids.has(story.id)) {
      issues.push({
        storyIndex: -1,
        storyId: story.id,
        mode: story.mode,
        message: 'duplicate story id across the library',
      });
    }
    ids.add(story.id);
  }

  return { ok: issues.length === 0, bundle: { classic, crude }, issues };
}

/** Cached because the Durable Object may re-enter this on every cold start. */
let cached: ContentLoadResult | null = null;

export function content(): ContentLoadResult {
  cached ??= loadContent();
  return cached;
}

/**
 * Stories available to a room, most-preferred first.
 * Crude rooms may also draw on the classic pack — a filthy room still enjoys a
 * corporate horror story, and it doubles the pool that "don't repeat" works against.
 */
export function storiesForMode(mode: GameMode): Story[] {
  const { bundle } = content();
  return mode === 'crude' ? [...bundle.crude, ...bundle.classic] : [...bundle.classic];
}

/**
 * Choose the next story for a room, avoiding anything played recently.
 * Falls back to the least-recently-played story when every option has been used.
 */
export function pickStory(
  mode: GameMode,
  recentStoryIds: readonly string[],
  randomInt: (maxExclusive: number) => number,
): Story | null {
  const pool = storiesForMode(mode);
  if (pool.length === 0) return null;

  const fresh = pool.filter((s) => !recentStoryIds.includes(s.id));
  const candidates = fresh.length > 0 ? fresh : pool;
  return candidates[randomInt(candidates.length)] ?? candidates[0] ?? null;
}

/**
 * Enough stories, in order, to cover `rounds` slots. A 15-round match through
 * 10-slot stories becomes a double feature rather than a repeat.
 */
export function pickStorySequence(
  mode: GameMode,
  recentStoryIds: readonly string[],
  rounds: number,
  randomInt: (maxExclusive: number) => number,
): Story[] {
  const chosen: Story[] = [];
  const used: string[] = [...recentStoryIds];
  let covered = 0;

  while (covered < rounds) {
    const story = pickStory(mode, used, randomInt);
    if (story === null) break;
    if (chosen.some((s) => s.id === story.id)) break;
    chosen.push(story);
    used.push(story.id);
    covered += story.slots.length;
  }

  return chosen;
}

/* ------------------------------------------------------------------ *
 * Name pools
 * ------------------------------------------------------------------ */

export { classicNamePools };

/**
 * Crude pools, dynamically imported so they are a separate chunk in the browser.
 * Callers merge them with the classic pools — see `shared/nameGenerator.mergePools`.
 */
export async function loadCrudeNamePools(): Promise<NamePools> {
  const module = await import('./crude/names.js');
  return module.crudeNamePools;
}

/* ------------------------------------------------------------------ *
 * Diagnostics for the content linter
 * ------------------------------------------------------------------ */

export interface ContentStats {
  classicStories: number;
  crudeStories: number;
  totalSlots: number;
  minSlotsInAStory: number;
  storiesBelowMinimum: string[];
}

export function contentStats(): ContentStats {
  const { bundle } = content();
  const all = [...bundle.classic, ...bundle.crude];
  const slotCounts = all.map((s) => s.slots.length);
  return {
    classicStories: bundle.classic.length,
    crudeStories: bundle.crude.length,
    totalSlots: slotCounts.reduce((a, b) => a + b, 0),
    minSlotsInAStory: slotCounts.length === 0 ? 0 : Math.min(...slotCounts),
    storiesBelowMinimum: all.filter((s) => s.slots.length < MIN_SLOTS_PER_STORY).map((s) => s.id),
  };
}

export { storySchema, MIN_SLOTS_PER_STORY };
export type { Story };
