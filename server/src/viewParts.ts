/**
 * BLURT — the projections that carry no secrets.
 *
 * Deadlines, the public room record, the leaderboard, score deltas and a player's own
 * self view. None of this is redacted, because none of it is private: every field here
 * is something the whole room may see. It lives apart from `views.ts` so that file is
 * only ever about the redaction boundary.
 */

import { SCORE_REASON_LABELS, type ScoreEvent } from '../../shared/scoring.js';
import type { PlayerRole, PublicRoom } from '../../shared/types.js';
import type { Deadline, LeaderboardRow, ScoreDelta, SelfView } from '../../shared/views.js';
import {
  advanceReadyCount,
  findPlayer,
  roomExpiresAt,
} from './roomState.js';
import { currentDrawingRecord, drawingForArtist } from './finale.js';
import { SKIPPABLE_PHASES } from './phases/index.js';
import { storyById } from './story.js';
import type { MatchupRecord, RoomState, ServerPlayer } from './types.js';

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

/**
 * The drawing the showcase is on.
 *
 * Re-exported rather than reimplemented: there used to be a second copy of this here
 * that indexed `drawings` directly. The moment `drawingIndex` started walking the
 * showcase instead, the two disagreed — views and private payloads pointed at a
 * different picture than the one being scored, and guessers were shown options for a
 * drawing nobody was voting on. One definition, in `finale.ts`.
 */
export { currentDrawingRecord as currentDrawing };

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
  const drawing = currentDrawingRecord(state);

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
      // Every artist draws at once, so this is "am I *an* artist", not "am I the
      // one whose turn it is" — the showcase pointer means nothing yet.
      return drawingForArtist(state, player.id) !== undefined ? 'ARTIST' : 'SPECTATOR_OF_ROUND';
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
  const skip = advanceReadyCount(state);
  return {
    playerId: player.id,
    isHost: state.hostId === player.id,
    role: roleFor(state, player),
    score: player.score,
    needsAdultGate: state.settings.mode === 'crude' && !player.adultAcknowledged,
    skipOffered: (SKIPPABLE_PHASES as readonly string[]).includes(state.phase),
    skipReady: state.readyToAdvance.includes(player.id),
    skipReadyCount: skip.ready,
    skipTotal: skip.total,
  };
}
