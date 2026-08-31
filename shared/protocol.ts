/**
 * BLURT — wire protocol.
 *
 * Two discriminated unions on a `t` tag. The client and the server both compile
 * against this file, so a message that does not exist here cannot be sent, and a
 * message shape that changed on one side fails to build on the other.
 *
 * Runtime validation of everything inbound lives in `server/src/validate.ts` (zod).
 * It is kept out of this module on purpose: the client ships the types with zero
 * bytes of validator, and the server never trusts a type assertion.
 */

import type { GameMode, GameSettings, Phase, PublicPlayer, PublicRoom } from './types.js';
import type { PublicView, SelfView } from './views.js';

export { PROTOCOL_VERSION } from './constants.js';

/* ------------------------------------------------------------------ *
 * Client → Server
 * ------------------------------------------------------------------ */

/** Sent as the first message on a socket opened with `?code=NEW`. */
export interface CreateRoomMessage {
  t: 'create_room';
  protocolVersion: number;
  hostName?: string;
  /**
   * Content mode, chosen on the home screen before anybody picks a name.
   *
   * It has to arrive here rather than being set later in the lobby: the name
   * generator and the avatar picker both branch on it, and identity is chosen before
   * the lobby exists. Setting it afterwards left the host — the one person who
   * *chose* Crude — stuck with a Classic name and a Classic avatar.
   */
  mode?: GameMode;
}

export interface JoinRoomMessage {
  t: 'join_room';
  protocolVersion: number;
  code: string;
}

export interface IdentifyMessage {
  t: 'identify';
  name: string;
  avatarId: string;
}

/** "I have finished looking at this screen." Only meaningful on watching phases. */
export interface AdvanceReadyMessage {
  t: 'advance_ready';
  ready: boolean;
}

export interface SetReadyMessage {
  t: 'set_ready';
  ready: boolean;
}

/** Host only. A partial patch; every field is re-validated and re-clamped server-side. */
export interface UpdateSettingsMessage {
  t: 'update_settings';
  settings: Partial<GameSettings>;
}

export interface KickPlayerMessage {
  t: 'kick_player';
  playerId: string;
}

export interface StartGameMessage {
  t: 'start_game';
}

export interface SubmitAnswerMessage {
  t: 'submit_answer';
  roundId: string;
  text: string;
}

export interface SubmitVoteMessage {
  t: 'submit_vote';
  roundId: string;
  answerId: string;
}

export interface SubmitDrawingMessage {
  t: 'submit_drawing';
  roundId: string;
  strokesPngDataUrl: string;
}

export interface SubmitDrawingGuessMessage {
  t: 'submit_drawing_guess';
  roundId: string;
  text: string;
}

export interface SubmitDrawingVoteMessage {
  t: 'submit_drawing_vote';
  roundId: string;
  optionId: string;
}

/** Host only. Gates the reveal screens; every one of them also auto-advances. */
export interface AdvanceMessage {
  t: 'advance';
}

export interface PlayAgainMessage {
  t: 'play_again';
}

export interface ReturnToLobbyMessage {
  t: 'return_to_lobby';
}

export interface ReconnectMessage {
  t: 'reconnect';
  protocolVersion: number;
  roomCode: string;
  playerId: string;
  token: string;
}

/** Records that this device has passed the 18+ gate, so it is not asked twice. */
export interface AcknowledgeAdultMessage {
  t: 'acknowledge_adult';
}

export interface PingMessage {
  t: 'ping';
  /** Client clock sample, echoed back so the client can measure round-trip skew. */
  sentAt: number;
}

export type ClientMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | IdentifyMessage
  | SetReadyMessage
  | AdvanceReadyMessage
  | UpdateSettingsMessage
  | KickPlayerMessage
  | StartGameMessage
  | SubmitAnswerMessage
  | SubmitVoteMessage
  | SubmitDrawingMessage
  | SubmitDrawingGuessMessage
  | SubmitDrawingVoteMessage
  | AdvanceMessage
  | PlayAgainMessage
  | ReturnToLobbyMessage
  | ReconnectMessage
  | AcknowledgeAdultMessage
  | PingMessage;

export type ClientMessageType = ClientMessage['t'];

/* ------------------------------------------------------------------ *
 * Server → Client
 * ------------------------------------------------------------------ */

export interface HelloMessage {
  t: 'hello';
  playerId: string;
  /** The reconnect secret. Stored in sessionStorage; never broadcast to anyone else. */
  token: string;
  protocolVersion: number;
  roomCode: string;
  /** Server clock at send time — the client offsets every deadline against this. */
  serverTime: number;
}

export interface StateMessage {
  t: 'state';
  phase: Phase;
  room: PublicRoom;
  players: PublicPlayer[];
  view: PublicView;
  you: SelfView;
  serverTime: number;
}

