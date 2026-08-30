/**
 * BLURT — classic story pack.
 *
 * One file per story (see `./stories/`), aggregated here. Adding a story is two
 * lines: drop the file in and add it to this array. `pnpm lint:content` validates it
 * against the schema and fails the build on anything malformed.
 */

import type { StoryInput } from '../schema.js';
import { annualReview } from './stories/annualReview.js';
import { theCruise } from './stories/theCruise.js';
import { parentsEvening } from './stories/parentsEvening.js';
import { theHouseSitter } from './stories/theHouseSitter.js';

export const classicStories: readonly StoryInput[] = [
  annualReview,
  theCruise,
  parentsEvening,
  theHouseSitter,
];

export default classicStories;
