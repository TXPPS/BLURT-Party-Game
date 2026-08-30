/**
 * BLURT — story assembly.
 *
 * The hidden-context hook lives here. Players answer a disguised prompt; this module
 * is what quietly drops their answer into a sentence they have never seen. It is a
 * pure function of (template, fills) so the client, the server and the tests all
 * render byte-identical stories.
 *
 * Two hard rules, both enforced by `tests/storyEngine.test.ts`:
 *   1. A rendered story NEVER contains a visible blank or a `{placeholder}`.
 *   2. A slot that nobody filled is filled by the house, deterministically, from the
 *      slot's own fallback pool — so a five-round match through a twelve-slot story
 *      still reads as a finished story.
 */

import type { RenderedLine, RenderedSection, RenderedSegment, RenderedStory } from './types.js';
import type { Story, Slot } from '../content/schema.js';
import { PLACEHOLDER_PATTERN, VISUAL_SEMANTIC_TYPES } from '../content/schema.js';
import { seedFromString } from './rng.js';

/** What actually went into a slot. */
export interface SlotFill {
  text: string;
  /** Null when the house filled it (timeout, unplayed slot, or a house matchup win). */
  authorId: string | null;
  authorName: string;
  authorAvatarId: string | null;
  /** The matchup this fill was won in; used to mark "new since the last update". */
  roundIndex: number;
}

export type SlotFills = ReadonlyMap<string, SlotFill>;

/** The label shown wherever the house speaks for a player. */
export const HOUSE_NAME = 'THE HOUSE';

export interface RenderOptions {
  /** Fills from this matchup index onward are marked `fresh` for emphasis. */
  freshFrom?: number;
  /**
   * When true every section is revealed regardless of progress (the final read-out).
   * When false, sections unlock progressively as play reaches them.
   */
  revealAll?: boolean;
  /**
   * The slots this match actually plays (see `planSlots`). A short match through a
   * long story never plays every slot; the ones it skips are house-filled and must
   * NOT hold their section hostage. When omitted, every slot counts as planned.
   */
  plannedSlotIds?: ReadonlySet<string>;
}

/**
 * Deterministically choose a house answer for an unplayed slot. Seeded on the story
 * and slot id so the same story always tells the same joke in the same gap — which
 * matters when a room replays a story they half-remember.
 */
export function houseFallbackFor(story: Story, slot: Slot): string {
  const index = seedFromString(`${story.id}:${slot.id}`) % slot.fallback.length;
  return slot.fallback[index] ?? slot.fallback[0] ?? '…';
}

/**
 * Render one story into display-ready lines.
 *
 * Segments are split so the UI can animate exactly the inserted text — the
 * `fill` segments carry attribution and the `fresh` flag that drives the stamp-in.
 */
export function renderStory(story: Story, fills: SlotFills, options: RenderOptions = {}): RenderedStory {
  const freshFrom = options.freshFrom ?? Number.POSITIVE_INFINITY;
  const revealAll = options.revealAll ?? false;
  const planned = options.plannedSlotIds ?? null;

  // A section unlocks once every slot inside it that this match will actually play
  // has been played. Scanning in order and stopping at the first section that is not
  // yet complete is what makes the story grow forwards instead of jumping ahead.
  let stillUnlocking = true;

  const sections: RenderedSection[] = story.sections.map((section) => {
    const sectionSlotIds = collectSlotIds(section.lines.map((l) => l.text));
    const gatingSlotIds =
      planned === null ? sectionSlotIds : sectionSlotIds.filter((id) => planned.has(id));
    const allPlayed = gatingSlotIds.every((id) => fills.has(id));
    const unlocked = revealAll || (stillUnlocking && allPlayed);
    if (!allPlayed) stillUnlocking = false;

    const lines: RenderedLine[] = section.lines.map((line) => ({
      sectionId: section.id,
      lineId: line.id,
      segments: renderSegments(story, line.text, fills, freshFrom),
    }));

    return {
      id: section.id,
      lines,
      revealAnimation: section.revealAnimation,
      audioCue: section.audioCue ?? null,
      unlocked,
    };
  });

  return { storyId: story.id, title: story.title, genre: story.genre, sections };
}

function collectSlotIds(texts: readonly string[]): string[] {
  const ids: string[] = [];
  for (const text of texts) {
    for (const match of text.matchAll(PLACEHOLDER_PATTERN)) ids.push(match[1] as string);
  }
  return ids;
}

function renderSegments(
  story: Story,
  text: string,
  fills: SlotFills,
  freshFrom: number,
): RenderedSegment[] {
  const segments: RenderedSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    const slotId = match[1] as string;
    const start = match.index ?? 0;
    if (start > cursor) segments.push({ kind: 'text', text: text.slice(cursor, start) });
    cursor = start + match[0].length;

    const slot = story.slots.find((s) => s.id === slotId);
    const fill = fills.get(slotId);

    if (fill !== undefined) {
      segments.push({
        kind: 'fill',
        text: fill.text,
        slotId,
        authorId: fill.authorId,
        authorName: fill.authorName,
        authorAvatarId: fill.authorAvatarId,
        fresh: fill.roundIndex >= freshFrom,
      });
    } else {
      // Never leave a hole. The house speaks.
      segments.push({
        kind: 'fill',
        text: slot === undefined ? '…' : houseFallbackFor(story, slot),
        slotId,
        authorId: null,
        authorName: HOUSE_NAME,
        authorAvatarId: null,
        fresh: false,
      });
    }
  }

  if (cursor < text.length) segments.push({ kind: 'text', text: text.slice(cursor) });
  return segments;
}

