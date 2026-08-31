/**
 * BLURT — bot harness.
 *
 * Real `ws` clients against a real `wrangler dev`, speaking the real protocol. No
 * mocks, no in-process shortcuts: if the harness can finish a match, a room of
 * phones can too.
 *
 * Every message a bot receives is kept, because the interesting assertions are about
 * what the server *sent* — most importantly that no answer's author was ever
 * broadcast before that round's vote resolved.
 */

import WebSocket from 'ws';
import { PROTOCOL_VERSION } from '../shared/constants.js';
import type { ClientMessage, PrivateMessage, ServerMessage, StateMessage } from '../shared/protocol.js';
import type { Phase } from '../shared/types.js';

/** A 1×1 transparent PNG — a valid payload that keeps the harness fast. */
export const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export interface BotBehaviour {
  /** Never submit an answer when selected as a competitor. */
  skipAnswers?: boolean;
  /** Never vote. */
  skipVotes?: boolean;
  /** Never submit a drawing. */
  skipDrawing?: boolean;
  /** Never write a decoy. */
  skipGuesses?: boolean;
  /** Send every submission twice in the same tick. */
  doubleSubmit?: boolean;
  /** Submit a 160-character answer. */
  longAnswers?: boolean;
  /** Submit whitespace only (the server must refuse and the house must fill in). */
  blankAnswers?: boolean;
  /** Try to vote for the bot's own answer via a raw socket message. */
  attemptSelfVote?: boolean;
  /** Try a host-only action without being the host. */
  attemptHostAction?: boolean;
  /** Send a drawing larger than the server's cap. */
  oversizedDrawing?: boolean;
  /** Disconnect the socket the first time this phase is seen. */
  disconnectOnPhase?: Phase;
  /** Reconnect this many milliseconds after disconnecting. */
  reconnectAfterMs?: number;
  /** Blast the socket to trip the rate limiter. */
  floodOnJoin?: boolean;
}

export interface BotOptions {
  baseUrl: string;
  code: string;
  name: string;
  avatarId: string;
  isCreator: boolean;
  behaviour: BotBehaviour;
  /**
   * Sample WebSocket round-trip time, tagged with the phase it was measured in.
   * Off by default: it adds a ping per phase plus a slow heartbeat, which is noise
   * in a correctness run and the entire point in a latency run.
   */
  measureLatency?: boolean;
}

export class Bot {
  ws: WebSocket | null = null;
  playerId = '';
  token = '';
  state: StateMessage | null = null;
  privateMsg: PrivateMessage | null = null;
  readonly received: ServerMessage[] = [];
  readonly phases: Phase[] = [];
  readonly errors: { code: string; message: string }[] = [];
  /** Round-trip samples, tagged with the phase each was taken in. */
  readonly rtt: { phase: Phase; ms: number }[] = [];
  /**
   * Every phase change with the moment it was seen. A sequence rather than a map,
   * because phases repeat: a 3-round match enters ROUND_PROMPT three times, and
   * keying by phase would silently measure the gap between the first and the last.
   */
  readonly phaseLog: { phase: Phase; at: number }[] = [];
  finished = false;
  closed = false;

  private acted = new Set<string>();
  private disconnectedOnce = false;

