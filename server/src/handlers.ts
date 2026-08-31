/**
 * BLURT — per-message handlers.
 *
 * By the time anything here runs, the dispatcher has already proved: the frame
 * parsed, the message is in the schema, the sender owns a seat, the message is legal
 * in the current phase, and — for a host-only action — that the sender really is the
 * host according to the *server's* record, never a flag from the client.
 *
 * What is left is the game rule itself, which is what this file is.
 */

import {
  ANSWER_MAX_LENGTH,
  DRAWING_GUESS_MAX_LENGTH,
  MAX_PLAYERS,
  NAME_MAX_LENGTH,
  ROUNDS_MAX,
  ROUNDS_MIN,
} from '../../shared/constants.js';
import type { ClientMessage, ErrorCode } from '../../shared/protocol.js';
import { disambiguateName, sanitizeText } from '../../shared/sanitize.js';
import type { GameSettings, Phase } from '../../shared/types.js';
import { currentDrawingRecord, drawingForArtist, recordDrawingVote, recordGuess } from './finale.js';
import type { PhaseExitReason } from './pacingLog.js';
import { hasSubmitted, recordVote, resetForNewMatch, startMatch, submitAnswer } from './match.js';
import { assignHost, findPlayer, isEligible, startBlock } from './roomState.js';
import { slotFor } from './story.js';
import type { PhaseEffects, RoomState, ServerPlayer } from './types.js';

export interface HandlerContext {
  state: RoomState;
  now: number;
  player: ServerPlayer;
  effects: PhaseEffects;
  goTo(phase: Phase): void;
  /** Run the current phase's advance path — the same one its deadline would take. */
  /**
   * Re-ask the current phase whether it is finished, and transition if so.
   *
   * The reason is only ever used by the pacing log, but it is a parameter rather than
   * an inference because the two callers mean genuinely different things: a landed
   * submission, and the host deciding to move on.
   */
  advancePhase(reason?: PhaseExitReason): void;
  /** Send a non-fatal error to this socket only. */
  fail(code: ErrorCode, message?: string): void;
  /** Persist a drawing outside the JSON state. */
  storeDrawing(index: number, dataUrl: string): void;
  /** Drop every stored drawing. Called when a match ends. */
  clearDrawings(): void;
  /** Remove a player's sockets with a reason. */
  evict(playerId: string, code: ErrorCode): void;
}

export function handleMessage(ctx: HandlerContext, message: ClientMessage): void {
  switch (message.t) {
    case 'identify':
      return identify(ctx, message.name, message.avatarId);
    case 'set_ready':
      return setReady(ctx, message.ready);
    case 'update_settings':
      return updateSettings(ctx, message.settings);
    case 'kick_player':
      return kickPlayer(ctx, message.playerId);
    case 'start_game':
      return startGame(ctx);
    case 'submit_answer':
      return answer(ctx, message.roundId, message.text);
    case 'submit_vote':
      return vote(ctx, message.roundId, message.answerId);
    case 'submit_drawing':
      return drawing(ctx, message.roundId, message.strokesPngDataUrl);
    case 'submit_drawing_guess':
      return drawingGuess(ctx, message.roundId, message.text);
    case 'submit_drawing_vote':
      return drawingVote(ctx, message.roundId, message.optionId);
    case 'advance':
      return ctx.advancePhase('host');
    case 'play_again':
      return playAgain(ctx);
    case 'return_to_lobby':
      return returnToLobby(ctx);
    case 'acknowledge_adult':
      ctx.player.adultAcknowledged = true;
      return;
    // Connection-level messages are handled by the dispatcher before this point.
    case 'create_room':
    case 'join_room':
    case 'reconnect':
    case 'ping':
      return;
  }
}

/* ------------------------------------------------------------------ *
 * Lobby
 * ------------------------------------------------------------------ */

function identify(ctx: HandlerContext, rawName: string, avatarId: string): void {
  const clean = sanitizeText(rawName, { maxLength: NAME_MAX_LENGTH });
  if (!clean.ok) {
    ctx.fail('INVALID_NAME');
    return;
  }
  const taken = ctx.state.players
    .filter((p) => p.id !== ctx.player.id && !p.kicked && p.name.length > 0)
    .map((p) => p.name);

  ctx.player.name = disambiguateName(clean.value, taken, NAME_MAX_LENGTH);
  ctx.player.avatarId = avatarId;
  const wasIdentified = ctx.player.identified;
  ctx.player.identified = true;

  // The first person to name themselves becomes the host if nobody holds it.
  if (ctx.state.hostId === null) assignHost(ctx.state, ctx.player.id);

  // Announce arrivals only once the game is under way. In the lobby the roster is
  // right there and updates live, so nine people joining would stack nine toasts
  // over the host's settings for no information at all.
  if (!wasIdentified && ctx.state.phase !== 'LOBBY') {
    ctx.effects.toast('info', `${ctx.player.name} joined.`);
  }
}

