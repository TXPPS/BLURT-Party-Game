import { describe, expect, it } from 'vitest';
import {
  deriveDrawingPrompts,
  houseFallbackFor,
  HOUSE_NAME,
  lineToText,
  planSlots,
  renderStory,
  storiesNeeded,
  storyToText,
  type SlotFill,
} from '../shared/storyEngine.js';
import { content, storiesForMode } from '../content/index.js';
import { PLACEHOLDER_PATTERN, VISUAL_SEMANTIC_TYPES, type Story } from '../content/schema.js';

const { bundle } = content();
const allStories = [...bundle.classic, ...bundle.crude];
const story = bundle.classic[0] as Story;

function fillAll(target: Story, from = 0): Map<string, SlotFill> {
  const fills = new Map<string, SlotFill>();
  target.slots.forEach((slot, index) => {
    fills.set(slot.id, {
      text: `ANSWER_${slot.id}`,
      authorId: `p${index % 3}`,
      authorName: `Player ${index % 3}`,
      authorAvatarId: 'raccoon',
      roundIndex: from + index,
    });
  });
  return fills;
}

describe('renderStory', () => {
  it('never leaves a visible placeholder, even with zero fills', () => {
    for (const target of allStories) {
      const text = storyToText(renderStory(target, new Map(), { revealAll: true }));
      expect(text, target.id).not.toMatch(PLACEHOLDER_PATTERN);
      expect(text, target.id).not.toContain('undefined');
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  it('fills unplayed slots from the house pool, attributed to THE HOUSE', () => {
    const rendered = renderStory(story, new Map(), { revealAll: true });
    const fills = rendered.sections
      .flatMap((s) => s.lines)
      .flatMap((l) => l.segments)
      .filter((seg) => seg.kind === 'fill');

    expect(fills.length).toBe(story.slots.length);
    for (const fill of fills) {
      expect(fill.kind).toBe('fill');
      if (fill.kind !== 'fill') continue;
      expect(fill.authorId).toBeNull();
      expect(fill.authorName).toBe(HOUSE_NAME);
      expect(fill.text.length).toBeGreaterThan(0);
    }
  });

  it('is deterministic — the same gap always gets the same house joke', () => {
    const a = storyToText(renderStory(story, new Map(), { revealAll: true }));
    const b = storyToText(renderStory(story, new Map(), { revealAll: true }));
    expect(a).toBe(b);
    for (const slot of story.slots) {
      expect(houseFallbackFor(story, slot)).toBe(houseFallbackFor(story, slot));
      expect(slot.fallback).toContain(houseFallbackFor(story, slot));
    }
  });

  it('inserts player answers with attribution', () => {
    const rendered = renderStory(story, fillAll(story), { revealAll: true });
    const text = storyToText(rendered);
    for (const slot of story.slots) expect(text).toContain(`ANSWER_${slot.id}`);

    const first = rendered.sections
      .flatMap((s) => s.lines)
      .flatMap((l) => l.segments)
      .find((seg) => seg.kind === 'fill');
    expect(first).toBeDefined();
    if (first?.kind === 'fill') {
      expect(first.authorId).not.toBeNull();
      expect(first.authorAvatarId).toBe('raccoon');
    }
  });

  it('marks only fills at or after freshFrom as fresh', () => {
    const rendered = renderStory(story, fillAll(story), { revealAll: true, freshFrom: 5 });
    const fresh = rendered.sections
      .flatMap((s) => s.lines)
      .flatMap((l) => l.segments)
      .filter((seg) => seg.kind === 'fill' && seg.fresh);
    expect(fresh.length).toBe(story.slots.length - 5);
  });

  it('splits text and fills into separate segments so only the answer animates', () => {
    const rendered = renderStory(story, fillAll(story), { revealAll: true });
    const line = rendered.sections
      .flatMap((s) => s.lines)
      .find((l) => l.segments.some((seg) => seg.kind === 'fill'));
    expect(line).toBeDefined();
    if (line !== undefined) {
      expect(line.segments.length).toBeGreaterThan(1);
      expect(lineToText(line)).toContain('ANSWER_');
    }
  });
});

describe('progressive unlock', () => {
  it('reveals nothing beyond the point play has reached', () => {
    const planned = new Set(story.slots.map((s) => s.id));
    const partial = new Map<string, SlotFill>();
    const firstSlot = story.slots[0] as { id: string };
    partial.set(firstSlot.id, {
      text: 'FIRST',
      authorId: 'p1',
      authorName: 'Gary',
      authorAvatarId: 'possum',
      roundIndex: 0,
    });

    const rendered = renderStory(story, partial, { plannedSlotIds: planned });
    const unlocked = rendered.sections.filter((s) => s.unlocked);
    expect(unlocked.length).toBeGreaterThan(0);
    expect(unlocked.length).toBeLessThan(rendered.sections.length);
  });

  it('does not let a skipped slot hold its section hostage in a short match', () => {
    // Three rounds through a ten-slot story: only the three highest-priority slots
    // are planned, and the rest are house-filled. The story must still open up.
    const plan = planSlots([story], 3);
    const planned = new Set(plan.map((a) => a.slotId));
    const fills = new Map<string, SlotFill>();
    plan.forEach((assignment, index) => {
      fills.set(assignment.slotId, {
        text: `A${index}`,
        authorId: 'p1',
        authorName: 'Gary',
        authorAvatarId: 'possum',
        roundIndex: index,
      });
    });

    const rendered = renderStory(story, fills, { plannedSlotIds: planned });
    const unlocked = rendered.sections.filter((s) => s.unlocked);
    expect(unlocked.length).toBe(rendered.sections.length);
    expect(storyToText(rendered)).not.toMatch(PLACEHOLDER_PATTERN);
  });

  it('unlocks everything once every planned slot is in', () => {
    const rendered = renderStory(story, fillAll(story), {
      plannedSlotIds: new Set(story.slots.map((s) => s.id)),
    });
    expect(rendered.sections.every((s) => s.unlocked)).toBe(true);
  });
});

describe('planSlots', () => {
  it('takes the highest-priority slots for a short match, in narrative order', () => {
    const plan = planSlots([story], 3);
    expect(plan).toHaveLength(3);

    const chosen = plan.map((a) => a.slotId);
    const priorities = chosen.map((id) => story.slots.find((s) => s.id === id)?.priority ?? 99);
    const allPriorities = story.slots.map((s) => s.priority).sort((a, b) => a - b);
    expect(priorities.slice().sort((a, b) => a - b)).toEqual(allPriorities.slice(0, 3));

    const documentOrder = story.slots.map((s) => s.id);
    const indices = chosen.map((id) => documentOrder.indexOf(id));
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  });

  it('continues into a second story when the match outruns the first', () => {
    const stories = storiesForMode('classic');
    const plan = planSlots(stories, 15);
    expect(plan).toHaveLength(15);
    expect(new Set(plan.map((a) => a.storyId)).size).toBeGreaterThan(1);
    expect(new Set(plan.map((a) => `${a.storyId}:${a.slotId}`)).size).toBe(15);
  });

  it('handles a one-round match through a twelve-slot story', () => {
    const plan = planSlots([story], 1);
    expect(plan).toHaveLength(1);
    const slot = story.slots.find((s) => s.id === plan[0]?.slotId);
    expect(slot?.priority).toBe(1);
  });

  it('never returns more assignments than rounds', () => {
    for (let rounds = 1; rounds <= 15; rounds += 1) {
      const plan = planSlots(storiesForMode('classic'), rounds);
      expect(plan.length).toBeLessThanOrEqual(rounds);
    }
  });

  it('reports how many stories a match needs', () => {
    expect(storiesNeeded([story], 5)).toBe(1);
    expect(storiesNeeded(storiesForMode('classic'), 15)).toBeGreaterThan(1);
  });
});

describe('deriveDrawingPrompts', () => {
  it('offers every slot in the story, not just the ones a round was spent on', () => {
    // A three-round match plays three slots; the finished story still has ten, and
    // the room reads all ten. All ten are drawable.
    const played = story.slots.slice(0, 3).map((s) => s.id);
    const partial = new Map([...fillAll(story)].filter(([id]) => played.includes(id)));
    const prompts = deriveDrawingPrompts(story, partial);

    expect(prompts).toHaveLength(story.slots.length);
    expect(new Set(prompts.map((p) => p.slotId)).size).toBe(story.slots.length);
  });

  it('fills an unplayed slot from its own pool rather than skipping it', () => {
    const prompts = deriveDrawingPrompts(story, new Map());
    expect(prompts).toHaveLength(story.slots.length);
    for (const prompt of prompts) {
      expect(prompt.subject.length).toBeGreaterThan(0);
      expect(prompt.playerWritten).toBe(false);
      expect(prompt.authorId).toBeNull();
    }
  });

  it('puts visual subjects first but still offers the rest', () => {
    const prompts = deriveDrawingPrompts(story, fillAll(story));
    const firstNonVisual = prompts.findIndex((p) => !p.visual);
    if (firstNonVisual !== -1) {
      expect(prompts.slice(firstNonVisual).every((p) => !p.visual)).toBe(true);
    }
    expect(prompts.filter((p) => p.visual).length).toBeGreaterThan(0);
  });

  it("prefers a player's own words over authored filler, within a visual tier", () => {
    // Only the last visual slot was actually won by somebody.
    const visual = story.slots.filter((s) => VISUAL_SEMANTIC_TYPES.has(s.semanticType));
    const target = visual.at(-1);
    if (target === undefined) return;
    const fills = new Map([
      [target.id, {
        text: 'a player wrote this',
        authorId: 'p1',
        authorName: 'Somebody',
        authorAvatarId: null,
        roundIndex: 0,
      }],
    ]);

    const prompts = deriveDrawingPrompts(story, fills);
    const firstVisual = prompts.find((p) => p.visual);
    expect(firstVisual?.slotId).toBe(target.id);
    expect(firstVisual?.playerWritten).toBe(true);
  });

  it('gives each prompt the clause it landed in, with no placeholders left', () => {
    for (const prompt of deriveDrawingPrompts(story, fillAll(story))) {
      expect(prompt.context).toContain(prompt.subject);
      expect(prompt.context).not.toMatch(PLACEHOLDER_PATTERN);
      expect(prompt.context.length).toBeGreaterThan(prompt.subject.length - 1);
    }
  });

  it('lists a slot once even when the story mentions it twice', () => {
    const prompts = deriveDrawingPrompts(story, fillAll(story));
    expect(new Set(prompts.map((p) => p.slotId)).size).toBe(prompts.length);
  });
});

