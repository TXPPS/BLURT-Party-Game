/**
 * BLURT — the public view model.
 *
 * The server computes exactly what a screen needs and sends it. The client renders
 * it. That split is what makes "the client never computes scores, winners, matchups
 * or phase transitions" enforceable rather than aspirational: there is simply no
 * data on the client from which a winner could be derived early.
 *
 * Redaction rules that this file encodes structurally:
 *   • `RevealAnswer` has no `authorId` field at all, so a reveal or vote payload
 *     *cannot* leak authorship — the type would not compile.
 *   • Authorship only appears in `ResultAnswer`, which is only ever sent from
 *     ROUND_RESULTS onward, i.e. after the vote has resolved.
 */

import type {
  Award,
  HighlightReel,
  Phase,
  PublicPlayer,
  RenderedStory,
} from './types.js';

/**
 * A server deadline. The client renders the countdown locally from `endsAt` and the
 * clock offset it measured at `hello`, so no timer traffic is ever sent.
 */
export interface Deadline {
  /** Epoch milliseconds, on the server's clock. */
  endsAt: number;
  /** How long the phase started with, for drawing the ring. */
  durationMs: number;
}

/** An answer during reveal/vote. Deliberately anonymous — there is no author field. */
export interface RevealAnswer {
  id: string;
  text: string;
}

/** An answer after the vote has resolved. Authorship is now safe to send. */
export interface ResultAnswer {
  id: string;
  text: string;
  votes: number;
  /** Null for THE HOUSE. */
  authorId: string | null;
  authorName: string;
  authorAvatarId: string | null;
  /** True when the house wrote this because the player ran out of time. */
  isFallback: boolean;
  isWinner: boolean;
  /** Ids of the players who voted for this answer, revealed only now. */
  voterIds: string[];
}

export interface ScoreDelta {
  playerId: string;
  points: number;
  reason: string;
  label: string;
}

export interface LeaderboardRow {
  playerId: string;
  name: string;
  avatarId: string;
  score: number;
  rank: number;
  connected: boolean;
  /** Points gained in the most recent scoring event, for the count-up animation. */
  delta: number;
}

export interface DrawingOptionView {
  id: string;
  text: string;
}

export interface DrawingResultOption {
  id: string;
  text: string;
  isReal: boolean;
  authorId: string | null;
  authorName: string;
  voterIds: string[];
}

/* ------------------------------------------------------------------ *
 * The view union — one member per phase
 * ------------------------------------------------------------------ */

export interface LobbyView {
  phase: 'LOBBY';
  joinUrl: string;
  canStart: boolean;
  /** Why START is disabled, in words a player can act on. Null when it is enabled. */
  blockReason: string | null;
  /** True once at least one player has acknowledged the 18+ gate this session. */
  crudeAcknowledged: boolean;
}

export interface GameSetupView {
  phase: 'GAME_SETUP';
  /**
   * Null until the first STORY_UPDATE. The whole hook is that players do not know
   * what their answers are being poured into, and a title on the setup screen gives
   * the entire game away before the first round is scored.
   */
  storyTitle: string | null;
  genre: string | null;
  totalRounds: number;
  deadline: Deadline;
}

export interface RoundPromptView {
  phase: 'ROUND_PROMPT';
  /**
   * Opaque token for this matchup. Every submission carries it back so a message
   * written for a round that has already moved on is rejected instead of applied.
   * It is public because *voters* need it too, and it reveals nothing.
   */
  roundId: string;
  roundNumber: number;
  totalRounds: number;
  /** The disguised prompt. Shared by everyone in this matchup, so it is public. */
  prompt: string;
  hint: string | null;
  charLimit: number;
  competitorIds: string[];
  submittedIds: string[];
  deadline: Deadline;
}

export interface RoundWaitingView {
  phase: 'ROUND_WAITING';
  roundNumber: number;
  totalRounds: number;
  competitorIds: string[];
  deadline: Deadline;
}

export interface RoundRevealView {
  phase: 'ROUND_REVEAL';
  roundNumber: number;
  totalRounds: number;
  prompt: string;
  answers: RevealAnswer[];
  deadline: Deadline;
}

export interface RoundVoteView {
  phase: 'ROUND_VOTE';
  roundId: string;
  roundNumber: number;
  totalRounds: number;
  prompt: string;
  answers: RevealAnswer[];
  /** Count only. Who voted for what is never public before the vote resolves. */
  votesIn: number;
  votersTotal: number;
  deadline: Deadline;
}

export interface RoundResultsView {
  phase: 'ROUND_RESULTS';
  roundNumber: number;
  totalRounds: number;
  prompt: string;
  answers: ResultAnswer[];
  winningAnswerId: string | null;
  wasCoinFlip: boolean;
  wasCleanSweep: boolean;
  /** Set when nobody voted at all and the universe had to decide. */
  nobodyVoted: boolean;
  deltas: ScoreDelta[];
  leaderboard: LeaderboardRow[];
  deadline: Deadline;
}