function setReady(ctx: HandlerContext, ready: boolean): void {
  if (!ctx.player.identified) {
    ctx.fail('INVALID_NAME', 'Pick a name and an avatar first.');
    return;
  }
  ctx.player.ready = ready;
}

/**
 * Host-only. Every field is re-validated and re-clamped server-side, so a hand-built
 * socket message asking for 900 rounds gets 15.
 */
function updateSettings(ctx: HandlerContext, patch: Partial<GameSettings>): void {
  const settings = ctx.state.settings;
  if (patch.mode !== undefined) {
    settings.mode = patch.mode;
    // Switching out of crude clears the gate so re-entering asks again.
    if (patch.mode === 'classic') {
      for (const player of ctx.state.players) player.adultAcknowledged = false;
    }
  }
  if (patch.rounds !== undefined) {
    settings.rounds = Math.min(ROUNDS_MAX, Math.max(ROUNDS_MIN, Math.round(patch.rounds)));
  }
  if (patch.timerSpeed !== undefined) settings.timerSpeed = patch.timerSpeed;
  if (patch.drawingFinale !== undefined) settings.drawingFinale = patch.drawingFinale;
}

function kickPlayer(ctx: HandlerContext, playerId: string): void {
  if (playerId === ctx.player.id) {
    ctx.fail('INVALID_MESSAGE', 'You cannot remove yourself.');
    return;
  }
  const target = findPlayer(ctx.state, playerId);
  if (target === undefined || target.kicked) {
    ctx.fail('INVALID_MESSAGE', 'That player is not here.');
    return;
  }
  target.kicked = true;
  target.connected = false;
  target.ready = false;
  ctx.effects.toast('bad', `${target.name || 'A player'} was removed by the host.`);
  ctx.evict(playerId, 'KICKED');
}

function startGame(ctx: HandlerContext): void {
  const block = startBlock(ctx.state, ctx.now);
  if (!block.canStart) {
    ctx.fail('INVALID_MESSAGE', block.reason ?? 'Not ready to start yet.');
    return;
  }
  const started = startMatch(ctx.state, ctx.now);
  if (!started.ok) {
    ctx.fail('SERVER_ERROR', started.reason ?? 'Could not start the match.');
    return;
  }
  ctx.goTo('GAME_SETUP');
}

/* ------------------------------------------------------------------ *
 * Standard rounds
 * ------------------------------------------------------------------ */

function answer(ctx: HandlerContext, roundId: string, rawText: string): void {
  const match = ctx.state.match;
  const matchup = match?.matchups[match.matchupIndex];
  if (matchup === undefined || matchup.roundId !== roundId) {
    ctx.fail('WRONG_PHASE', 'That round has already moved on.');
    return;
  }
  if (!matchup.competitorIds.includes(ctx.player.id)) {
    ctx.fail('NOT_YOUR_TURN');
    return;
  }

  const slot = slotFor(matchup.storyId, matchup.slotId);
  const limit = Math.min(slot?.charLimit ?? ANSWER_MAX_LENGTH, ANSWER_MAX_LENGTH);
  const clean = sanitizeText(rawText, { maxLength: limit });
  if (!clean.ok) {
    ctx.fail(
      'INVALID_MESSAGE',
      clean.reason === 'too_long' ? `Keep it under ${limit} characters.` : 'Write something first.',
    );
    return;
  }

  // Idempotent: a repeat submit replaces the draft. Rapid double-taps cannot
  // create two answers or score twice.
  submitAnswer(ctx.state, ctx.player.id, clean.value);
  ctx.advancePhase();
}

