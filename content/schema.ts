/**
 * BLURT — content schema.
 *
 * Engine and content are strictly separate: no prompt string ever appears inside a
 * component or inside server logic. Everything a writer touches is validated here,
 * both at build time (`scripts/contentLint.ts`) and at server start-up, so a typo in
 * a story is a loud failure on the way in rather than a blank line in front of a
 * room full of people.
 *
 * ── Authoring model ───────────────────────────────────────────────────────────
 * A story declares its slots once, then writes prose with `{slotId}` placeholders.
 * That is isomorphic to the "static line vs slot line" split — a line with no
 * placeholder *is* a static line — but it is far nicer to write and impossible to
 * desynchronise, because validation proves every placeholder resolves and every
 * declared slot is used exactly once.
 */

import { z } from 'zod';
import { ANSWER_MAX_LENGTH } from '../shared/constants.js';
import { isClean } from '../shared/blocklist.js';

/* ------------------------------------------------------------------ *
 * Slots
 * ------------------------------------------------------------------ */

export const SEMANTIC_TYPES = [
  'person',
  'creature',
  'object',
  'place',
  'action',
  'event',
  'body_part',
  'emotion',
  'phrase',
  'threat',
  'possession',
  'sound',
] as const;

export type SemanticType = (typeof SEMANTIC_TYPES)[number];

/**
 * Semantic types that describe something you could plausibly draw. The drawing
 * finale prefers these when deriving prompts, and falls back to anything filled if
 * a short match did not produce enough of them.
 */
export const VISUAL_SEMANTIC_TYPES: ReadonlySet<SemanticType> = new Set<SemanticType>([
  'person',
  'creature',
  'object',
  'place',
  'possession',
]);

/** Per-slot char limits stay inside this window — long enough for a joke, short enough to read aloud. */
export const SLOT_CHAR_LIMIT_MIN = 120;
export const SLOT_CHAR_LIMIT_MAX = ANSWER_MAX_LENGTH; // 160

export const MIN_FALLBACKS_PER_SLOT = 3;

const slotIdSchema = z
  .string()
  .regex(/^[a-z0-9_]+$/, 'slot ids are lowercase snake_case')
  .min(2)
  .max(40);

export const slotSchema = z.object({
  id: slotIdSchema,
  semanticType: z.enum(SEMANTIC_TYPES),
  /**
   * What the player actually reads. Must stand alone as a sensible question and must
   * NOT leak the surrounding story — that mismatch is the entire joke.
   */
  disguisedPrompt: z.string().min(8).max(160),
  charLimit: z.number().int().min(SLOT_CHAR_LIMIT_MIN).max(SLOT_CHAR_LIMIT_MAX),
  /** House answers, used when nobody submits. At least three so repeats are rare. */
  fallback: z.array(z.string().min(1).max(SLOT_CHAR_LIMIT_MAX)).min(MIN_FALLBACKS_PER_SLOT),
  hint: z.string().min(3).max(80).optional(),
  /** 1 = fill this first. Short matches keep the low numbers so the story stays coherent. */
  priority: z.number().int().min(1).max(99),
  /**
   * Marks the slots whose answers tend to be the unhinged ones. Purely for the
   * HUMAN RED FLAG award — it is data, not a content restriction.
   */
  tone: z.enum(['mild', 'dark']).default('mild'),
});

export type Slot = z.infer<typeof slotSchema>;

/* ------------------------------------------------------------------ *
 * Lines and sections
 * ------------------------------------------------------------------ */

export const REVEAL_ANIMATIONS = ['typewriter', 'stamp', 'slam'] as const;

export const lineSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/).min(2).max(40),
  /** Prose. `{slot_id}` placeholders are substituted at render time. */
  text: z.string().min(1).max(400),
});

export type Line = z.infer<typeof lineSchema>;

export const sectionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/).min(2).max(40),
  lines: z.array(lineSchema).min(1),
  revealAnimation: z.enum(REVEAL_ANIMATIONS).default('typewriter'),
  /** An `SfxEventId`; validated against the audio registry by the content linter. */
  audioCue: z.string().min(2).max(40).optional(),
});

export type Section = z.infer<typeof sectionSchema>;

/* ------------------------------------------------------------------ *
 * Stories
 * ------------------------------------------------------------------ */

export const MIN_SLOTS_PER_STORY = 8;

/** Matches `{slot_id}` and captures the id. */
export const PLACEHOLDER_PATTERN = /\{([a-z0-9_]+)\}/g;

export function placeholdersIn(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_PATTERN)].map((m) => m[1] as string);
}

/** True when a line is pure prose with nothing inserted into it. */
export function isStaticLine(line: Line): boolean {
  return placeholdersIn(line.text).length === 0;
}

