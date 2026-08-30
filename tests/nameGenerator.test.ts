import { describe, expect, it } from 'vitest';
import {
  NAME_TEMPLATES,
  countCombinations,
  enumerateNames,
  generateName,
  isAcceptableName,
  mergePools,
  type NamePools,
} from '../shared/nameGenerator.js';
import { classicNamePools } from '../content/classic/names.js';
import { crudeNamePools } from '../content/crude/names.js';
import { NAME_MAX_LENGTH } from '../shared/constants.js';
import { makeRng } from '../shared/rng.js';
import { isClean } from '../shared/blocklist.js';
import { textLength } from '../shared/sanitize.js';

const MIN_COMBINATIONS = 5000;

describe('classic name pack size', () => {
  it('clears the 5,000-combination floor after the length filter', () => {
    const usable = enumerateNames(classicNamePools, NAME_TEMPLATES, NAME_MAX_LENGTH);
    expect(usable.size).toBeGreaterThanOrEqual(MIN_COMBINATIONS);
  });

  it('reports an upper bound at least as large as the filtered set', () => {
    const bound = countCombinations(classicNamePools);
    const usable = enumerateNames(classicNamePools, NAME_TEMPLATES, NAME_MAX_LENGTH);
    expect(bound).toBeGreaterThanOrEqual(usable.size);
  });

  it('grows when a word is added to a single pool', () => {
    const before = countCombinations(classicNamePools);
    const after = countCombinations({
      ...classicNamePools,
      adjective: [...classicNamePools.adjective, 'Extremely'],
    });
    expect(after).toBeGreaterThan(before);
  });
});

describe('generateName', () => {
  it('always returns an acceptable name', () => {
    const rng = makeRng(1234);
    for (let i = 0; i < 2000; i += 1) {
      const generated = generateName(rng, classicNamePools);
      expect(isAcceptableName(generated), generated).toBe(true);
      expect(textLength(generated)).toBeLessThanOrEqual(NAME_MAX_LENGTH);
      expect(generated.trim()).toBe(generated);
    }
  });

  it('never repeats the name it was told to avoid', () => {
    const rng = makeRng(99);
    let previous = generateName(rng, classicNamePools);
    for (let i = 0; i < 500; i += 1) {
      const next = generateName(rng, classicNamePools, { avoid: previous });
      expect(next).not.toBe(previous);
      previous = next;
    }
  });

  it('is deterministic for a given seed', () => {
    const a = generateName(makeRng(4242), classicNamePools);
    const b = generateName(makeRng(4242), classicNamePools);
    expect(a).toBe(b);
  });

  it('produces variety rather than one favourite', () => {
    const rng = makeRng(7);
    const seen = new Set<string>();
    for (let i = 0; i < 600; i += 1) seen.add(generateName(rng, classicNamePools));
    expect(seen.size).toBeGreaterThan(400);
  });

  it('degrades gracefully with a pathologically small pack', () => {
    const tiny: NamePools = {
      modifier: ['Damp'],
      title: ['Captain'],
      given: ['Gary'],
      noun: ['Regret'],
      animal: ['Goose'],
      food: ['Gravy'],
      object: ['Mop'],
      occupation: ['Vicar'],
      adjective: ['Smug'],
    };
    const generated = generateName(makeRng(1), tiny);
    expect(generated.length).toBeGreaterThan(0);
    expect(isAcceptableName(generated)).toBe(true);
  });
});

describe('adversarial blocklist filtering', () => {
  const adversarial: NamePools = {
    modifier: ['Damp', 'Nig'],
    title: ['Captain'],
    given: ['Gary', 'Ger'],
    noun: ['Regret'],
    animal: ['Goose'],
    food: ['Gravy'],
    object: ['Mop'],
    occupation: ['Vicar'],
    adjective: ['Smug'],
  };

  it('rejects a pair that is only hateful once the space is removed', () => {
    // "Nig Ger" is clean word-by-word and vile concatenated. The generator must
    // check the squashed form, which is exactly what isAcceptableName does.
    expect(isClean('Nig')).toBe(true);
    expect(isClean('Ger')).toBe(true);
    expect(isAcceptableName('Nig Ger')).toBe(false);
  });

  it('never emits the forbidden pairing even when it is in the pools', () => {
    const rng = makeRng(31337);
    for (let i = 0; i < 4000; i += 1) {
      expect(generateName(rng, adversarial)).not.toBe('Nig Ger');
    }
  });

  it('enumerates without ever including a blocked pairing', () => {
    for (const name of enumerateNames(adversarial)) {
      expect(isClean(name.replace(/\s+/gu, '')), name).toBe(true);
    }
  });

  it('leaves innocent look-alikes alone', () => {
    // Squash-folding would turn these into blocked roots if applied naively.
    for (const word of ['Speed', 'Sped', 'Con', 'Cocoon', 'Raccoon', 'Flag', 'Scunthorpe']) {
      expect(isClean(word), word).toBe(true);
    }
  });
});

describe('crude pack', () => {
  it('is a separate module that merges with the classic pools', () => {
    const merged = mergePools(classicNamePools, crudeNamePools);
    expect(merged.adjective.length).toBe(
      classicNamePools.adjective.length + crudeNamePools.adjective.length,
    );
    expect(countCombinations(merged)).toBeGreaterThan(countCombinations(classicNamePools));
  });

  it('produces only clean, in-length names', () => {
    const merged = mergePools(classicNamePools, crudeNamePools);
    const rng = makeRng(2024);
    for (let i = 0; i < 2000; i += 1) {
      const generated = generateName(rng, merged);
      expect(isAcceptableName(generated), generated).toBe(true);
    }
  });
});