export interface StoryUpdateView {
  phase: 'STORY_UPDATE';
  /** More than one once a long match has continued into a second story. */
  stories: RenderedStory[];
  /** Slots inserted since the previous update — the ones that get stamped in. */
  freshSlotIds: string[];
  roundNumber: number;
  totalRounds: number;
  deadline: Deadline;
}

export interface FinalStoryView {
  phase: 'FINAL_STORY';
  /** More than one when the match ran longer than a single story's slots. */
  stories: RenderedStory[];
  lineDelayMs: number;
  deadline: Deadline;
}

/**
 * The one-time card that opens the finale.
 *
 * There is no single artist any more — everybody selected draws at once — so this
 * announces the whole set rather than one person's turn.
 */
export interface DrawingSetupView {
  phase: 'DRAWING_SETUP';
  /** Names of everybody who has been picked to draw, in showcase order. */
  artistNames: string[];
  artistTotal: number;
  deadline: Deadline;
}

export interface DrawingActiveView {
  phase: 'DRAWING_ACTIVE';
  /** Names of everybody drawing right now. */
  artistNames: string[];
  artistTotal: number;
  /**
   * How many drawings are in. Drives the "3 of 4 have submitted" counter, which is
   * the whole reason a non-artist has anything to look at during this phase.
   */
  submittedCount: number;
  /** Names of the artists still working, so the wait has faces on it. */
  pendingArtistNames: string[];
  deadline: Deadline;
}

// NOTE: whether *this* device has submitted is not here on purpose. It is per-player,
// so it travels in the private payload (`drawingPrompt.submitted`) rather than in a
// view every device receives identically.

export interface DrawingGuessView {
  phase: 'DRAWING_GUESS';
  roundId: string;
  artistId: string;
  artistName: string;
  /**
   * An HTTP URL, not a data URL.
   *
   * A drawing is up to 200 KB. Inlining it in the view means re-sending it to every
   * socket on every broadcast — ten players voting one at a time would push several
   * megabytes through the WebSocket for one picture. As a URL the browser fetches it
   * once and caches it, and the socket carries a few dozen bytes.
   */
  imageUrl: string;
  guessesIn: number;
  guessersTotal: number;
  drawingIndex: number;
  drawingTotal: number;
  deadline: Deadline;
}

export interface DrawingVoteView {
  phase: 'DRAWING_VOTE';
  roundId: string;
  artistId: string;
  artistName: string;
  imageUrl: string;
  options: DrawingOptionView[];
  votesIn: number;
  votersTotal: number;
  drawingIndex: number;
  drawingTotal: number;
  deadline: Deadline;
}

export interface DrawingResultsView {
  phase: 'DRAWING_RESULTS';
  artistId: string;
  artistName: string;
  artistAvatarId: string;
  imageUrl: string;
  options: DrawingResultOption[];
  realOptionId: string;
  perfect: boolean;
  deltas: ScoreDelta[];
  leaderboard: LeaderboardRow[];
  drawingIndex: number;
  drawingTotal: number;
  deadline: Deadline;
}

export interface FinalResultsView {
  phase: 'FINAL_RESULTS';
  leaderboard: LeaderboardRow[];
  awards: Award[];
  highlights: HighlightReel;
  stories: RenderedStory[];
  deadline: null;
}

export type PublicView =
  | LobbyView
  | GameSetupView
  | RoundPromptView
  | RoundWaitingView
  | RoundRevealView
  | RoundVoteView
  | RoundResultsView
  | StoryUpdateView
  | FinalStoryView
  | DrawingSetupView
  | DrawingActiveView
  | DrawingGuessView
  | DrawingVoteView
  | DrawingResultsView
  | FinalResultsView;

/** Compile-time proof that every phase has exactly one view. */
export type ViewForPhase<P extends Phase> = Extract<PublicView, { phase: P }>;
type _EveryPhaseHasAView = {
  [P in Phase]: ViewForPhase<P> extends never ? ['missing view for phase', P] : true;
};
export type AssertViewCoverage = _EveryPhaseHasAView;

/**
 * Everything a single device needs about *itself*.
 *
 * Note what is absent: whether this device is showing the big-screen layout. That
 * is a per-device preference the client owns, not room state — the same player can
 * flip between the group view and their controls without the server caring.
 */
export interface SelfView {
  playerId: string;
  isHost: boolean;
  role: import('./types.js').PlayerRole;
  score: number;
  /** True while this device still needs to pass the 18+ gate. */
  needsAdultGate: boolean;
}

export type { PublicPlayer };
