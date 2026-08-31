/**
 * BLURT — projecting authoritative state down to what a screen may see.
 *
 * This is the redaction boundary. Two rules are enforced here and nowhere else:
 *
 *   1. **No authorship before the vote resolves.** `ROUND_REVEAL` and `ROUND_VOTE`
 *      build `RevealAnswer`, a type with no author field at all, so a leak is a
 *      compile error rather than a code-review question.
 *   2. **No private prompt or draft crosses devices.** Anything personal is built by
 *      `buildPrivate`, which takes the single player it is building for.
 */

import { FINAL_STORY_LINE_MS } from '../../shared/constants.js';
import type { PrivateMessage } from '../../shared/protocol.js';
import { SCORE_REASON_LABELS, type ScoreEvent } from '../../shared/scoring.js';
import type { PlayerRole, PublicRoom } from '../../shared/types.js';
import type {
  Deadline,
  LeaderboardRow,
  PublicView,
  ResultAnswer,
  ScoreDelta,
  SelfView,
} from '../../shared/views.js';
import { computeMatchAwards, buildHighlightReel } from './results.js';
import {
  eligiblePlayers,
  findPlayer,
  roomExpiresAt,
  startBlock,
  toPublicPlayer,
} from './roomState.js';
import { freshSlotIds, renderMatchStories, slotFor, storyById } from './story.js';
import type { DrawingRecord, MatchupRecord, RoomState, ServerPlayer } from './types.js';

/**
 * Builds the HTTP URL for a drawing. The bytes live outside the JSON state (see
 * `drawingStore.ts`) and are served by the room's own `/api/rooms/:code/drawing`
 * route, so they never travel over the WebSocket.
 */
export type ImageLookup = (drawingIndex: number) => string;

export function deadlineFor(state: RoomState): Deadline {
  return {
    endsAt: state.timers.phase ?? 0,
    durationMs: state.phaseDurationMs,
  };
}

export function currentMatchup(state: RoomState): MatchupRecord | undefined {
  const match = state.match;
  if (match === null) return undefined;
  return match.matchups[match.matchupIndex];
}

export function currentDrawing(state: RoomState): DrawingRecord | undefined {
  const match = state.match;
  if (match === null) return undefined;
  return match.drawings[match.drawingIndex];
}

export function buildPublicRoom(state: RoomState): PublicRoom {
  const match = state.match;
  const firstStory = match === null ? null : storyById(match.storyIds[0] ?? '');
  return {
    code: state.code,
    settings: state.settings,
    hostId: state.hostId,
    hostMigratesAt: state.timers.hostMigration ?? null,
    roundNumber: match === null ? 0 : Math.min(match.matchupIndex + 1, match.plan.length),
    totalRounds: match?.plan.length ?? state.settings.rounds,
    createdAt: state.createdAt,
    expiresAt: roomExpiresAt(state),
    // Withheld until the first story update: the title is the punchline.
    storyTitle: match?.titleRevealed === true ? (firstStory?.title ?? null) : null,
  };
}

/* ------------------------------------------------------------------ *
 * Leaderboard and score deltas
 * ------------------------------------------------------------------ */