export const storySchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/).min(3).max(50),
    title: z.string().min(3).max(60),
    genre: z.string().min(3).max(40),
    mode: z.enum(['classic', 'crude']),
    slots: z.array(slotSchema).min(MIN_SLOTS_PER_STORY),
    sections: z.array(sectionSchema).min(1),
  })
  .superRefine((story, ctx) => {
    const declared = new Set(story.slots.map((s) => s.id));

    if (declared.size !== story.slots.length) {
      ctx.addIssue({ code: 'custom', message: `story "${story.id}" declares a duplicate slot id` });
    }

    const used = new Map<string, number>();
    for (const section of story.sections) {
      for (const line of section.lines) {
        for (const id of placeholdersIn(line.text)) {
          used.set(id, (used.get(id) ?? 0) + 1);
          if (!declared.has(id)) {
            ctx.addIssue({
              code: 'custom',
              message: `story "${story.id}" line "${line.id}" references undeclared slot "${id}"`,
            });
          }
        }
      }
    }

    for (const slot of story.slots) {
      const count = used.get(slot.id) ?? 0;
      if (count === 0) {
        ctx.addIssue({
          code: 'custom',
          message: `story "${story.id}" declares slot "${slot.id}" but never uses it`,
        });
      } else if (count > 1) {
        ctx.addIssue({
          code: 'custom',
          message: `story "${story.id}" uses slot "${slot.id}" ${count} times; each slot is filled once`,
        });
      }
    }

    // Section ids and line ids must be unique so the renderer can key on them.
    const sectionIds = new Set<string>();
    for (const section of story.sections) {
      if (sectionIds.has(section.id)) {
        ctx.addIssue({ code: 'custom', message: `story "${story.id}" repeats section id "${section.id}"` });
      }
      sectionIds.add(section.id);
      const lineIds = new Set<string>();
      for (const line of section.lines) {
        const key = `${section.id}.${line.id}`;
        if (lineIds.has(key)) {
          ctx.addIssue({ code: 'custom', message: `story "${story.id}" repeats line id "${key}"` });
        }
        lineIds.add(key);
      }
    }

    // Priorities must be dense enough that a short match picks a coherent subset.
    const priorities = story.slots.map((s) => s.priority).sort((a, b) => a - b);
    if (priorities[0] !== 1) {
      ctx.addIssue({ code: 'custom', message: `story "${story.id}" has no priority-1 slot` });
    }

    // Generated prose must never carry a slur, even accidentally.
    const prose = [
      story.title,
      story.genre,
      ...story.sections.flatMap((s) => s.lines.map((l) => l.text)),
      ...story.slots.flatMap((s) => [s.disguisedPrompt, s.hint ?? '', ...s.fallback]),
    ].join(' \n ');
    if (!isClean(prose)) {
      ctx.addIssue({ code: 'custom', message: `story "${story.id}" trips the blocklist` });
    }
  });

export type Story = z.infer<typeof storySchema>;

/**
 * What a story *file* looks like before parsing — `tone` has a default, so authors
 * may omit it. Story modules are typed as `StoryInput`; `content/index.ts` parses
 * them into `Story`, which is what the engine consumes.
 */
export type StoryInput = z.input<typeof storySchema>;

/** Convenience accessor the brief calls `minSlots`; derived so it can never drift. */
export function minSlots(story: Story): number {
  return story.slots.length;
}

export function slotById(story: Story, slotId: string): Slot | undefined {
  return story.slots.find((s) => s.id === slotId);
}

/** Which section a slot lives in — used to pace story updates section by section. */
export function sectionForSlot(story: Story, slotId: string): Section | undefined {
  return story.sections.find((section) =>
    section.lines.some((line) => placeholdersIn(line.text).includes(slotId)),
  );
}

export const storyCollectionSchema = z.array(storySchema).min(1);

/* ------------------------------------------------------------------ *
 * Name pools
 * ------------------------------------------------------------------ */

export const namePoolsSchema = z.object({
  modifier: z.array(z.string().min(2).max(14)).min(1),
  title: z.array(z.string().min(2).max(14)).min(1),
  given: z.array(z.string().min(2).max(14)).min(1),
  noun: z.array(z.string().min(2).max(14)).min(1),
  animal: z.array(z.string().min(2).max(14)).min(1),
  food: z.array(z.string().min(2).max(14)).min(1),
  object: z.array(z.string().min(2).max(14)).min(1),
  occupation: z.array(z.string().min(2).max(14)).min(1),
  adjective: z.array(z.string().min(2).max(14)).min(1),
});

export type NamePoolsData = z.infer<typeof namePoolsSchema>;
