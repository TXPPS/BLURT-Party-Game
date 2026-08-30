/**
 * Content validation. Lives beside the content it validates so a writer who adds a
 * story runs into it immediately.
 */
import { describe, expect, it } from 'vitest';
import {
  MIN_CLASSIC_STORIES,
  MIN_CRUDE_STORIES,
  loadContent,
  pickStory,
  pickStorySequence,
  storiesForMode,
} from './index.js';
import {
  MIN_FALLBACKS_PER_SLOT,
  MIN_SLOTS_PER_STORY,
  PLACEHOLDER_PATTERN,
  SLOT_CHAR_LIMIT_MAX,
  SLOT_CHAR_LIMIT_MIN,
  placeholdersIn,
  storySchema,
} from './schema.js';
import { isClean } from '../shared/blocklist.js';
import { isSfxEventId } from '../shared/sfx.js';

const loaded = loadContent();
const allStories = [...loaded.bundle.classic, ...loaded.bundle.crude];

describe('the shipped content library', () => {
  it('parses with zero issues', () => {
    expect(loaded.issues).toEqual([]);
    expect(loaded.ok).toBe(true);
  });

  it('meets the MVP pack sizes', () => {
    expect(loaded.bundle.classic.length).toBeGreaterThanOrEqual(MIN_CLASSIC_STORIES);
    expect(loaded.bundle.crude.length).toBeGreaterThanOrEqual(MIN_CRUDE_STORIES);
  });

  it('gives every story at least eight slots', () => {
    for (const story of allStories) {
      expect(story.slots.length, story.id).toBeGreaterThanOrEqual(MIN_SLOTS_PER_STORY);
    }
  });

  it('uses every declared slot exactly once', () => {
    for (const story of allStories) {
      const used = story.sections.flatMap((s) => s.lines.flatMap((l) => placeholdersIn(l.text)));
      expect(used.slice().sort(), story.id).toEqual(story.slots.map((s) => s.id).sort());
      expect(new Set(used).size, story.id).toBe(used.length);
    }
  });

  it('gives every slot enough house answers, inside the char limit', () => {
    for (const story of allStories) {
      for (const slot of story.slots) {
        expect(slot.fallback.length, `${story.id}/${slot.id}`).toBeGreaterThanOrEqual(
          MIN_FALLBACKS_PER_SLOT,
        );
        expect(slot.charLimit).toBeGreaterThanOrEqual(SLOT_CHAR_LIMIT_MIN);
        expect(slot.charLimit).toBeLessThanOrEqual(SLOT_CHAR_LIMIT_MAX);
        for (const fallback of slot.fallback) {
          expect([...fallback].length, `${story.id}/${slot.id}: "${fallback}"`).toBeLessThanOrEqual(
            slot.charLimit,
          );
        }
      }
    }
  });

  it('has a priority-1 slot and dense, unique priorities', () => {
    for (const story of allStories) {
      const priorities = story.slots.map((s) => s.priority).sort((a, b) => a - b);
      expect(priorities[0], story.id).toBe(1);
      expect(new Set(priorities).size, story.id).toBe(priorities.length);
    }
  });

  it('names only real audio cues', () => {
    for (const story of allStories) {
      for (const section of story.sections) {
        if (section.audioCue !== undefined) {
          expect(isSfxEventId(section.audioCue), `${story.id}/${section.id}`).toBe(true);
        }
      }
    }
  });

  it('trips no blocklist entry anywhere, in either mode', () => {
    for (const story of allStories) {
      const prose = [
        story.title,
        story.genre,
        ...story.sections.flatMap((s) => s.lines.map((l) => l.text)),
        ...story.slots.flatMap((s) => [s.disguisedPrompt, s.hint ?? '', ...s.fallback]),
      ].join(' ');
      expect(isClean(prose), story.id).toBe(true);
    }
  });
});

