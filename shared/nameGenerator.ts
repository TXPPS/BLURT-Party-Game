/**
 * BLURT — random name generator.
 *
 * Combinatorial, not a list of finished strings: pools of parts get slotted into
 * templates, which means the classic pack alone produces five figures' worth of
 * names from a few hundred words, and adding one adjective adds hundreds of names.
 *
 * The generator is pure — it takes an `Rng` and the pools, and returns a string.
 * Content (the actual words) lives in `/content/<mode>/names.ts`, which is why the
 * crude pack can be code-split away from players who never turn it on.
 */

import { NAME_MAX_LENGTH } from './constants.js';
import { isClean } from './blocklist.js';
import type { Rng } from './rng.js';
import { pick } from './rng.js';

/** The part-of-speech buckets a name can be assembled from. */
export const NAME_POOL_KEYS = [
  'modifier',
  'title',
  'given',
  'noun',
  'animal',
  'food',
  'object',
  'occupation',
  'adjective',
] as const;

export type NamePoolKey = (typeof NAME_POOL_KEYS)[number];

export type NamePools = Readonly<Record<NamePoolKey, readonly string[]>>;

export interface NameTemplate {
  readonly id: string;
  readonly parts: readonly NamePoolKey[];
}

/**
 * Shapes that reliably read as a person who should not be trusted with a forklift.
 * Every template is two parts — three-part names blow past the 20-character limit
 * often enough that they were dropped rather than silently truncated.
 */
export const NAME_TEMPLATES: readonly NameTemplate[] = [
  { id: 'modifier-given', parts: ['modifier', 'given'] },
  { id: 'title-noun', parts: ['title', 'noun'] },
  { id: 'adjective-animal', parts: ['adjective', 'animal'] },
  { id: 'modifier-occupation', parts: ['modifier', 'occupation'] },
  { id: 'title-food', parts: ['title', 'food'] },
  { id: 'adjective-object', parts: ['adjective', 'object'] },
  { id: 'title-given', parts: ['title', 'given'] },
  { id: 'modifier-animal', parts: ['modifier', 'animal'] },
];

/**
 * Upper bound on distinct names, ignoring the length filter and the blocklist.
 * `tests/nameGenerator.test.ts` asserts the classic pack clears 5,000.
 */
export function countCombinations(
  pools: NamePools,
  templates: readonly NameTemplate[] = NAME_TEMPLATES,
): number {
  let total = 0;
  for (const template of templates) {
    let product = 1;
    for (const part of template.parts) product *= pools[part].length;
    total += product;
  }
  return total;
}

/**
 * The exact set of names a pack can produce after filtering. Used by the content
 * linter (which needs the real number, not the upper bound) and by tests.
 */
export function enumerateNames(
  pools: NamePools,
  templates: readonly NameTemplate[] = NAME_TEMPLATES,
  maxLength: number = NAME_MAX_LENGTH,
): Set<string> {
  const names = new Set<string>();
  for (const template of templates) {
    const lists = template.parts.map((part) => pools[part]);
    const walk = (index: number, acc: string[]): void => {
      const list = lists[index];
      if (list === undefined) {
        const candidate = acc.join(' ');
        if (isAcceptableName(candidate, maxLength)) names.add(candidate);
        return;
      }
      for (const word of list) walk(index + 1, [...acc, word]);
    };
    walk(0, []);
  }
  return names;
}

/**
 * A generated name is acceptable when it fits the display limit and neither the
 * spaced form nor the squashed form trips the blocklist. The squashed check is what
 * catches an accidentally hateful phrase formed across the word boundary.
 */
export function isAcceptableName(candidate: string, maxLength: number = NAME_MAX_LENGTH): boolean {
  const length = [...candidate].length;
  if (length === 0 || length > maxLength) return false;
  if (!isClean(candidate)) return false;
  if (!isClean(candidate.replace(/\s+/gu, ''))) return false;
  return true;
}

export interface GenerateNameOptions {
  /** Never return this exact name — powers the AGAIN button. */
  readonly avoid?: string;
  readonly maxLength?: number;
  readonly templates?: readonly NameTemplate[];
}

/** How hard we try for a fresh, legal, in-length name before giving up gracefully. */
const MAX_ATTEMPTS = 64;

/**
 * Produce one name. Guaranteed to return a non-empty string that satisfies
 * `isAcceptableName`, and — unless the pack is pathologically small — guaranteed
 * not to equal `options.avoid`.
 */
export function generateName(rng: Rng, pools: NamePools, options: GenerateNameOptions = {}): string {
  const maxLength = options.maxLength ?? NAME_MAX_LENGTH;
  const templates = options.templates ?? NAME_TEMPLATES;
  let fallback: string | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const template = pick(rng, templates);
    if (template === undefined) break;

    const parts: string[] = [];
    let complete = true;
    for (const key of template.parts) {
      const word = pick(rng, pools[key]);
      if (word === undefined) {
        complete = false;
        break;
      }
      parts.push(word);
    }
    if (!complete) continue;

    const candidate = parts.join(' ');
    if (!isAcceptableName(candidate, maxLength)) continue;
    if (candidate !== options.avoid) return candidate;
    fallback ??= candidate;
  }

  // Only reachable with a tiny or heavily filtered pack.
  return fallback ?? firstAcceptableName(pools, templates, maxLength);
}

function firstAcceptableName(
  pools: NamePools,
  templates: readonly NameTemplate[],
  maxLength: number,
): string {
  for (const template of templates) {
    const parts: string[] = [];
    for (const key of template.parts) {
      const word = pools[key][0];
      if (word === undefined) break;
      parts.push(word);
    }
    if (parts.length !== template.parts.length) continue;
    const candidate = parts.join(' ');
    if (isAcceptableName(candidate, maxLength)) return candidate;
  }
  return 'Nameless Blob';
}

/** Merge two packs (crude mode plays with classic + crude words together). */
export function mergePools(a: NamePools, b: NamePools): NamePools {
  const merged = {} as Record<NamePoolKey, readonly string[]>;
  for (const key of NAME_POOL_KEYS) merged[key] = [...a[key], ...b[key]];
  return merged;
}
