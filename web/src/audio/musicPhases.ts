/**
 * BLURT — which track belongs to which phase.
 *
 * One question decides it: is anybody under time pressure? The lobby track covers the
 * screens where people are arriving, reading or arguing about a result; the game track
 * covers the ones with a clock running.
 *
 * FINAL_RESULTS is on the lobby track on purpose. The match is over, the room is
 * talking again, and dropping back to the arrival music is the audible full stop.
 */

import type { Phase } from '@shared/types.js';

export const LOBBY_PHASES: ReadonlySet<Phase> = new Set<Phase>([
  'LOBBY',
  'GAME_SETUP',
  'FINAL_STORY',
  'FINAL_RESULTS',
]);