describe('disguised prompts genuinely disguise', () => {
  it('reads as a standalone question, not a fill-in-the-blank', () => {
    for (const story of allStories) {
      for (const slot of story.slots) {
        // A trailing ellipsis is a legitimate sentence-completion device; a brace or
        // an underscore run means the writer leaked the template into the prompt.
        expect(slot.disguisedPrompt, `${story.id}/${slot.id}`).not.toMatch(/\{|\}|_{2,}/);
        expect(slot.disguisedPrompt.trim().length).toBeGreaterThan(15);
      }
    }
  });

  it('does not leak a distinctive word from the story it belongs to', () => {
    // A prompt that reuses a rare word from its own story hands the joke away.
    const stopWords = new Set([
      'about','after','again','something','somebody','would','could','never','write','name','describe','invent',
      'worst','least','their','there','which','while','where','other','first','thing','things','people','person',
      'that','this','with','from','have','been','they','them','your','yours','into','only','just','make','makes',
      'give','gives','what','when','been','does','doing','than','then','over','under','every','each','more','most',
      'less','some','here','very','much','many','also','like','through','before','being','because','should',
      // Generic adverbs and qualifiers. These carry no story context, so sharing one
      // is not a leak — the check is looking for distinctive *subject* words.
      'immediately','definitely','completely','absolutely','actually','probably','somewhere','anywhere',
      'anything','everything','nothing','without','against','between','another','yourself','himself',
      'herself','themselves','perhaps','instead','usually','already','always','anybody','everybody',
      'nobody','someone','anyone','everyone','different','following','including','possible','impossible',
      'certainly','clearly','exactly','finally','however','together','whether','various','several',
      'little','longer','recently','slightly','entirely','quietly','technically','genuinely','extremely',
      'reasonable','normal','single','around','behind','during','either','neither','anymore','across',
    ]);
    for (const story of allStories) {
      // Placeholders are stripped first: `{microwave_object}` is a slot *id*, not
      // prose a player will ever read, so it cannot leak anything.
      const prose = story.sections
        .flatMap((s) => s.lines.map((l) => l.text.replace(PLACEHOLDER_PATTERN, ' ')))
        .join(' ')
        .toLowerCase();
      for (const slot of story.slots) {
        const words = slot.disguisedPrompt
          .toLowerCase()
          .replace(/[^a-z\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 7 && !stopWords.has(w));
        const leaks = words.filter((w) => prose.includes(w));
        expect(leaks, `${story.id}/${slot.id} leaks: ${leaks.join(', ')}`).toEqual([]);
      }
    }
  });

  it('never reuses a word from its own story title', () => {
    // The title is the punchline. A prompt that shares a word with it hands the
    // hidden context to the player before the first round is even scored.
    const titleStopWords = new Set(['the', 'at', 'a', 'an', 'of', 'and', 'up', 'in', 'on']);
    for (const story of allStories) {
      const titleWords = story.title
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !titleStopWords.has(w));
      for (const slot of story.slots) {
        const prompt = slot.disguisedPrompt.toLowerCase();
        const leaks = titleWords.filter((w) => prompt.includes(w));
        expect(leaks, `${story.id}/${slot.id} echoes its title: ${leaks.join(', ')}`).toEqual([]);
      }
    }
  });
});

describe('story selection', () => {
  const nth = (n: number) => (max: number) => n % max;

  it('offers the crude pack plus the classic pack in crude mode', () => {
    expect(storiesForMode('classic').every((s) => s.mode === 'classic')).toBe(true);
    expect(storiesForMode('crude').length).toBeGreaterThan(storiesForMode('classic').length);
  });

  it('avoids recently played stories', () => {
    const pool = storiesForMode('classic');
    const recent = pool.slice(0, pool.length - 1).map((s) => s.id);
    const picked = pickStory('classic', recent, nth(0));
    expect(picked).not.toBeNull();
    expect(recent).not.toContain(picked?.id);
  });

  it('still returns something once every story has been played', () => {
    const recent = storiesForMode('classic').map((s) => s.id);
    expect(pickStory('classic', recent, nth(0))).not.toBeNull();
  });

  it('chains stories together for a long match', () => {
    const sequence = pickStorySequence('classic', [], 15, nth(0));
    const covered = sequence.reduce((sum, s) => sum + s.slots.length, 0);
    expect(covered).toBeGreaterThanOrEqual(15);
    expect(new Set(sequence.map((s) => s.id)).size).toBe(sequence.length);
  });

  it('needs only one story for a short match', () => {
    expect(pickStorySequence('classic', [], 3, nth(0))).toHaveLength(1);
  });
});

describe('schema rejects malformed content', () => {
  const base = loaded.bundle.classic[0];

  it('rejects a placeholder with no matching slot', () => {
    const broken = structuredClone(base);
    const section = broken?.sections[0];
    const line = section?.lines[0];
    if (line !== undefined) line.text = 'This references {not_a_real_slot}.';
    expect(storySchema.safeParse(broken).success).toBe(false);
  });

  it('rejects a slot that is declared but never used', () => {
    const broken = structuredClone(base);
    broken?.slots.push({
      id: 'orphan_slot',
      semanticType: 'object',
      disguisedPrompt: 'Name something that is never used.',
      charLimit: 120,
      priority: 50,
      fallback: ['a', 'b', 'c'],
      tone: 'mild',
    });
    expect(storySchema.safeParse(broken).success).toBe(false);
  });

  it('rejects a story with too few slots', () => {
    const broken = structuredClone(base);
    if (broken !== undefined) {
      broken.slots = broken.slots.slice(0, 2);
      broken.sections = [{ id: 'only', lines: [{ id: 'l1', text: 'nothing here' }], revealAnimation: 'stamp' }];
    }
    expect(storySchema.safeParse(broken).success).toBe(false);
  });

  it('rejects a slot with fewer than three house answers', () => {
    const broken = structuredClone(base);
    const slot = broken?.slots[0];
    if (slot !== undefined) slot.fallback = ['only one'];
    expect(storySchema.safeParse(broken).success).toBe(false);
  });

  it('rejects a char limit outside the authoring window', () => {
    const broken = structuredClone(base);
    const slot = broken?.slots[0];
    if (slot !== undefined) slot.charLimit = 500;
    expect(storySchema.safeParse(broken).success).toBe(false);
  });
});
