/**
 * BLURT — drawing prompt derivation across the real content.
 *
 * Prompts are now derived from the *whole* finished story rather than only the slots a
 * round was spent on, which means a slot nobody played can become somebody's drawing.
 * Those slots carry authored fallback text instead of a player's words, so this suite
 * exercises that seam against all seven MVP stories rather than a fixture.
 *
 * The load-bearing assertion is the last one: no prompt may ever reach a player
 * carrying an unfilled `{slot}` token. That is what a half-rendered story looks like,
 * and on the drawing screen it would be shown in large type as the thing to draw.
 */

import { describe, expect, it } from 'vitest';
import { content } from '../content/index.js';
import { PLACEHOLDER_PATTERN, VISUAL_SEMANTIC_TYPES, type Story } from '../content/schema.js';
import { deriveDrawingPrompts, type SlotFill } from '../shared/storyEngine.js';
import { MAX_PLAYERS } from '../shared/constants.js';

const { bundle } = content();
const stories: Story[] = [...bundle.classic, ...bundle.crude];

/** Every slot won by a player, as a full-length match would leave things. */
function playerFills(story: Story): Map<string, SlotFill> {
  return new Map(
    story.slots.map((slot, index) => [
      slot.id,
      {
        text: `answer ${index}`,
        authorId: `p${index}`,
        authorName: 'Somebody',
        authorAvatarId: null,
        roundIndex: index,
      },
    ]),
  );
}

describe.each(stories.map((s) => [s.id, s] as const))('%s', (_id, story) => {
  it('yields one prompt per slot whether or not the slot was played', () => {
    expect(deriveDrawingPrompts(story, new Map())).toHaveLength(story.slots.length);
    expect(deriveDrawingPrompts(story, playerFills(story))).toHaveLength(story.slots.length);
  });

  it('supplies enough prompts for a full room without falling back to generics', () => {
    expect(deriveDrawingPrompts(story, new Map()).length).toBeGreaterThanOrEqual(MAX_PLAYERS);
  });

  it('reads naturally with authored fallback text: the clause contains the subject', () => {
    for (const prompt of deriveDrawingPrompts(story, new Map())) {
      expect(prompt.subject.trim()).not.toBe('');
      expect(prompt.context).toContain(prompt.subject);
      expect(prompt.playerWritten).toBe(false);
      expect(prompt.authorId).toBeNull();
    }
  });

  it('marks a player-won slot as player-written and keeps its author', () => {
    for (const prompt of deriveDrawingPrompts(story, playerFills(story))) {
      expect(prompt.playerWritten).toBe(true);
      expect(prompt.authorId).not.toBeNull();
    }
  });

  it('sorts visual subjects ahead of the rest', () => {
    const prompts = deriveDrawingPrompts(story, new Map());
    const firstNonVisual = prompts.findIndex((p) => !p.visual);
    if (firstNonVisual !== -1) {
      expect(prompts.slice(firstNonVisual).some((p) => p.visual)).toBe(false);
    }
    // Every story must offer at least one genuinely drawable subject.
    expect(prompts.some((p) => p.visual)).toBe(true);
    for (const prompt of prompts) {
      const slot = story.slots.find((s) => s.id === prompt.slotId);
      expect(prompt.visual).toBe(VISUAL_SEMANTIC_TYPES.has(slot?.semanticType ?? 'phrase'));
    }
  });

  it('never leaves an unfilled {token} in a subject or a clause', () => {
    // Both extremes, because they take different paths through the fill lookup.
    for (const fills of [new Map<string, SlotFill>(), playerFills(story)]) {
      for (const prompt of deriveDrawingPrompts(story, fills)) {
        expect(prompt.subject, `${story.id}/${prompt.slotId} subject`).not.toMatch(
          PLACEHOLDER_PATTERN,
        );
        expect(prompt.context, `${story.id}/${prompt.slotId} context`).not.toMatch(
          PLACEHOLDER_PATTERN,
        );
      }
    }
  });
});

/**
 * None of the seven MVP stories puts two placeholders in one sentence, so the real
 * content never exercises the scrub that strips a *neighbouring* token out of a
 * clause. Without this case the "no unfilled token" assertion above passes whatever
 * `clauseAround` does — verified by breaking the scrub and watching it stay green.
 *
 * This is the guard for the day somebody writes a line with two slots in it.
 */
describe('a clause containing a second placeholder', () => {
  const twoInALine: Story = {
    ...(stories[0] as Story),
    id: 'fixture_two_slots',
    slots: [
      { ...(stories[0] as Story).slots[0]!, id: 'alpha' },
      { ...(stories[0] as Story).slots[1]!, id: 'beta' },
    ],
    sections: [
      {
        ...(stories[0] as Story).sections[0]!,
        lines: [{ id: 'l1', text: 'They brought {alpha} and left {beta} behind.' }],
      },
    ],
  };

  it('scrubs the neighbouring token out of both clauses', () => {
    const prompts = deriveDrawingPrompts(twoInALine, new Map());
    expect(prompts).toHaveLength(2);
    for (const prompt of prompts) {
      expect(prompt.context).not.toMatch(PLACEHOLDER_PATTERN);
      expect(prompt.context).toContain(prompt.subject);
      // The other slot becomes an ellipsis rather than a raw {token}.
      expect(prompt.context).toContain('…');
    }
  });
});
