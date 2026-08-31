/**
 * BLURT — tunable constants.
 *
 * Zero magic numbers live anywhere else in the codebase. If a number matters,
 * it is named here (or in `scoring.ts`) with a comment explaining *why* it has
 * the value it has. Both the client and the server import from this module, so
 * the two can never drift out of sync.
 */

import type { RoundPreset, TimerSpeed } from './types.js';

/* ------------------------------------------------------------------ *
 * Protocol
 * ------------------------------------------------------------------ */

/** Bumped on any breaking change to the wire format. Mismatched clients are refused. */
export const PROTOCOL_VERSION = 1;

/** Hard ceiling on a single inbound frame. Anything larger is dropped before parsing. */
export const MESSAGE_MAX_BYTES = 256 * 1024;

/** Broadcasts inside this window are coalesced into one. Keeps 10-player rooms quiet. */
export const BROADCAST_COALESCE_MS = 50;

/** Client heartbeat interval. The server answers `pong`; it never polls the client. */
export const PING_INTERVAL_MS = 20_000;

/* ------------------------------------------------------------------ *
 * Rooms
 * ------------------------------------------------------------------ */

export const ROOM_CODE_LENGTH = 4;

/** Attempts to find an unused word code before falling back to a random letter code. */
export const ROOM_CODE_MAX_ATTEMPTS = 8;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;

/** Extra sockets allowed for shared "big screen" displays that are not players. */
export const MAX_HOST_DISPLAYS = 2;
export const MAX_CONNECTIONS_PER_ROOM = MAX_PLAYERS + MAX_HOST_DISPLAYS;

/** A room is destroyed this long after creation no matter what. */
export const ROOM_MAX_LIFETIME_MS = 4 * 60 * 60 * 1000; // 4 hours

/** A room with zero connected sockets is destroyed after this long. */
export const ROOM_IDLE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/** A disconnected player keeps their seat, score and stats for this long. */
export const DISCONNECT_GRACE_MS = 90_000;

/** How long a missing host holds authority before it migrates to someone present. */
export const HOST_MIGRATION_DELAY_MS = 60_000;

/**
 * How long the room waits on somebody who has gone offline and is the *only* thing
 * a phase is waiting for.
 *
 * The 90-second grace window is about keeping a seat and a score; it is far too long
 * to make nine other people watch a canvas nobody is drawing on. When a disconnect
 * leaves a phase blocked on one absent person, its deadline is shortened to this.
 */
export const ABANDONED_PHASE_MS = 22_000;

/** How many previously-played story ids a room remembers, to avoid repeats. */
export const RECENT_STORY_MEMORY = 4;

/* ------------------------------------------------------------------ *
 * Input limits (mirrored by the sanitizer and by every server validator)
 * ------------------------------------------------------------------ */

export const NAME_MAX_LENGTH = 20;
export const ANSWER_MAX_LENGTH = 160;
export const DRAWING_GUESS_MAX_LENGTH = 100;

/** Rasterised PNG data-URL ceiling. Larger submissions are rejected with a toast. */
export const DRAWING_PAYLOAD_MAX_BYTES = 200 * 1024;

/** Durable Object storage caps a value at 128 KiB, so drawings are chunked below that. */
export const DRAWING_STORAGE_CHUNK_BYTES = 96 * 1024;

/** Logical canvas size everything is rasterised to before transport. */
export const DRAWING_CANVAS_WIDTH = 800;
export const DRAWING_CANVAS_HEIGHT = 600;

/** Undo depth on the drawing canvas. */
export const DRAWING_UNDO_LIMIT = 32;

/* ------------------------------------------------------------------ *
 * Rate limiting (per socket)
 * ------------------------------------------------------------------ */

/** Token bucket: capacity (burst) and refill rate (sustained messages per second). */
export const RATE_LIMIT_BURST = 20;
export const RATE_LIMIT_SUSTAINED_PER_SEC = 5;

/** Consecutive rate-limit violations tolerated before the socket is closed. */
export const RATE_LIMIT_STRIKES = 3;

/* ------------------------------------------------------------------ *
 * Match settings
 * ------------------------------------------------------------------ */

export const ROUNDS_MIN = 1;
export const ROUNDS_MAX = 15;
export const ROUNDS_DEFAULT = 5;

