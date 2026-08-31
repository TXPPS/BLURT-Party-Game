/**
 * BLURT — the server's side of the story engine.
 *
 * `shared/storyEngine.ts` does the pure assembly; this module owns the *match's*
 * relationship with it: choosing stories, keeping fills, and rendering the right
 * amount of story for the phase that is asking.
 */

import { content, pickStorySequence } from '../../content/index.js';
import type { Slot, Story } from '../../content/schema.js';
import { RECENT_STORY_MEMORY } from '../../shared/constants.js';
import { deriveDrawingPrompts, planSlots, renderStory, type DerivedDrawingPrompt, type SlotFill } from '../../shared/storyEngine.js';
import type { RenderedStory } from '../../shared/types.js';
import type { MatchState, RoomState } from './types.js';

/** Fills are keyed by story *and* slot — slot ids are only unique within a story. */
export function fillKey(storyId: string, slotId: string): string {
  return `${storyId}::${slotId}`;
}

export function storyById(storyId: string): Story | undefined {
  const { bundle } = content();
  return [...bundle.classic, ...bundle.crude].find((s) => s.id === storyId);
}

export function slotFor(storyId: string, slotId: string): Slot | undefined {
  return storyById(storyId)?.slots.find((s) => s.id === slotId);
}

/** The stories a match is playing, in order, skipping any that failed to load. */
export function matchStories(match: MatchState): Story[] {
  return match.storyIds.map(storyById).filter((s): s is Story => s !== undefined);
}

/** Per-story fills, in the shape `renderStory` wants. */
function fillsForStory(match: MatchState, storyId: string): Map<string, SlotFill> {
  const fills = new Map<string, SlotFill>();
  for (const record of Object.values(match.fills)) {
    if (record.storyId !== storyId) continue;
    fills.set(record.slotId, {
      text: record.text,
      authorId: record.authorId,
      authorName: record.authorName,
      authorAvatarId: record.authorAvatarId,
      roundIndex: record.matchupIndex,
    });
  }
  return fills;
}

export interface RenderMatchOptions {
  /** Show everything regardless of progress — the final read-out. */
  revealAll?: boolean;
  /** Fills from this matchup index onward are stamped in as new. */
  freshFrom?: number;
}

/**
 * Render every story in the match. During play this is the story *so far*; at the
 * end it is the whole thing. Skipped slots are always house-filled, so no rendering
 * path can produce a visible blank.
 */
export function renderMatchStories(match: MatchState, options: RenderMatchOptions = {}): RenderedStory[] {
  const rendered: RenderedStory[] = [];
  for (const story of matchStories(match)) {
    const planned = new Set(
      match.plan.filter((a) => a.storyId === story.id).map((a) => a.slotId),
    );
    // A story the match never reached contributes nothing to a mid-match update.
    if (planned.size === 0 && options.revealAll !== true) continue;
    rendered.push(
      renderStory(story, fillsForStory(match, story.id), {
        plannedSlotIds: planned,
        ...(options.revealAll === true ? { revealAll: true } : {}),
        ...(options.freshFrom !== undefined ? { freshFrom: options.freshFrom } : {}),
      }),
    );
  }
  return rendered;
}

/** Slot ids filled since a given matchup — what the story update animates. */
export function freshSlotIds(match: MatchState, sinceMatchupIndex: number): string[] {
  return Object.values(match.fills)
    .filter((f) => f.matchupIndex >= sinceMatchupIndex)
    .map((f) => f.slotId);
}

/* ------------------------------------------------------------------ *
 * Starting a match
 * ------------------------------------------------------------------ */

export interface MatchPlan {
  storyIds: string[];
  plan: { storyId: string; slotId: string }[];
}

/**
 * Choose the stories and the slot order for a new match.
 *
 * Rooms remember their recent stories, so a group that hits PLAY AGAIN gets
 * something they have not just heard. A match longer than one story continues into
 * the next one rather than repeating slots.
 */
export function planMatch(
  state: RoomState,
  randomInt: (maxExclusive: number) => number,
): MatchPlan | null {
  const stories = pickStorySequence(state.settings.mode, state.recentStoryIds, state.settings.rounds, randomInt);
  if (stories.length === 0) return null;
  return { storyIds: stories.map((s) => s.id), plan: planSlots(stories, state.settings.rounds) };
}

export function rememberStories(state: RoomState, storyIds: readonly string[]): void {
  state.recentStoryIds = [...storyIds, ...state.recentStoryIds].slice(0, RECENT_STORY_MEMORY);
}

/* ------------------------------------------------------------------ *
 * Drawing prompts
 * ------------------------------------------------------------------ */

/**
 * Every drawable subject this match produced, visual ones first.
 *
 * Falls through to non-visual slots when a short match did not yield enough — an
 * unillustratable prompt is funnier than a finale that cannot start.
 */
export function availableDrawingPrompts(match: MatchState): DerivedDrawingPrompt[] {
  const prompts: DerivedDrawingPrompt[] = [];
  for (const story of matchStories(match)) {
    const played = match.plan
      .filter((a) => a.storyId === story.id && match.fills[fillKey(a.storyId, a.slotId)] !== undefined)
      .map((a) => a.slotId);
    prompts.push(...deriveDrawingPrompts(story, fillsForStory(match, story.id), played));
  }
  return prompts.sort((a, b) => Number(b.visual) - Number(a.visual));
}
