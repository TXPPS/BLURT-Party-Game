/**
 * BLURT — domain types shared by the client and the server.
 *
 * Nothing here touches the DOM or a Workers global. These are the nouns of the
 * game; `protocol.ts` describes how they travel over the wire.
 */

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

export type GameMode = 'classic' | 'crude';
export type TimerSpeed = 'fast' | 'normal' | 'relaxed';

export interface RoundPreset {
  readonly id: 'quick' | 'standard' | 'long';
  readonly label: string;
  readonly rounds: number;
  readonly blurb: string;
}

export interface GameSettings {
  mode: GameMode;
  /** 1–15. */
  rounds: number;
  timerSpeed: TimerSpeed;
  drawingFinale: boolean;
}

/* ------------------------------------------------------------------ *
 * Finite state machine
 * ------------------------------------------------------------------ */

export const PHASES = [
  'LOBBY',
  'GAME_SETUP',
  'ROUND_PROMPT',
  'ROUND_WAITING',
  'ROUND_REVEAL',
  'ROUND_VOTE',
  'ROUND_RESULTS',
  'STORY_UPDATE',
  'FINAL_STORY',
  'DRAWING_SETUP',
  'DRAWING_ACTIVE',
  'DRAWING_GUESS',
  'DRAWING_VOTE',
  'DRAWING_RESULTS',
  'FINAL_RESULTS',
] as const;

export type Phase = (typeof PHASES)[number];

/**
 * Every legal edge of the machine. The dispatcher refuses any transition that is
 * not listed here, which makes an illegal transition a loud server error rather
 * than a quietly corrupted room.
 */
export const LEGAL_TRANSITIONS: Readonly<Record<Phase, readonly Phase[]>> = {
  LOBBY: ['GAME_SETUP'],
  GAME_SETUP: ['ROUND_PROMPT', 'LOBBY'],
  ROUND_PROMPT: ['ROUND_WAITING', 'LOBBY'],
  ROUND_WAITING: ['ROUND_REVEAL', 'LOBBY'],
  ROUND_REVEAL: ['ROUND_VOTE', 'LOBBY'],
  ROUND_VOTE: ['ROUND_RESULTS', 'LOBBY'],
  ROUND_RESULTS: ['STORY_UPDATE', 'ROUND_PROMPT', 'FINAL_STORY', 'LOBBY'],
  STORY_UPDATE: ['ROUND_PROMPT', 'FINAL_STORY', 'LOBBY'],
  FINAL_STORY: ['DRAWING_SETUP', 'FINAL_RESULTS', 'LOBBY'],
  DRAWING_SETUP: ['DRAWING_ACTIVE', 'LOBBY'],
  DRAWING_ACTIVE: ['DRAWING_GUESS', 'FINAL_RESULTS', 'LOBBY'],
  DRAWING_GUESS: ['DRAWING_VOTE', 'FINAL_RESULTS', 'LOBBY'],
  DRAWING_VOTE: ['DRAWING_RESULTS', 'LOBBY'],
  DRAWING_RESULTS: ['DRAWING_SETUP', 'FINAL_RESULTS', 'LOBBY'],
  FINAL_RESULTS: ['LOBBY', 'GAME_SETUP'],
};

export function isLegalTransition(from: Phase, to: Phase): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

/**
 * What this device is being asked to do right now. Drives client screen routing.
 *
 * All of these except `HOST_DISPLAY` are assigned by the server from the current
 * phase. `HOST_DISPLAY` is decided *by the device*: showing the shared big-screen
 * layout is a local preference (see `DevicePrefs.bigScreen`), which is what lets the
 * same player flip between the group view and their own controls without the room
 * needing to know or care.
 */
export type PlayerRole =
  | 'HOST_DISPLAY'
  | 'COMPETITOR'
  | 'VOTER'
  | 'ARTIST'
  | 'GUESSER'
  | 'SPECTATOR_OF_ROUND';

/* ------------------------------------------------------------------ *
 * Players
 * ------------------------------------------------------------------ */