export const ROUND_PRESETS: readonly RoundPreset[] = [
  { id: 'quick', label: 'QUICK', rounds: 3, blurb: 'One drink' },
  { id: 'standard', label: 'STANDARD', rounds: 5, blurb: 'The good one' },
  { id: 'long', label: 'LONG', rounds: 8, blurb: 'Commitment' },
] as const;

/** Answer / vote deadlines per speed setting, in milliseconds. */
export const TIMER_PRESETS: Readonly<
  Record<TimerSpeed, { readonly label: string; readonly answerMs: number; readonly voteMs: number }>
> = {
  fast: { label: 'FAST', answerMs: 45_000, voteMs: 20_000 },
  normal: { label: 'NORMAL', answerMs: 75_000, voteMs: 30_000 },
  relaxed: { label: 'RELAXED', answerMs: 120_000, voteMs: 45_000 },
} as const;

/** Drawing gets this multiple of the answer timer — drawing badly still takes longer. */
export const DRAWING_TIME_MULTIPLIER = 2.5;

/** The story catches everyone up this often (and always after the last standard round). */
export const STORY_UPDATE_EVERY_N_ROUNDS = 2;

/* ------------------------------------------------------------------ *
 * Pacing (auto-advance fallbacks so an absent host never stalls a room)
 * ------------------------------------------------------------------ */

/** "Answers are in…" tension beat between the last submission and the reveal. */
export const WAITING_BEAT_MS = 2_600;

/** How long the anonymous answers sit on screen before voting opens. */
export const REVEAL_HOLD_MS = 6_000;

/** Round results linger this long before auto-advancing without the host. */
export const ROUND_RESULTS_AUTO_MS = 14_000;

/** Story-update screens auto-continue after this long if the host never taps. */
export const STORY_UPDATE_AUTO_MS = 25_000;

/** Per-line pacing of the final story read-out. */
export const FINAL_STORY_LINE_MS = 2_400;

/** Grace added after the last final-story line before the finale/results move on. */
export const FINAL_STORY_TAIL_MS = 6_000;

/** Drawing setup ("you are the artist") card duration. */
export const DRAWING_SETUP_MS = 6_000;

/** Drawing results screen auto-advance. */
export const DRAWING_RESULTS_AUTO_MS = 20_000;

/** Countdown from GAME_SETUP into the first round. */
export const GAME_SETUP_MS = 4_000;

/* ------------------------------------------------------------------ *
 * Matchmaking
 * ------------------------------------------------------------------ */

/** Competitors per matchup by player count. Never fewer than 2, never more than 3. */
export const COMPETITORS_MIN = 2;
export const COMPETITORS_MAX = 3;

/** At or below this player count every matchup is a straight head-to-head. */
export const COMPETITORS_TWO_UP_TO = 5;

/** Above this player count every matchup is a three-way. */
export const COMPETITORS_THREE_FROM = 9;

/**
 * Weight on "how many rounds since this player last competed".
 *
 * Appearance balance is handled structurally by the bucketing in `matchmaking.ts`
 * rather than by a weight, so recency and the back-to-back penalty are the only two
 * numbers that need tuning.
 */
export const MATCHMAKING_W_RECENCY = 10;

/** Penalty applied to anyone who competed in the immediately preceding matchup. */
export const MATCHMAKING_BACK_TO_BACK_PENALTY = 500;

/* ------------------------------------------------------------------ *
 * Drawing finale
 * ------------------------------------------------------------------ */

/** Upper bound on artists in a small room, where everybody can reasonably draw. */
export const DRAWING_MAX_ARTISTS = 4;

/**
 * Above this player count the finale runs fewer drawings.
 *
 * Two reasons, and they happen to agree. Pacing: a drawing round costs the same
 * wall-clock time whatever the player count, so a big room does not want four of
 * them back to back. Balance: every extra player adds a guesser, and every guesser
 * mints a payout, so a big room already earns more per drawing — see
 * `tests/scoring.balance.test.ts`, which holds the finale to 25–35% of all points.
 */
export const DRAWING_LARGE_ROOM_FROM = 6;
export const DRAWING_ARTISTS_LARGE_ROOM = 3;

/* ------------------------------------------------------------------ *
 * Client storage keys
 * ------------------------------------------------------------------ */

/** sessionStorage (not localStorage) so a second tab is a new player, not a hijack. */
export const SESSION_STORAGE_KEY = 'blurt.session.v1';
export const MIXER_STORAGE_KEY = 'blurt.mixer.v1';
export const DEVICE_PREFS_STORAGE_KEY = 'blurt.device.v1';