/** Per-socket payload. Absent fields simply do not apply in the current phase. */
export interface PrivateMessage {
  t: 'private';
  /** The disguised prompt this device must answer, if it is competing. */
  prompt?: {
    roundId: string;
    text: string;
    hint: string | null;
    charLimit: number;
    /** Echoed back so a reconnecting player sees their own draft/submission. */
    submitted: string | null;
  };
  /** This device's own answer id, so it can be visually flagged during the reveal. */
  myAnswerId?: string;
  /** Answers this device is allowed to vote for — never includes its own. */
  votableAnswers?: { id: string; text: string }[];
  /** This device's existing vote for the current matchup, if any. */
  myVote?: string;
  /** The private drawing brief, sent only to the current artist. */
  drawingPrompt?: {
    roundId: string;
    subject: string;
    context: string;
    submitted: boolean;
  };
  /** This device's decoy for the current drawing, if already written. */
  myDrawingGuess?: string;
  /** Options this device may vote for — never includes its own decoy. */
  votableDrawingOptions?: { id: string; text: string }[];
  myDrawingVote?: string;
}

export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'GAME_ALREADY_STARTED'
  | 'VERSION_MISMATCH'
  | 'INVALID_NAME'
  | 'INVALID_ROOM_CODE'
  | 'INVALID_MESSAGE'
  | 'WRONG_PHASE'
  | 'NOT_HOST'
  | 'NOT_YOUR_TURN'
  | 'SELF_VOTE'
  | 'ALREADY_SUBMITTED'
  | 'DEADLINE_PASSED'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'SESSION_NOT_RESTORED'
  | 'DUPLICATE_SESSION'
  | 'KICKED'
  | 'ROOM_CLOSED'
  | 'SERVER_ERROR';

export interface ErrorMessage {
  t: 'error';
  code: ErrorCode;
  /** Player-facing copy. Never a stack trace, never an internal id. */
  message: string;
  /** True when the socket is about to close and the client should show an error screen. */
  fatal: boolean;
}

export type ToastKind = 'info' | 'good' | 'bad' | 'host';

export interface ToastMessage {
  t: 'toast';
  kind: ToastKind;
  message: string;
}

/** Server-driven dramatic cue. UI feedback sounds are triggered locally instead. */
export interface SfxMessage {
  t: 'sfx';
  eventId: string;
}

export interface PongMessage {
  t: 'pong';
  /** Echo of `PingMessage.sentAt`. */
  sentAt: number;
  serverTime: number;
}

export type ServerMessage =
  | HelloMessage
  | StateMessage
  | PrivateMessage
  | ErrorMessage
  | ToastMessage
  | SfxMessage
  | PongMessage;

/* ------------------------------------------------------------------ *
 * Transport helpers
 * ------------------------------------------------------------------ */

/** Query value that asks the Worker to allocate a brand-new room. */
export const NEW_ROOM_SENTINEL = 'NEW';

/** Friendly copy for every error code, so client and server never disagree. */
export const ERROR_COPY: Readonly<Record<ErrorCode, { title: string; body: string }>> = {
  ROOM_NOT_FOUND: {
    title: 'No room with that code',
    body: 'Double-check the four letters on the big screen — they expire after a while.',
  },
  ROOM_FULL: { title: 'That room is full', body: 'Ten players is the limit. Start a second room?' },
  GAME_ALREADY_STARTED: {
    title: 'They already started',
    body: 'Hang tight — you can join as soon as they get back to the lobby.',
  },
  VERSION_MISMATCH: {
    title: 'This tab is out of date',
    body: 'The game updated while you were away. Reload to get the current version.',
  },
  INVALID_NAME: { title: "That name won't work", body: 'Try something between 1 and 20 characters.' },
  INVALID_ROOM_CODE: { title: 'That is not a room code', body: 'Room codes are four letters, like BEEF.' },
  INVALID_MESSAGE: { title: 'Something went sideways', body: 'That action did not make sense to the server.' },
  WRONG_PHASE: { title: 'Too late for that', body: 'The room has already moved on.' },
  NOT_HOST: { title: 'Only the host can do that', body: 'Ask whoever is holding the big screen.' },
  NOT_YOUR_TURN: { title: 'Not your turn', body: 'Sit tight — you are up soon.' },
  SELF_VOTE: { title: 'Nice try', body: 'You cannot vote for your own answer.' },
  ALREADY_SUBMITTED: { title: 'Already in', body: 'We got it the first time.' },
  DEADLINE_PASSED: { title: 'Time is up', body: 'The house answered for you. It did not do well.' },
  PAYLOAD_TOO_LARGE: { title: 'That is a lot of drawing', body: 'Simplify it a little and send again.' },
  RATE_LIMITED: { title: 'Slow down', body: 'Too many messages at once. Give it a second.' },
  SESSION_NOT_RESTORED: {
    title: "Couldn't restore your session",
    body: 'We could not prove that was you. Rejoin with the room code.',
  },
  DUPLICATE_SESSION: {
    title: 'Already connected somewhere else',
    body: 'This player is open in another tab. Use that one, or join as somebody new.',
  },
  KICKED: { title: 'The host removed you', body: 'Awkward. You can join a different room.' },
  ROOM_CLOSED: { title: 'That room is closed', body: 'Rooms wind down after a while of nobody playing.' },
  SERVER_ERROR: { title: 'Our fault', body: 'Something broke on our side. Try rejoining.' },
};
