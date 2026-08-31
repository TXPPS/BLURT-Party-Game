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
import { isLegalTransition, type Phase } from '../shared/types.js';

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
      case 'private':
        this.privateMsg = message;
        break;
      case 'state': {
        const previous = this.state?.phase;
        this.state = message;
        if (previous !== message.phase) this.phases.push(message.phase);
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

/* ------------------------------------------------------------------ *
 * Invariants
 * ------------------------------------------------------------------ */

export interface InvariantFailure {
  name: string;
  detail: string;
}

/** Every assertion the brief requires the harness to make, on every match. */
export function checkInvariants(bots: readonly Bot[]): InvariantFailure[] {
  const failures: InvariantFailure[] = [];
  const fail = (name: string, detail: string): void => {
    failures.push({ name, detail });
  };

  const finalState = bots.map((b) => b.state).find((s) => s?.phase === 'FINAL_RESULTS');
  if (finalState === undefined || finalState === null) {
    fail('match completed', 'no bot ever reached FINAL_RESULTS');
    return failures;
  }

  // 1. Legal transitions only.
  for (const bot of bots) {
    for (let i = 1; i < bot.phases.length; i += 1) {
      const from = bot.phases[i - 1] as Phase;
      const to = bot.phases[i] as Phase;
      if (!isLegalTransition(from, to)) fail('legal transitions', `${bot.options.name}: ${from} → ${to}`);
    }
  }

  // 2. Authorship never leaked before its vote resolved.
  for (const bot of bots) {
    for (const message of bot.received) {
      if (message.t === 'state' && (message.phase === 'ROUND_REVEAL' || message.phase === 'ROUND_VOTE')) {
        const view = message.view as { answers?: unknown[] };
        for (const answer of view.answers ?? []) {
          if (typeof answer === 'object' && answer !== null && 'authorId' in answer) {
            fail('no early authorship', `${bot.options.name} saw authorId during ${message.phase}`);
          }
        }
      }
      if (message.t === 'private' && message.votableAnswers !== undefined) {
        for (const option of message.votableAnswers) {
          if ('authorId' in (option as object)) {
            fail('no early authorship', `${bot.options.name} got an authorId in votableAnswers`);
          }
        }
      }
    }
  }

  // 3. Nobody was ever offered their own answer to vote for.
  for (const bot of bots) {
    let myAnswerId: string | undefined;
    for (const message of bot.received) {
      if (message.t !== 'private') continue;
      if (message.myAnswerId !== undefined) myAnswerId = message.myAnswerId;
      if (message.votableAnswers === undefined || myAnswerId === undefined) continue;
      if (message.votableAnswers.some((a) => a.id === myAnswerId)) {
        fail('no self-vote option', `${bot.options.name} was offered their own answer`);
      }
    }
  }

  // 4. Appearance fairness at 4+ players.
  const players = finalState.players.filter((p) => p.identified);
  if (players.length >= 4) {
    const counts = players.map((p) => p.stats.appearances);
    const spread = Math.max(...counts) - Math.min(...counts);
    if (spread > 1) fail('appearance fairness', `spread of ${spread}: ${counts.join(', ')}`);
  }

  // 5. Points reconcile: the sum of every broadcast delta equals the final score.
  //
  // Deduplication is per *results screen*, not per event. A single drawing
  // legitimately emits several identical `artist_identified` deltas — one per player
  // who identified it — so keying on (player, reason, points) silently collapses
  // real events and under-counts the score. Each results phase broadcasts one deltas
  // array, repeated across every socket and every re-broadcast, so keeping the array
  // once per (phase, round, drawing) is both correct and complete.
  const screens = new Map<string, { playerId: string; points: number }[]>();
  for (const bot of bots) {
    for (const message of bot.received) {
      if (message.t !== 'state') continue;
      const view = message.view as {
        deltas?: { playerId: string; points: number; reason: string }[];
        roundNumber?: number;
        drawingIndex?: number;
      };
      if (view.deltas === undefined) continue;
      const key = `${message.phase}:${view.roundNumber ?? 0}:${view.drawingIndex ?? 0}`;
      screens.set(key, view.deltas);
    }
  }

  const deltas = new Map<string, number>();
  for (const list of screens.values()) {
    for (const delta of list) {
      deltas.set(delta.playerId, (deltas.get(delta.playerId) ?? 0) + delta.points);
    }
  }

  for (const player of players) {
    const recomputed = deltas.get(player.id) ?? 0;
    if (recomputed !== player.score) {
      fail(
        'score reconciliation',
        `${player.name}: leaderboard ${player.score}, recomputed ${recomputed}`,
      );
    }
  }

  // 6. The final story is complete — no placeholders, no blanks.
  const view = finalState.view as { stories?: { sections: { lines: { segments: { text: string }[] }[] }[] }[] };
  const stories = view.stories ?? [];
  if (stories.length === 0) fail('final story', 'no story was rendered on the results screen');
  for (const story of stories) {
    for (const section of story.sections) {
      for (const line of section.lines) {
        const text = line.segments.map((s) => s.text).join('');
        if (/\{[a-z0-9_]+\}/.test(text)) fail('final story', `unfilled placeholder: ${text}`);
        if (text.includes('undefined') || text.includes('null')) {
          fail('final story', `placeholder text leaked: ${text}`);
        }
        if (text.trim().length === 0) fail('final story', 'a story line rendered empty');
      }
    }
  }

  return failures;
}