export interface PlayerStats {
  /** Times selected as a competitor in a standard round. */
  appearances: number;
  /** Matchups won outright or shared. */
  wins: number;
  votesReceived: number;
  votesCast: number;
  /** Decoy prompts written during the drawing finale. */
  decoysPlanted: number;
  /** People who picked this player's decoy as the real prompt. */
  playersFooled: number;
  /** Times this player picked the real prompt. */
  correctGuesses: number;
  /** Across this player's own drawings, how many people identified the real prompt. */
  drawingsIdentified: number;
  drawingsMade: number;
  /** Matchups won with every available vote (needs ≥2 voters). */
  cleanSweeps: number;
  /** Times the house answered on this player's behalf because they timed out. */
  fallbackFills: number;
  /** Votes received on slots the content marks as dark/unhinged. */
  darkVotesReceived: number;
  /** Character count of the longest answer this player actually won with. */
  longestWinningAnswer: number;
  /** 2-player mode: matchups lost to THE HOUSE. */
  houseLosses: number;
}

export function emptyStats(): PlayerStats {
  return {
    appearances: 0,
    wins: 0,
    votesReceived: 0,
    votesCast: 0,
    decoysPlanted: 0,
    playersFooled: 0,
    correctGuesses: 0,
    drawingsIdentified: 0,
    drawingsMade: 0,
    cleanSweeps: 0,
    fallbackFills: 0,
    darkVotesReceived: 0,
    longestWinningAnswer: 0,
    houseLosses: 0,
  };
}

/** The public shape of a player. `token` is deliberately absent — it never leaves the server. */
export interface PublicPlayer {
  id: string;
  name: string;
  avatarId: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  /** Set while a player is inside their disconnect grace window. */
  reconnectingUntil: number | null;
  identified: boolean;
  score: number;
  stats: PlayerStats;
}

/** Public room facts every client may know at any time. */
export interface PublicRoom {
  code: string;
  settings: GameSettings;
  hostId: string | null;
  /** Set while the host is missing and authority is about to migrate. */
  hostMigratesAt: number | null;
  /** 1-based index of the standard round in progress; 0 before the first. */
  roundNumber: number;
  totalRounds: number;
  createdAt: number;
  expiresAt: number;
  storyTitle: string | null;
}

/* ------------------------------------------------------------------ *
 * Story rendering
 * ------------------------------------------------------------------ */

export type RevealAnimation = 'typewriter' | 'stamp' | 'slam';

/** One rendered story line, chopped into static text and inserted answers. */
export interface RenderedLine {
  sectionId: string;
  lineId: string;
  segments: RenderedSegment[];
}

export type RenderedSegment =
  | { kind: 'text'; text: string }
  | {
      kind: 'fill';
      text: string;
      slotId: string;
      /** Null when the house filled the slot (nobody submitted, or 2-player house win). */
      authorId: string | null;
      authorName: string;
      authorAvatarId: string | null;
      /** True for slots inserted since the last story update — used for emphasis. */
      fresh: boolean;
    };

export interface RenderedSection {
  id: string;
  lines: RenderedLine[];
  revealAnimation: RevealAnimation;
  audioCue: string | null;
  /** False until at least one of this section's slots has been filled by play. */
  unlocked: boolean;
}

export interface RenderedStory {
  storyId: string;
  title: string;
  genre: string;
  sections: RenderedSection[];
}

/* ------------------------------------------------------------------ *
 * Awards
 * ------------------------------------------------------------------ */

export interface Award {
  id: string;
  title: string;
  blurb: string;
  /** Null when nobody qualified — the UI shows the documented fallback line instead. */
  winnerId: string | null;
  winnerName: string;
  winnerAvatarId: string | null;
  /** Human-readable evidence, e.g. "9 votes". Never blank. */
  detail: string;
}

export interface HighlightAnswer {
  text: string;
  authorId: string | null;
  authorName: string;
  authorAvatarId: string | null;
  votes: number;
  promptLabel: string;
}

export interface HighlightReel {
  topAnswers: HighlightAnswer[];
  funniestDrawing: {
    artistId: string;
    artistName: string;
    artistAvatarId: string;
    imageUrl: string;
    decoyVotesAttracted: number;
  } | null;
  bestStoryLine: {
    text: string;
    authorName: string;
    votes: number;
  } | null;
}
