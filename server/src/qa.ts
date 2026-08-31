/**
 * BLURT — manual-QA aids.
 *
 * Testing this game by hand is otherwise miserable: you need four devices, and
 * anything past the first round costs ten minutes of real play to reach. This lets
 * one person fill a room with stand-in players and jump straight to the screen they
 * actually want to look at.
 *
 * **It is off unless a secret is set.** `QA_TOKEN` is a Worker secret, not a var and
 * not anything the client bundle knows. If it is unset — which is the default, and the
 * state of any deploy where somebody has not deliberately turned this on — every QA
 * route 404s exactly as if it did not exist. Fail-closed, because the alternative is a
 * public endpoint that lets a stranger reset somebody's game.
 *
 * The stand-ins are not real clients. They are players in the room state flagged
 * `isBot`, and `autoplayBots` submits for them through the same functions a real
 * submission goes through — so a QA room exercises the real scoring, the real
 * matchmaking and the real phase machine, not a parallel implementation of them.
 */

import { NAME_MAX_LENGTH } from '../../shared/constants.js';
import type { Phase } from '../../shared/types.js';
import { buildDrawingOptions, currentDrawingRecord, guessersFor, recordDrawingVote, recordGuess, uniqueHouseDecoyFor } from './finale.js';
import { hasSubmitted, recordVote, submitAnswer } from './match.js';
import { createPlayer, eligiblePlayers } from './roomState.js';
import { slotFor } from './story.js';
import type { RoomState, ServerPlayer } from './types.js';

/**
 * The matchup in play. Inlined rather than imported from `viewParts`, which reaches
 * the Workers-only phase table and would drag this module out of the pure set the
 * tests can compile against.
 */
function currentMatchup(state: RoomState) {
  return state.match?.matchups[state.match.matchupIndex];
}

/** Stand-in names, obviously fake so nobody mistakes one for a real player. */
const BOT_NAMES = [
  'QA Doris', 'QA Nigel', 'QA Brenda', 'QA Kevin', 'QA Sandra',
  'QA Trevor', 'QA Denise', 'QA Malcolm', 'QA Yvonne',
];
const BOT_AVATARS = ['raccoon', 'possum', 'pickle', 'skeleton', 'alien', 'toilet', 'boot', 'clown', 'eyeball'];

/**
 * Constant-time-ish comparison. Not a serious threat model — this gates a test aid on
 * a party game — but a plain `===` on a secret is a bad habit to leave in a codebase.
 */
export function tokenMatches(expected: string | undefined, given: string | null): boolean {
  if (expected === undefined || expected === '') return false;
  if (given === null || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

/** Add `count` stand-in players, already named and ready. */
export function addBots(state: RoomState, count: number, now: number, max: number): number {
  const room = state.players.filter((p) => !p.kicked).length;
  const wanted = Math.max(0, Math.min(count, max - room));
  for (let i = 0; i < wanted; i += 1) {
    const bot = createPlayer(now, false);
    const index = state.players.filter((p) => p.isBot).length;
    bot.name = (BOT_NAMES[index % BOT_NAMES.length] ?? 'QA Player').slice(0, NAME_MAX_LENGTH);
    bot.avatarId = BOT_AVATARS[index % BOT_AVATARS.length] ?? 'raccoon';
    bot.identified = true;
    bot.ready = true;
    bot.isBot = true;
    // Bots pass the gate: a QA room in Crude mode should not stall on their consent.
    bot.adultAcknowledged = true;
    state.players.push(bot);
  }
  return wanted;
}

export function removeBots(state: RoomState): number {
  const before = state.players.length;
  state.players = state.players.filter((p) => !p.isBot);
  state.readyToAdvance = state.readyToAdvance.filter((id) =>
    state.players.some((p) => p.id === id),
  );
  return before - state.players.length;
}

/**
 * Play every bot's turn for the phase the room is now in.
 *
 * Called on phase entry, so a QA room advances the moment the human has acted rather
 * than sitting out a deadline waiting for players who do not exist.
 */
export function autoplayBots(state: RoomState, now: number): void {
  const bots = state.players.filter((p) => p.isBot && !p.kicked);
  if (bots.length === 0) return;

  switch (state.phase) {
    case 'ROUND_PROMPT': {
      const matchup = currentMatchup(state);
      if (matchup === undefined) return;
      for (const bot of bots) {
        if (!matchup.competitorIds.includes(bot.id)) continue;
        if (hasSubmitted(matchup, bot.id)) continue;
        const slot = slotFor(matchup.storyId, matchup.slotId);
        const pool = slot?.fallback ?? ['something went wrong'];
        submitAnswer(state, bot.id, pool[bot.id.length % pool.length] ?? 'a QA answer');
      }
      return;
    }

    case 'ROUND_VOTE': {
      const matchup = currentMatchup(state);
      if (matchup === undefined) return;
      for (const bot of bots) {
        if (!matchup.voterIds.includes(bot.id)) continue;
        if (matchup.votes[bot.id] !== undefined) continue;
        // Never its own answer; the server would refuse it anyway.
        const options = matchup.answers.filter((answer) => answer.authorId !== bot.id);
        const pick = options[bot.id.length % Math.max(1, options.length)];
        if (pick !== undefined) recordVote(state, bot.id, pick.id);
      }
      return;
    }

    case 'DRAWING_GUESS': {
      const drawing = currentDrawingRecord(state);
      if (drawing === undefined) return;
      const taken = new Set(Object.values(drawing.guesses));
      for (const bot of bots) {
        if (!guessersFor(state, now).includes(bot.id)) continue;
        if (drawing.guesses[bot.id] !== undefined) continue;
        const decoy = uniqueHouseDecoyFor(state, drawing.index, bot.id, taken);
        taken.add(decoy);
        recordGuess(state, bot.id, decoy);
      }
      return;
    }

    case 'DRAWING_VOTE': {
      const drawing = currentDrawingRecord(state);
      if (drawing === undefined) return;
      if (drawing.options.length === 0) buildDrawingOptions(state);
      for (const bot of bots) {
        if (!guessersFor(state, now).includes(bot.id)) continue;
        if (drawing.votes[bot.id] !== undefined) continue;
        const options = drawing.options.filter((o) => o.authorId !== bot.id);
        const pick = options[bot.id.length % Math.max(1, options.length)];
        if (pick !== undefined) recordDrawingVote(state, bot.id, pick.id);
      }
      return;
    }

    default:
      // Watching screens: bots are ready immediately, so the room only ever waits on
      // the humans in it.
      for (const bot of bots) {
        if (!state.readyToAdvance.includes(bot.id)) state.readyToAdvance.push(bot.id);
      }
  }
}

/** Bots never draw, so their picture is the blank one — which is already handled. */
export function botsAreArtists(state: RoomState, now: number): ServerPlayer[] {
  return eligiblePlayers(state, now).filter((p) => p.isBot);
}

export const QA_PHASES: readonly Phase[] = [
  'LOBBY', 'GAME_SETUP', 'ROUND_PROMPT', 'ROUND_WAITING', 'ROUND_REVEAL', 'ROUND_VOTE',
  'ROUND_RESULTS', 'STORY_UPDATE', 'FINAL_STORY', 'DRAWING_SETUP', 'DRAWING_ACTIVE',
  'DRAWING_GUESS', 'DRAWING_VOTE', 'DRAWING_RESULTS', 'FINAL_RESULTS',
];
