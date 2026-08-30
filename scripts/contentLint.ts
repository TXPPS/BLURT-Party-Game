/**
 * BLURT — content linter.
 *
 * Run by `pnpm lint:content`, and part of `pnpm verify`. Exits non-zero on any
 * failure, so a bad room-code word or a story that references a missing slot breaks
 * the build rather than the party.
 *
 * Checks:
 *   1. every story parses against the zod schema (structure, slot wiring, blocklist)
 *   2. the room-code wordlist is big enough, uniform, unique and clean
 *   3. the name generator clears its combination floor and produces nothing hateful
 *   4. every `audioCue` in the content names a real SFX event
 *   5. the crude packs stay inside the documented content boundaries
 */

import { classicNamePools } from '../content/classic/names.js';
import { crudeNamePools } from '../content/crude/names.js';
import {
  MIN_CLASSIC_STORIES,
  MIN_CRUDE_STORIES,
  contentStats,
  loadContent,
} from '../content/index.js';
import { MIN_SLOTS_PER_STORY } from '../content/schema.js';
import { BLOCKLIST_SIZE, findBlocked } from '../shared/blocklist.js';
import { NAME_MAX_LENGTH } from '../shared/constants.js';
import {
  NAME_POOL_KEYS,
  countCombinations,
  enumerateNames,
  mergePools,
} from '../shared/nameGenerator.js';
import { ROOM_WORDS, MIN_ROOM_WORDS } from '../shared/roomWords.js';
import { isSfxEventId } from '../shared/sfx.js';

/** The classic pack must be able to produce at least this many distinct names. */
const MIN_CLASSIC_NAME_COMBINATIONS = 5000;

const failures: string[] = [];
const notes: string[] = [];

function fail(message: string): void {
  failures.push(message);
}

function note(message: string): void {
  notes.push(message);
}

/* 1 — stories --------------------------------------------------------------- */

const loaded = loadContent();
for (const issue of loaded.issues) {
  fail(`[story:${issue.mode}/${issue.storyId}] ${issue.message}`);
}

const stats = contentStats();
if (stats.classicStories < MIN_CLASSIC_STORIES) {
  fail(`only ${stats.classicStories} classic stories; the MVP requires ${MIN_CLASSIC_STORIES}`);
}
if (stats.crudeStories < MIN_CRUDE_STORIES) {
  fail(`only ${stats.crudeStories} crude stories; the MVP requires ${MIN_CRUDE_STORIES}`);
}
for (const id of stats.storiesBelowMinimum) {
  fail(`story "${id}" has fewer than ${MIN_SLOTS_PER_STORY} slots`);
}
note(
  `stories: ${stats.classicStories} classic + ${stats.crudeStories} crude, ` +
    `${stats.totalSlots} slots total, smallest story has ${stats.minSlotsInAStory}`,
);

/* 2 — room-code wordlist ---------------------------------------------------- */

if (ROOM_WORDS.length < MIN_ROOM_WORDS) {
  fail(`room wordlist has ${ROOM_WORDS.length} entries; ${MIN_ROOM_WORDS} required`);
}

const seenWords = new Set<string>();
for (const word of ROOM_WORDS) {
  if (!/^[A-Z]{4}$/.test(word)) fail(`room word "${word}" is not four A-Z characters`);
  if (seenWords.has(word)) fail(`room word "${word}" appears twice`);
  seenWords.add(word);
  const hits = findBlocked(word);
  if (hits.length > 0) fail(`room word "${word}" trips the blocklist (${hits[0]?.root})`);
}
note(`room codes: ${ROOM_WORDS.length} curated words, all unique and clean`);

/* 3 — name generator -------------------------------------------------------- */

for (const key of NAME_POOL_KEYS) {
  for (const pools of [classicNamePools, crudeNamePools]) {
    for (const word of pools[key]) {
      if (word.trim() !== word) fail(`name pool word "${word}" has stray whitespace`);
      const hits = findBlocked(word);
      if (hits.length > 0) fail(`name pool word "${word}" trips the blocklist (${hits[0]?.root})`);
    }
  }
}

const classicUpperBound = countCombinations(classicNamePools);
const classicNames = enumerateNames(classicNamePools, undefined, NAME_MAX_LENGTH);
if (classicNames.size < MIN_CLASSIC_NAME_COMBINATIONS) {
  fail(
    `classic name pack yields ${classicNames.size} usable names ` +
      `(needs ${MIN_CLASSIC_NAME_COMBINATIONS}); upper bound before the ` +
      `${NAME_MAX_LENGTH}-char filter was ${classicUpperBound}`,
  );
}
note(
  `names: ${classicNames.size} classic combinations fit in ${NAME_MAX_LENGTH} chars ` +
    `(${classicUpperBound} before filtering)`,
);

const crudeMerged = mergePools(classicNamePools, crudeNamePools);
const crudeNames = enumerateNames(crudeMerged, undefined, NAME_MAX_LENGTH);
note(`names: ${crudeNames.size} combinations available in crude mode (classic + crude pools)`);

// Every *pairing* is checked, not just every word, because the hateful phrase we are
// guarding against is the one that only exists across the word boundary.
let checkedPairs = 0;
for (const name of crudeNames) {
  checkedPairs += 1;
  const hits = findBlocked(name);
  if (hits.length > 0) fail(`generated name "${name}" trips the blocklist (${hits[0]?.root})`);
}
note(`names: ${checkedPairs} generated pairs checked against ${BLOCKLIST_SIZE} blocked roots`);

/* 4 — audio cues ------------------------------------------------------------ */

const allStories = [...loaded.bundle.classic, ...loaded.bundle.crude];
for (const story of allStories) {
  for (const section of story.sections) {
    if (section.audioCue !== undefined && !isSfxEventId(section.audioCue)) {
      fail(`story "${story.id}" section "${section.id}" names unknown audio cue "${section.audioCue}"`);
    }
  }
}

/* 5 — crude boundaries ------------------------------------------------------ */

for (const story of loaded.bundle.crude) {
  const prose = [
    story.title,
    ...story.sections.flatMap((s) => s.lines.map((l) => l.text)),
    ...story.slots.flatMap((s) => [s.disguisedPrompt, ...s.fallback]),
  ].join(' ');
  const hits = findBlocked(prose).filter((h) => h.category === 'boundary');
  for (const hit of hits) {
    fail(`crude story "${story.id}" crosses a hard content boundary ("${hit.root}")`);
  }
}

/* ---------------------------------------------------------------------------- */

for (const line of notes) console.log(`  · ${line}`);

if (failures.length > 0) {
  console.error(`\n✗ contentLint found ${failures.length} problem(s):\n`);
  for (const line of failures) console.error(`  ✗ ${line}`);
  process.exit(1);
}

console.log('\n✓ contentLint: all content valid.\n');