function vote(ctx: HandlerContext, roundId: string, answerId: string): void {
  const match = ctx.state.match;
  const matchup = match?.matchups[match.matchupIndex];
  if (matchup === undefined || matchup.roundId !== roundId) {
    ctx.fail('WRONG_PHASE', 'That vote has already closed.');
    return;
  }
  if (!matchup.voterIds.includes(ctx.player.id)) {
    ctx.fail('NOT_YOUR_TURN', 'You are not voting in this one.');
    return;
  }
  const target = matchup.answers.find((a) => a.id === answerId);
  if (target === undefined) {
    ctx.fail('INVALID_MESSAGE', 'That answer is not in this round.');
    return;
  }
  // Enforced here, not just hidden in the UI: a hand-crafted socket message asking
  // to vote for your own answer is refused.
  if (target.authorId === ctx.player.id) {
    ctx.fail('SELF_VOTE');
    return;
  }
  if (matchup.votes[ctx.player.id] !== undefined) {
    ctx.fail('ALREADY_SUBMITTED');
    return;
  }

  recordVote(ctx.state, ctx.player.id, answerId);
  ctx.advancePhase();
}

/* ------------------------------------------------------------------ *
 * Drawing finale
 * ------------------------------------------------------------------ */

function drawing(ctx: HandlerContext, roundId: string, dataUrl: string): void {
  // Everybody draws at once, so the submission is matched to *this* player's own
  // drawing rather than to whichever one the showcase pointer happens to be on.
  const record = drawingForArtist(ctx.state, ctx.player.id);
  if (record === undefined) {
    ctx.fail('NOT_YOUR_TURN', 'You are not drawing this round.');
    return;
  }
  if (record.roundId !== roundId) {
    ctx.fail('WRONG_PHASE', 'That drawing round is over.');
    return;
  }
  record.hasImage = true;
  ctx.storeDrawing(record.index, dataUrl);
  ctx.advancePhase();
}

function drawingGuess(ctx: HandlerContext, roundId: string, rawText: string): void {
  const record = currentDrawingRecord(ctx.state);
  if (record === undefined || record.roundId !== roundId) {
    ctx.fail('WRONG_PHASE', 'Too late for that one.');
    return;
  }
  if (record.artistId === ctx.player.id) {
    ctx.fail('NOT_YOUR_TURN', 'You drew it. You already know.');
    return;
  }
  const clean = sanitizeText(rawText, { maxLength: DRAWING_GUESS_MAX_LENGTH });
  if (!clean.ok) {
    ctx.fail('INVALID_MESSAGE', 'Write a short guess first.');
    return;
  }
  recordGuess(ctx.state, ctx.player.id, clean.value);
  ctx.advancePhase();
}

function drawingVote(ctx: HandlerContext, roundId: string, optionId: string): void {
  const record = currentDrawingRecord(ctx.state);
  if (record === undefined || record.roundId !== roundId) {
    ctx.fail('WRONG_PHASE', 'That vote has closed.');
    return;
  }
  if (record.artistId === ctx.player.id) {
    ctx.fail('NOT_YOUR_TURN', 'Artists do not vote.');
    return;
  }
  const option = record.options.find((o) => o.id === optionId);
  if (option === undefined) {
    ctx.fail('INVALID_MESSAGE', 'That option is not on the board.');
    return;
  }
  if (option.authorId === ctx.player.id) {
    ctx.fail('SELF_VOTE', 'You wrote that one.');
    return;
  }
  if (record.votes[ctx.player.id] !== undefined) {
    ctx.fail('ALREADY_SUBMITTED');
    return;
  }
  recordDrawingVote(ctx.state, ctx.player.id, optionId);
  ctx.advancePhase();
}

/* ------------------------------------------------------------------ *
 * After the match
 * ------------------------------------------------------------------ */

function playAgain(ctx: HandlerContext): void {
  // Everyone keeps their seat, name, avatar and settings; scores and stats reset.
  ctx.clearDrawings();
  resetForNewMatch(ctx.state);
  const started = startMatch(ctx.state, ctx.now);
  if (!started.ok) {
    ctx.fail('SERVER_ERROR', started.reason ?? 'Could not start another match.');
    ctx.goTo('LOBBY');
    return;
  }
  for (const player of ctx.state.players) player.ready = true;
  ctx.effects.toast('good', 'Again! New story, same idiots.');
  ctx.goTo('GAME_SETUP');
}

function returnToLobby(ctx: HandlerContext): void {
  ctx.clearDrawings();
  resetForNewMatch(ctx.state);
  ctx.goTo('LOBBY');
}

/* ------------------------------------------------------------------ *
 * Capacity
 * ------------------------------------------------------------------ */

/** Whether a brand-new player can still take a seat. */
export function hasRoomFor(state: RoomState, now: number): boolean {
  const seated = state.players.filter((p) => !p.kicked && (isEligible(p, now) || !p.departed));
  return seated.length < MAX_PLAYERS;
}

export { hasSubmitted };
export type { ServerPlayer };
