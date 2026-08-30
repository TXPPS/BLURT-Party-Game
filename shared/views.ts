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
  storyTitle: string;
  genre: string;
  totalRounds: number;
  deadline: Deadline;
}

export interface RoundPromptView {
  phase: 'ROUND_PROMPT';
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
  story: RenderedStory;
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

export interface DrawingSetupView {
  phase: 'DRAWING_SETUP';
  artistId: string;
  artistName: string;
  drawingIndex: number;
  drawingTotal: number;
  deadline: Deadline;
}

export interface DrawingActiveView {
  phase: 'DRAWING_ACTIVE';
  artistId: string;
  artistName: string;
  drawingIndex: number;
  drawingTotal: number;
  submitted: boolean;
  deadline: Deadline;
}

export interface DrawingGuessView {
  phase: 'DRAWING_GUESS';
  artistId: string;
  artistName: string;
  imageDataUrl: string;
  guessesIn: number;
  guessersTotal: number;
  drawingIndex: number;
  drawingTotal: number;
  deadline: Deadline;
}

export interface DrawingVoteView {
  phase: 'DRAWING_VOTE';
  artistId: string;
  artistName: string;
  imageDataUrl: string;
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
  imageDataUrl: string;
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

/** Everything a single device needs about *itself*. */
export interface SelfView {
  playerId: string;
  isHost: boolean;
  role: import('./types.js').PlayerRole;
  score: number;
  /** True when this device is showing the shared "big screen" layout. */
  hostDisplay: boolean;
}

export type { PublicPlayer };