  constructor(readonly options: BotOptions) {}

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${this.options.baseUrl}/ws?code=${this.options.code}`);
      this.ws = ws;
      ws.on('open', () => resolve());
      ws.on('error', (err) => reject(err));
      ws.on('close', () => {
        this.closed = true;
      });
      ws.on('message', (data) => this.onMessage(String(data)));
    });
    this.closed = false;

    this.send(
      this.options.isCreator
        ? { t: 'create_room', protocolVersion: PROTOCOL_VERSION, hostName: this.options.name }
        : { t: 'join_room', protocolVersion: PROTOCOL_VERSION, code: this.options.code },
    );

    if (this.options.behaviour.floodOnJoin === true) {
      for (let i = 0; i < 80; i += 1) this.send({ t: 'ping', sentAt: Date.now() });
    }
  }

  private onMessage(raw: string): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }
    this.received.push(message);

    switch (message.t) {
      case 'hello':
        this.playerId = message.playerId;
        this.token = message.token;
        break;
      case 'error':
        this.errors.push({ code: message.code, message: message.message });
        break;
      case 'pong': {
        const phase = this.state?.phase;
        if (phase !== undefined) this.rtt.push({ phase, ms: Date.now() - message.sentAt });
        break;
      }
      case 'private':
        this.privateMsg = message;
        break;
      case 'state': {
        const previous = this.state?.phase;
        this.state = message;
        if (previous !== message.phase) {
          this.phases.push(message.phase);
          this.phaseLog.push({ phase: message.phase, at: Date.now() });
          if (this.options.measureLatency === true) this.send({ t: 'ping', sentAt: Date.now() });
        }
        if (message.phase === 'FINAL_RESULTS') this.finished = true;
        // A fresh phase clears the per-phase private payload so a stale prompt
        // cannot be answered into the next round.
        if (previous !== message.phase) this.privateMsg = message.phase === previous ? this.privateMsg : null;
        this.act();
        break;
      }
      default:
        break;
    }

    if (message.t === 'private') this.act();
  }

  send(message: ClientMessage): void {
    if (this.ws === null || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(message));
  }

  /** Raw send, bypassing the typed protocol — used for hostile-message tests. */
  sendRaw(payload: unknown): void {
    if (this.ws === null || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
  }

  disconnect(): void {
    this.ws?.close();
    this.closed = true;
  }

  async reconnect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(`${this.options.baseUrl}/ws?code=${this.options.code}`);
      this.ws = ws;
      ws.on('open', () => resolve());
      ws.on('error', reject);
      ws.on('close', () => {
        this.closed = true;
      });
      ws.on('message', (data) => this.onMessage(String(data)));
    });
    this.closed = false;
    this.send({
      t: 'reconnect',
      protocolVersion: PROTOCOL_VERSION,
      roomCode: this.options.code,
      playerId: this.playerId,
      token: this.token,
    });
  }

  /** One-shot guard so a bot does not resend the same action on every broadcast. */
  private once(key: string, action: () => void): void {
    if (this.acted.has(key)) return;
    this.acted.add(key);
    action();
  }

  private act(): void {
    const state = this.state;
    if (state === null) return;
    const behaviour = this.options.behaviour;
    const me = state.you;

    if (behaviour.disconnectOnPhase === state.phase && !this.disconnectedOnce) {
      this.disconnectedOnce = true;
      this.disconnect();
      if (behaviour.reconnectAfterMs !== undefined) {
        setTimeout(() => void this.reconnect(), behaviour.reconnectAfterMs);
      }
      return;
    }

    switch (state.phase) {
      case 'LOBBY': {
        this.once('identify', () =>
          this.send({ t: 'identify', name: this.options.name, avatarId: this.options.avatarId }),
        );
        const self = state.players.find((p) => p.id === me.playerId);
        if (self?.identified === true && self.ready !== true) {
          this.once('ready', () => this.send({ t: 'set_ready', ready: true }));
        }
        if (behaviour.attemptHostAction === true && !me.isHost) {
          this.once('hostile-host', () => this.send({ t: 'start_game' }));
        }
        break;
      }

      case 'ROUND_PROMPT': {
        const prompt = this.privateMsg?.prompt;
        if (prompt === undefined || behaviour.skipAnswers === true) break;
        const key = `answer:${prompt.roundId}`;
        this.once(key, () => {
          const text = behaviour.blankAnswers === true
            ? '   '
            : behaviour.longAnswers === true
              ? 'X'.repeat(160)
              : `${this.options.name} says something regrettable`;
          this.send({ t: 'submit_answer', roundId: prompt.roundId, text });
          if (behaviour.doubleSubmit === true) {
            this.send({ t: 'submit_answer', roundId: prompt.roundId, text });
            this.send({ t: 'submit_answer', roundId: prompt.roundId, text });
          }
          if (behaviour.blankAnswers === true) {
            // The blank was refused; follow up with something real so the round
            // exercises the refusal rather than the timeout path.
            this.send({ t: 'submit_answer', roundId: prompt.roundId, text: 'a late but valid answer' });
          }
        });
        break;
      }

      case 'ROUND_VOTE': {
        const options = this.privateMsg?.votableAnswers;
        const matchup = state.view.phase === 'ROUND_VOTE' ? state.view : null;
        if (matchup === null) break;
        if (behaviour.attemptSelfVote === true && this.privateMsg?.myAnswerId !== undefined) {
          this.once(`self-vote:${matchup.roundNumber}`, () =>
            this.sendRaw({
              t: 'submit_vote',
              roundId: this.currentRoundId(),
              answerId: this.privateMsg?.myAnswerId,
            }),
          );
        }
        if (options === undefined || options.length === 0 || behaviour.skipVotes === true) break;
        const key = `vote:${matchup.roundNumber}`;
        this.once(key, () => {
          const choice = options[Math.floor(Math.random() * options.length)];
          if (choice === undefined) return;
          this.send({ t: 'submit_vote', roundId: this.currentRoundId(), answerId: choice.id });
          if (behaviour.doubleSubmit === true) {
            this.send({ t: 'submit_vote', roundId: this.currentRoundId(), answerId: choice.id });
          }
        });
        break;
      }

      case 'DRAWING_ACTIVE': {
        const brief = this.privateMsg?.drawingPrompt;
        if (brief === undefined || behaviour.skipDrawing === true) break;
        this.once(`draw:${brief.roundId}`, () => {
          const payload = behaviour.oversizedDrawing === true
            ? `data:image/png;base64,${'A'.repeat(210_000)}`
            : TINY_PNG;
          this.send({ t: 'submit_drawing', roundId: brief.roundId, strokesPngDataUrl: payload });
          if (behaviour.oversizedDrawing === true) {
            // Follow the rejected payload with a legal one so the phase completes.
            this.send({ t: 'submit_drawing', roundId: brief.roundId, strokesPngDataUrl: TINY_PNG });
          }
        });
        break;
      }

      case 'DRAWING_GUESS': {
        if (me.role === 'ARTIST' || behaviour.skipGuesses === true) break;
        const roundId = this.currentDrawingRoundId();
        this.once(`guess:${roundId}`, () =>
          this.send({
            t: 'submit_drawing_guess',
            roundId,
            text: `${this.options.name.split(' ')[0]}'s guess`,
          }),
        );
        break;
      }

      case 'DRAWING_VOTE': {
        const options = this.privateMsg?.votableDrawingOptions;
        if (me.role === 'ARTIST' || options === undefined || options.length === 0) break;
        if (behaviour.skipVotes === true) break;
        const roundId = this.currentDrawingRoundId();
        this.once(`dvote:${roundId}`, () => {
          const choice = options[Math.floor(Math.random() * options.length)];
          if (choice !== undefined) {
            this.send({ t: 'submit_drawing_vote', roundId, optionId: choice.id });
          }
        });
        break;
      }

      default:
        break;
    }

    // The host keeps the room moving through the reveal beats.
    if (me.isHost) {
      const advanceable: Phase[] = [
        'ROUND_REVEAL',
        'ROUND_RESULTS',
        'STORY_UPDATE',
        'FINAL_STORY',
        'DRAWING_RESULTS',
      ];
      if (advanceable.includes(state.phase)) {
        const key = `advance:${state.phase}:${this.phaseCounter()}`;
        this.once(key, () => setTimeout(() => this.send({ t: 'advance' }), 120));
      }
    }
  }

  private phaseCounter(): string {
    const view = this.state?.view;
    if (view === undefined) return '0';
    if ('roundNumber' in view) return `r${view.roundNumber}`;
    if ('drawingIndex' in view) return `d${view.drawingIndex}`;
    return String(this.phases.length);
  }

  /**
   * The round token comes from the public view, which is exactly where a real
   * client reads it: a voter is not a competitor and never receives a private
   * prompt, so the id cannot live only in the private payload.
   */
  private currentRoundId(): string {
    const view = this.state?.view;
    if (view !== undefined && 'roundId' in view) return view.roundId;
    return this.privateMsg?.prompt?.roundId ?? '';
  }

  private currentDrawingRoundId(): string {
    const view = this.state?.view;
    if (view !== undefined && 'roundId' in view) return view.roundId;
    return this.privateMsg?.drawingPrompt?.roundId ?? '';
  }
}