/** Flatten a rendered line back to plain text — for logs, tests and the highlight reel. */
export function lineToText(line: RenderedLine): string {
  return line.segments.map((s) => s.text).join('');
}

export function storyToText(story: RenderedStory): string {
  return story.sections
    .flatMap((section) => section.lines.map(lineToText))
    .join('\n');
}

/* ------------------------------------------------------------------ *
 * Planning which slots a match will actually use
 * ------------------------------------------------------------------ */

export interface SlotAssignment {
  storyId: string;
  slotId: string;
}

/**
 * Decide which slots this match will play, in order.
 *
 * • Fewer rounds than slots → take the lowest `priority` numbers, then document
 *   order. Writers put the load-bearing beats at priority 1 so the short version
 *   still tells a story; everything skipped is filled by the house at the reveal.
 * • More rounds than slots → continue into the next story in `stories`. The final
 *   read-out then plays both, back to back, as a double feature.
 *
 * Never returns fewer assignments than `rounds` unless the supplied stories are
 * genuinely exhausted, in which case it returns as many as exist.
 */
export function planSlots(stories: readonly Story[], rounds: number): SlotAssignment[] {
  const plan: SlotAssignment[] = [];
  for (const story of stories) {
    if (plan.length >= rounds) break;
    const remaining = rounds - plan.length;
    const ordered = [...story.slots]
      .map((slot, index) => ({ slot, index }))
      .sort((a, b) => (a.slot.priority - b.slot.priority) || (a.index - b.index))
      .slice(0, remaining)
      // Play them in narrative order once chosen, so the story assembles forwards.
      .sort((a, b) => a.index - b.index);

    for (const { slot } of ordered) plan.push({ storyId: story.id, slotId: slot.id });
  }
  return plan;
}

/** How many stories a match of `rounds` rounds needs, given a pool of stories. */
export function storiesNeeded(stories: readonly Story[], rounds: number): number {
  let covered = 0;
  let used = 0;
  for (const story of stories) {
    if (covered >= rounds) break;
    covered += story.slots.length;
    used += 1;
  }
  return Math.max(1, used);
}

/* ------------------------------------------------------------------ *
 * Drawing prompt derivation
 * ------------------------------------------------------------------ */

export interface DerivedDrawingPrompt {
  storyId: string;
  slotId: string;
  /** The player's own words — what they will actually be asked to draw. */
  subject: string;
  /** The clause it landed in, shown underneath as context. */
  context: string;
  visual: boolean;
}

/**
 * Pull drawable subjects out of a completed story: the filled answer plus the
 * sentence it landed in. Visual semantic types come first; if a short match did not
 * produce enough of them, anything filled is fair game — an unillustratable prompt
 * is funnier than a finale that cannot start.
 */
export function deriveDrawingPrompts(
  story: Story,
  fills: SlotFills,
  playedSlotIds: readonly string[],
): DerivedDrawingPrompt[] {
  const played = new Set(playedSlotIds);
  const prompts: DerivedDrawingPrompt[] = [];

  for (const section of story.sections) {
    for (const line of section.lines) {
      for (const match of line.text.matchAll(PLACEHOLDER_PATTERN)) {
        const slotId = match[1] as string;
        if (!played.has(slotId)) continue;
        const fill = fills.get(slotId);
        const slot = story.slots.find((s) => s.id === slotId);
        if (fill === undefined || slot === undefined) continue;

        prompts.push({
          storyId: story.id,
          slotId,
          subject: fill.text,
          context: clauseAround(line.text, match.index ?? 0, match[0].length, fill.text),
          visual: VISUAL_SEMANTIC_TYPES.has(slot.semanticType),
        });
      }
    }
  }

  // Visual first, otherwise stable narrative order.
  return prompts.sort((a, b) => Number(b.visual) - Number(a.visual));
}

/** The sentence fragment surrounding an insertion, trimmed to something readable. */
function clauseAround(text: string, index: number, length: number, fillText: string): string {
  const before = text.slice(0, index);
  const after = text.slice(index + length);
  const startBoundary = Math.max(
    before.lastIndexOf('. '),
    before.lastIndexOf('! '),
    before.lastIndexOf('? '),
  );
  const endMatch = /[.!?]/.exec(after);
  const head = before.slice(startBoundary + 1).trimStart();
  const tail = after.slice(0, endMatch === null ? after.length : endMatch.index + 1);
  const clause = `${head}${fillText}${tail}`.replace(PLACEHOLDER_PATTERN, '…').trim();
  return clause.length > 0 ? clause : fillText;
}