export function buildLeaderboard(
  state: RoomState,
  deltaEvents: readonly ScoreEvent[] = [],
): LeaderboardRow[] {
  const deltas = new Map<string, number>();
  for (const event of deltaEvents) {
    deltas.set(event.playerId, (deltas.get(event.playerId) ?? 0) + event.points);
  }

  const rows = state.players
    .filter((p) => !p.kicked && p.identified)
    .map((p) => ({
      playerId: p.id,
      name: p.name,
      avatarId: p.avatarId,
      score: p.score,
      rank: 0,
      connected: p.connected,
      delta: deltas.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  // Equal scores share a rank; the next rank skips accordingly.
  let lastScore: number | null = null;
  let lastRank = 0;
  rows.forEach((row, index) => {
    if (lastScore !== null && row.score === lastScore) {
      row.rank = lastRank;
    } else {
      row.rank = index + 1;
      lastRank = row.rank;
      lastScore = row.score;
    }
  });

  return rows;
}

export function buildDeltas(state: RoomState, events: readonly ScoreEvent[]): ScoreDelta[] {
  return events
    .filter((event) => findPlayer(state, event.playerId) !== undefined)
    .map((event) => ({
      playerId: event.playerId,
      points: event.points,
      reason: event.reason,
      label: SCORE_REASON_LABELS[event.reason],
    }));
}

/* ------------------------------------------------------------------ *
 * Roles
 * ------------------------------------------------------------------ */

export function roleFor(state: RoomState, player: ServerPlayer): PlayerRole {
  const matchup = currentMatchup(state);
  const drawing = currentDrawing(state);

  switch (state.phase) {
    case 'ROUND_PROMPT':
    case 'ROUND_WAITING':
      return matchup?.competitorIds.includes(player.id) === true ? 'COMPETITOR' : 'SPECTATOR_OF_ROUND';
    case 'ROUND_REVEAL':
      return matchup?.competitorIds.includes(player.id) === true ? 'COMPETITOR' : 'VOTER';
    case 'ROUND_VOTE':
      return matchup?.voterIds.includes(player.id) === true ? 'VOTER' : 'SPECTATOR_OF_ROUND';
    case 'DRAWING_SETUP':
    case 'DRAWING_ACTIVE':
      return drawing?.artistId === player.id ? 'ARTIST' : 'SPECTATOR_OF_ROUND';
    case 'DRAWING_GUESS':
      return drawing?.artistId === player.id ? 'ARTIST' : 'GUESSER';
    case 'DRAWING_VOTE':
      return drawing?.artistId === player.id ? 'ARTIST' : 'VOTER';
    default:
      // Lobby, story beats and results: nobody has a job beyond watching.
      return 'SPECTATOR_OF_ROUND';
  }
}

export function buildSelfView(state: RoomState, player: ServerPlayer): SelfView {
  return {
    playerId: player.id,
    isHost: state.hostId === player.id,
    role: roleFor(state, player),
    score: player.score,
    needsAdultGate: state.settings.mode === 'crude' && !player.adultAcknowledged,
  };
}

/* ------------------------------------------------------------------ *
 * The public view
 * ------------------------------------------------------------------ */

function resultAnswers(state: RoomState, matchup: MatchupRecord): ResultAnswer[] {
  const outcome = matchup.resolved;
  const votersByAnswer = new Map<string, string[]>();
  for (const [voterId, answerId] of Object.entries(matchup.votes)) {
    const list = votersByAnswer.get(answerId);
    if (list === undefined) votersByAnswer.set(answerId, [voterId]);
    else list.push(voterId);
  }

  return matchup.answers.map((answer) => {
    const author = answer.authorId === null ? undefined : findPlayer(state, answer.authorId);
    return {
      id: answer.id,
      text: answer.text,
      votes: outcome?.voteCounts[answer.id] ?? 0,
      authorId: answer.authorId,
      authorName: author?.name ?? 'THE HOUSE',
      authorAvatarId: author?.avatarId ?? null,
      isFallback: answer.isFallback,
      isWinner: outcome?.winningAnswerId === answer.id,
      voterIds: votersByAnswer.get(answer.id) ?? [],
    };
  });
}

export function buildPublicView(
  state: RoomState,
  now: number,
  images: ImageLookup,
  joinUrl: string,
): PublicView {
  const deadline = deadlineFor(state);
  const match = state.match;
  const matchup = currentMatchup(state);
  const drawing = currentDrawing(state);
  const roundNumber = match === null ? 0 : match.matchupIndex + 1;
  const totalRounds = match?.plan.length ?? state.settings.rounds;

  const promptText = (record: MatchupRecord | undefined): string =>
    record === undefined ? '' : (slotFor(record.storyId, record.slotId)?.disguisedPrompt ?? '');

  switch (state.phase) {
    case 'LOBBY': {
      const block = startBlock(state, now);
      return {
        phase: 'LOBBY',
        joinUrl,
        canStart: block.canStart,
        blockReason: block.reason,
        crudeAcknowledged: state.players.some((p) => p.adultAcknowledged),
      };
    }

    case 'GAME_SETUP': {
      const story = match === null ? undefined : storyById(match.storyIds[0] ?? '');
      const revealed = match?.titleRevealed === true;
      return {
        phase: 'GAME_SETUP',
        storyTitle: revealed ? (story?.title ?? null) : null,
        genre: revealed ? (story?.genre ?? null) : null,
        totalRounds,
        deadline,
      };
    }

    case 'ROUND_PROMPT': {
      const slot = matchup === undefined ? undefined : slotFor(matchup.storyId, matchup.slotId);
      return {
        phase: 'ROUND_PROMPT',
        roundId: matchup?.roundId ?? '',
        roundNumber,
        totalRounds,
        prompt: slot?.disguisedPrompt ?? '',
        hint: slot?.hint ?? null,
        charLimit: slot?.charLimit ?? 0,
        competitorIds: matchup?.competitorIds ?? [],
        submittedIds: (matchup?.answers ?? [])
          .filter((a) => a.authorId !== null && !a.isFallback)
          .map((a) => a.authorId as string),
        deadline,
      };
    }

    case 'ROUND_WAITING':
      return {
        phase: 'ROUND_WAITING',
        roundNumber,
        totalRounds,
        competitorIds: matchup?.competitorIds ?? [],
        deadline,
      };

    case 'ROUND_REVEAL':
      return {
        phase: 'ROUND_REVEAL',
        roundNumber,
        totalRounds,
        prompt: promptText(matchup),
        // Anonymous by construction: RevealAnswer has no author field.
        answers: (matchup?.answers ?? []).map((a) => ({ id: a.id, text: a.text })),
        deadline,
      };

    case 'ROUND_VOTE':
      return {
        phase: 'ROUND_VOTE',
        roundId: matchup?.roundId ?? '',
        roundNumber,
        totalRounds,
        prompt: promptText(matchup),
        answers: (matchup?.answers ?? []).map((a) => ({ id: a.id, text: a.text })),
        votesIn: Object.keys(matchup?.votes ?? {}).length,
        votersTotal: matchup?.voterIds.length ?? 0,
        deadline,
      };

    case 'ROUND_RESULTS': {
      const outcome = matchup?.resolved ?? null;
      return {
        phase: 'ROUND_RESULTS',
        roundNumber,
        totalRounds,
        prompt: promptText(matchup),
        answers: matchup === undefined ? [] : resultAnswers(state, matchup),
        winningAnswerId: outcome?.winningAnswerId ?? null,
        wasCoinFlip: outcome?.wasCoinFlip ?? false,
        wasCleanSweep: outcome?.wasCleanSweep ?? false,
        nobodyVoted: outcome?.nobodyVoted ?? false,
        deltas: buildDeltas(state, outcome?.events ?? []),
        leaderboard: buildLeaderboard(state, outcome?.events ?? []),
        deadline,
      };
    }

    case 'STORY_UPDATE':
      return {
        phase: 'STORY_UPDATE',
        stories: match === null ? [] : renderMatchStories(match, { freshFrom: match.storyUpdatedThrough }),
        freshSlotIds: match === null ? [] : freshSlotIds(match, match.storyUpdatedThrough),
        roundNumber,
        totalRounds,
        deadline,
      };

    case 'FINAL_STORY':
      return {
        phase: 'FINAL_STORY',
        stories: match === null ? [] : renderMatchStories(match, { revealAll: true }),
        lineDelayMs: FINAL_STORY_LINE_MS,
        deadline,
      };

    case 'DRAWING_SETUP':
    case 'DRAWING_ACTIVE': {
      const artist = drawing === undefined ? undefined : findPlayer(state, drawing.artistId);
      const common = {
        roundId: drawing?.roundId ?? '',
        artistId: drawing?.artistId ?? '',
        artistName: artist?.name ?? 'somebody',
        drawingIndex: (match?.drawingIndex ?? 0) + 1,
        drawingTotal: match?.drawings.length ?? 0,
        deadline,
      };
      return state.phase === 'DRAWING_SETUP'
        ? { phase: 'DRAWING_SETUP', ...common }
        : { phase: 'DRAWING_ACTIVE', ...common, submitted: drawing?.hasImage === true };
    }

    case 'DRAWING_GUESS': {
      const artist = drawing === undefined ? undefined : findPlayer(state, drawing.artistId);
      const guessers = eligiblePlayers(state, now).filter((p) => p.id !== drawing?.artistId);
      return {
        phase: 'DRAWING_GUESS',
        roundId: drawing?.roundId ?? '',
        artistId: drawing?.artistId ?? '',
        artistName: artist?.name ?? 'somebody',
        imageUrl: images(match?.drawingIndex ?? 0),
        guessesIn: Object.keys(drawing?.guesses ?? {}).length,
        guessersTotal: guessers.length,
        drawingIndex: (match?.drawingIndex ?? 0) + 1,
        drawingTotal: match?.drawings.length ?? 0,
        deadline,
      };
    }

    case 'DRAWING_VOTE': {
      const artist = drawing === undefined ? undefined : findPlayer(state, drawing.artistId);
      const voters = eligiblePlayers(state, now).filter((p) => p.id !== drawing?.artistId);
      return {
        phase: 'DRAWING_VOTE',
        roundId: drawing?.roundId ?? '',
        artistId: drawing?.artistId ?? '',
        artistName: artist?.name ?? 'somebody',
        imageUrl: images(match?.drawingIndex ?? 0),
        options: (drawing?.options ?? []).map((o) => ({ id: o.id, text: o.text })),
        votesIn: Object.keys(drawing?.votes ?? {}).length,
        votersTotal: voters.length,
        drawingIndex: (match?.drawingIndex ?? 0) + 1,
        drawingTotal: match?.drawings.length ?? 0,
        deadline,
      };
    }

    case 'DRAWING_RESULTS': {
      const artist = drawing === undefined ? undefined : findPlayer(state, drawing.artistId);
      const outcome = drawing?.resolved ?? null;
      const votersByOption = new Map<string, string[]>();
      for (const [voterId, optionId] of Object.entries(drawing?.votes ?? {})) {
        const list = votersByOption.get(optionId);
        if (list === undefined) votersByOption.set(optionId, [voterId]);
        else list.push(voterId);
      }
      return {
        phase: 'DRAWING_RESULTS',
        artistId: drawing?.artistId ?? '',
        artistName: artist?.name ?? 'somebody',
        artistAvatarId: artist?.avatarId ?? '',
        imageUrl: images(match?.drawingIndex ?? 0),
        options: (drawing?.options ?? []).map((option) => {
          const author = option.authorId === null ? undefined : findPlayer(state, option.authorId);
          return {
            id: option.id,
            text: option.text,
            isReal: option.isReal,
            authorId: option.authorId,
            authorName: option.isReal ? 'THE REAL PROMPT' : (author?.name ?? 'somebody'),
            voterIds: votersByOption.get(option.id) ?? [],
          };
        }),
        realOptionId: outcome?.realOptionId ?? '',
        perfect: outcome?.perfect ?? false,
        deltas: buildDeltas(state, outcome?.events ?? []),
        leaderboard: buildLeaderboard(state, outcome?.events ?? []),
        drawingIndex: (match?.drawingIndex ?? 0) + 1,
        drawingTotal: match?.drawings.length ?? 0,
        deadline,
      };
    }

    case 'FINAL_RESULTS':
      return {
        phase: 'FINAL_RESULTS',
        leaderboard: buildLeaderboard(state),
        awards: computeMatchAwards(state),
        highlights: buildHighlightReel(state, images),
        stories: match === null ? [] : renderMatchStories(match, { revealAll: true }),
        deadline: null,
      };
  }
}

/* ------------------------------------------------------------------ *
 * Per-device private payloads
 * ------------------------------------------------------------------ */

/**
 * Everything this one device may know that nobody else may. Returns `null` when the
 * current phase has nothing private for this player, so no message is sent at all.
 */
export function buildPrivate(state: RoomState, player: ServerPlayer): PrivateMessage | null {
  const matchup = currentMatchup(state);
  const drawing = currentDrawing(state);
  const payload: PrivateMessage = { t: 'private' };
  let hasContent = false;

  if (
    matchup !== undefined &&
    (state.phase === 'ROUND_PROMPT' || state.phase === 'ROUND_WAITING') &&
    matchup.competitorIds.includes(player.id)
  ) {
    const slot = slotFor(matchup.storyId, matchup.slotId);
    if (slot !== undefined) {
      const mine = matchup.answers.find((a) => a.authorId === player.id && !a.isFallback);
      payload.prompt = {
        roundId: matchup.roundId,
        text: slot.disguisedPrompt,
        hint: slot.hint ?? null,
        charLimit: slot.charLimit,
        submitted: mine?.text ?? null,
      };
      hasContent = true;
    }
  }

  if (matchup !== undefined && (state.phase === 'ROUND_REVEAL' || state.phase === 'ROUND_VOTE')) {
    const mine = matchup.answers.find((a) => a.authorId === player.id);
    if (mine !== undefined) {
      payload.myAnswerId = mine.id;
      hasContent = true;
    }
    if (state.phase === 'ROUND_VOTE' && matchup.voterIds.includes(player.id)) {
      // Server-side exclusion of the player's own answer. The UI also hides it, but
      // this is what makes a hand-crafted socket message pointless.
      payload.votableAnswers = matchup.answers
        .filter((a) => a.authorId !== player.id)
        .map((a) => ({ id: a.id, text: a.text }));
      const existing = matchup.votes[player.id];
      if (existing !== undefined) payload.myVote = existing;
      hasContent = true;
    }
  }

  if (drawing !== undefined && drawing.artistId === player.id) {
    if (state.phase === 'DRAWING_SETUP' || state.phase === 'DRAWING_ACTIVE') {
      payload.drawingPrompt = {
        roundId: drawing.roundId,
        subject: drawing.subject,
        context: drawing.context,
        submitted: drawing.hasImage,
      };
      hasContent = true;
    }
  }

  if (drawing !== undefined && drawing.artistId !== player.id) {
    if (state.phase === 'DRAWING_GUESS') {
      const mine = drawing.guesses[player.id];
      if (mine !== undefined) payload.myDrawingGuess = mine;
      hasContent = true;
    }
    if (state.phase === 'DRAWING_VOTE') {
      payload.votableDrawingOptions = drawing.options
        .filter((o) => o.authorId !== player.id)
        .map((o) => ({ id: o.id, text: o.text }));
      const existing = drawing.votes[player.id];
      if (existing !== undefined) payload.myDrawingVote = existing;
      hasContent = true;
    }
  }

  return hasContent ? payload : null;
}

export { toPublicPlayer };
