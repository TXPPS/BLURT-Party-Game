/**
 * BLURT — authoritative room state.
 *
 * This is the server's private picture of a room. It is a superset of what any
 * client ever sees: tokens, author identities before a vote resolves, raw votes,
 * and the story template all live here and are projected down by `views.ts`.
 *
 * The whole structure is JSON-serialisable because it is persisted to Durable
 * Object storage on every mutation. That is what makes WebSocket hibernation safe:
 * the object can be evicted mid-match and rebuilt from storage without the room
 * noticing. The one exception is drawing images, which exceed the 128 KiB
 * per-value storage limit and are chunked separately (see `drawingStore.ts`).
 */

import type { GameSettings, Phase, PlayerStats } from '../../shared/types.js';
import type { ScoreEvent } from '../../shared/scoring.js';
import type { SlotAssignment } from '../../shared/storyEngine.js';

/** Bumped when the persisted shape changes incompatibly; older state is discarded. */
export const ROOM_STATE_VERSION = 1;

export interface ServerPlayer {
  id: string;
  /** Reconnect secret. Never leaves the server. */
  token: string;
  name: string;
  avatarId: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  /** False until the player has chosen a name and avatar. */
  identified: boolean;
  /** Epoch ms of the disconnect that started the grace window, or null. */
  disconnectedAt: number | null;
  joinedAt: number;
  score: number;
  stats: PlayerStats;
  /** This device passed the 18+ gate. Per player, per session. */
  adultAcknowledged: boolean;
  /** Removed by the host. Kept so a kicked token cannot walk back in. */
  kicked: boolean;
  /** True once the grace window lapsed — stays on the scoreboard as DISCONNECTED. */
  departed: boolean;
  /**
   * A QA stand-in, added through the gated QA routes rather than by joining.
   *
   * Bots have no socket. They are auto-played server-side through the same submission
   * functions a real player goes through, so a QA room still exercises the real
   * scoring and matchmaking rather than a parallel implementation.
   */
  isBot: boolean;
}

export interface AnswerRecord {
  id: string;
  /** Null for THE HOUSE. */
  authorId: string | null;
  text: string;
  /** The house wrote this because the player ran out of time. */
  isFallback: boolean;
}

export interface MatchupRecord {
  index: number;
  /** Opaque per-matchup id; every submission must carry the matching one. */
  roundId: string;
  storyId: string;
  slotId: string;
  competitorIds: string[];
  voterIds: string[];
  answers: AnswerRecord[];
  /** voterId → answerId. */
  votes: Record<string, string>;
  resolved: MatchupOutcome | null;
}

export interface MatchupOutcome {
  winningAnswerId: string | null;
  tiedAnswerIds: string[];
  wasCoinFlip: boolean;
  wasCleanSweep: boolean;
  nobodyVoted: boolean;
  voteCounts: Record<string, number>;
  events: ScoreEvent[];
}

export interface DrawingOptionRecord {
  id: string;
  text: string;
  /** Null for the real prompt. */
  authorId: string | null;
  isReal: boolean;
}

export interface DrawingRecord {
  index: number;
  roundId: string;
  artistId: string;
  /** The player-written phrase the artist must draw. */
  subject: string;
  /** The story clause it came from, shown to the artist for flavour. */
  context: string;
  storyId: string;
  slotId: string;
  /** True once the artist's PNG has been stored (the bytes live outside this record). */
  hasImage: boolean;
  /** playerId → decoy text. */
  guesses: Record<string, string>;
  /** Built when DRAWING_VOTE opens: the real prompt shuffled in with every decoy. */
  options: DrawingOptionRecord[];
  /** voterId → optionId. */
  votes: Record<string, string>;
  resolved: DrawingOutcome | null;
}

export interface DrawingOutcome {
  realOptionId: string;
  voteCounts: Record<string, number>;
  correctVoterIds: string[];
  fooledCounts: Record<string, number>;
  perfect: boolean;
  events: ScoreEvent[];
}

/** One slot filled in the story, with attribution. */
export interface FillRecord {
  storyId: string;
  slotId: string;
  text: string;
  authorId: string | null;
  authorName: string;
  authorAvatarId: string | null;
  matchupIndex: number;
}

