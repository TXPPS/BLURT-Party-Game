/**
 * BLURT — crude story pack.
 *
 * Adult, vulgar, gross-out, unhinged. Loaded only when a room is in Crude mode.
 * The non-negotiable boundaries are documented in CONTENT_GUIDE.md and enforced by
 * `shared/blocklist.ts`, which every story is run through at validation time.
 */

import type { StoryInput } from '../schema.js';
import { theStagDo } from './stories/theStagDo.js';
import { theCheckUp } from './stories/theCheckUp.js';
import { theGroupChat } from './stories/theGroupChat.js';

export const crudeStories: readonly StoryInput[] = [theStagDo, theCheckUp, theGroupChat];

export default crudeStories;