export interface MatchState {
  /** Stories this match plays, in order. More than one for a long match. */
  storyIds: string[];
  plan: SlotAssignment[];
  /** Index into `plan` of the matchup in progress. */
  matchupIndex: number;
  matchups: MatchupRecord[];
  /** Keyed `storyId::slotId` — slot ids are only unique within a story. */
  fills: Record<string, FillRecord>;
  /** Matchup index the last STORY_UPDATE covered up to, for the "fresh" highlight. */
  storyUpdatedThrough: number;
  /** True once the first STORY_UPDATE has run — gates revealing the story title. */
  titleRevealed: boolean;
  drawings: DrawingRecord[];
  /**
   * Indices into `drawings` that the room will actually sit through, chosen once
   * DRAWING_ACTIVE ends and we know who submitted. Everybody draws; only these are
   * guessed, voted on and scored. Empty until the showcase is picked.
   */
  showcase: number[];
  /** Position within `showcase`, not within `drawings`. */
  drawingIndex: number;
  /**
   * What the artists who were never shown were paid.
   *
   * Kept so the payment can be *displayed* as well as applied: it is minted on the
   * last showcase screen, alongside the line explaining why, so nobody's score moves
   * without a visible reason.
   */
  unshownEvents: ScoreEvent[];
  /** Decided when the standard rounds end, from the settings and available prompts. */
  finalePlanned: boolean;
  /** Every point ever minted this match, for independent recomputation. */
  scoreLog: ScoreEvent[];
  startedAt: number;
}

export type TimerId = 'phase' | 'hostMigration' | 'grace' | 'roomExpiry' | 'idleExpiry';

export interface RoomState {
  version: number;
  code: string;
  createdAt: number;
  phase: Phase;
  settings: GameSettings;
  hostId: string | null;
  /** Epoch ms when the host went missing; drives the migration countdown. */
  hostMissingSince: number | null;
  players: ServerPlayer[];
  /** Named deadlines. The DO alarm is always set to the earliest of these. */
  timers: Partial<Record<TimerId, number>>;
  match: MatchState | null;
  /** Story ids played recently, so a repeat match picks something else. */
  recentStoryIds: string[];
  /** Monotonic counter behind every generated answer/round/option id. */
  seq: number;
  /** Phase deadline duration, so the client can draw a correctly-proportioned ring. */
  phaseDurationMs: number;
  /**
   * Players who have pressed READY on the current watching phase.
   *
   * Cleared on every phase entry, which is why it cannot reuse `player.ready` — that
   * one is lobby readiness and is meant to persist. A phase ends early only when
   * *everyone* present is in here; one impatient person cannot skip a reveal for the
   * room, and the phase deadline is still the backstop that guarantees it ends.
   */
  readyToAdvance: string[];
  /** Set when the room has been destroyed and should refuse everything. */
  closed: boolean;
}

/** Where a phase handler can push side effects without touching sockets directly. */
export interface PhaseEffects {
  /** Broadcast a dramatic sound cue to every device that plays them. */
  sfx(eventId: string): void;
  /** Show a transient message to everyone. */
  toast(kind: 'info' | 'good' | 'bad' | 'host', message: string): void;
}

export interface PhaseContext {
  state: RoomState;
  now: number;
  effects: PhaseEffects;
  /** Request a transition. The dispatcher validates it against the FSM edge table. */
  goTo(phase: Phase): void;
}

/** Every phase implements this. The dispatcher never special-cases a phase. */
export interface PhaseHandler {
  /** Set up state and the phase deadline. Runs exactly once on entry. */
  onEnter(ctx: PhaseContext): void;
  /** The phase deadline elapsed. Must always leave the room in a playable state. */
  onTimeout(ctx: PhaseContext): void;
  /** True when every required input is in and the phase can advance early. */
  isComplete(ctx: PhaseContext): boolean;
  /** True when the host's ADVANCE button applies here. */
  hostCanAdvance?: boolean;
  /**
   * Somebody connected or disconnected. Phases that can end up blocked on a single
   * absent person use this to shorten their own deadline rather than making the
   * room wait out a timer for somebody who is not coming back.
   */
  onPresenceChange?(ctx: PhaseContext): void;
}
