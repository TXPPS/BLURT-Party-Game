/**
 * BLURT — the player device's input surfaces.
 *
 * Split out of `PlayerView` so that file stays a routing table and nothing else.
 * Everything here is a leaf: it owns its own draft text, and it reports upward. No
 * component in this file knows what phase the game is in or what happens next.
 */

import { useEffect, useRef, useState } from 'react';
import { DRAWING_GUESS_MAX_LENGTH } from '@shared/constants.js';
import type { PrivateMessage, StateMessage } from '@shared/protocol.js';
import { clampText, textLength } from '@shared/sanitize.js';
import { ActionButton, Card, CharCount, DrawingFrame, PhaseTitle } from '../components/kit.js';

/** Seconds remaining at which a player's own device warns them. */
const TIMER_WARNING_AT = 10;

/**
 * The deadline warning is a *local* sound, deliberately.
 *
 * Dramatic cues are driven by the server and, by default, only the shared screen
 * plays them — but "your time is running out" is about this player's own device, so
 * everybody should hear their own.
 */
export function useTimerSounds(seconds: number, active: boolean, play: (e: 'timer_warning' | 'timer_out') => void): void {
  const warned = useRef(false);
  const expired = useRef(false);
  const playRef = useRef(play);
  playRef.current = play;

  useEffect(() => {
    if (!active) {
      warned.current = false;
      expired.current = false;
      return;
    }
    if (seconds > TIMER_WARNING_AT) {
      warned.current = false;
      expired.current = false;
      return;
    }
    if (seconds > 0 && !warned.current) {
      warned.current = true;
      playRef.current('timer_warning');
    }
    if (seconds <= 0 && !expired.current) {
      expired.current = true;
      playRef.current('timer_out');
    }
  }, [seconds, active]);
}


export function SpectatorBeat({
  title,
  body,
  round,
  timer,
}: {
  title: string;
  body: string;
  round: string;
  timer: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="stack center">
      <div className="row row--between">
        <PhaseTitle eyebrow={round} title={title} />
        {timer}
      </div>
      <Card sunken>
        <p className="lead">{body}</p>
      </Card>
    </div>
  );
}

export function AnswerForm({
  prompt,
  timer,
  view,
  onSubmit,
  onSound,
}: {
  prompt: NonNullable<PrivateMessage['prompt']>;
  timer: React.ReactNode;
  view: Extract<StateMessage['view'], { phase: 'ROUND_PROMPT' }>;
  onSubmit(roundId: string, text: string): void;
  onSound(event?: 'ui_click' | 'submit'): void;
}): React.JSX.Element {
  const [text, setText] = useState(prompt.submitted ?? '');
  const [sent, setSent] = useState(prompt.submitted !== null);

  // A reconnect mid-round restores whatever was already submitted.
  useEffect(() => {
    if (prompt.submitted !== null) {
      setText(prompt.submitted);
      setSent(true);
    }
  }, [prompt.submitted, prompt.roundId]);

  const valid = textLength(text.trim()) > 0;

  // One send path, called by the button and by the form's Enter key. The button is
  // an ActionButton, which is never a submitter — see `ActionButton` for why.
  const send = (): void => {
    if (!valid) return;
    onSound('submit');
    onSubmit(prompt.roundId, text.trim());
    setSent(true);
  };

  return (
    <div className="stack">
      <div className="row row--between">
        <p className="eyebrow">
          Round {view.roundNumber} of {view.totalRounds}
        </p>
        {timer}
      </div>

      <div className="prompt">
        <p className="prompt__text breakable">{prompt.text}</p>
        {prompt.hint !== null && <p className="prompt__hint">{prompt.hint}</p>}
      </div>

      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <div className="field">
          <label className="visually-hidden" htmlFor="answer">
            Your answer
          </label>
          <textarea
            id="answer"
            className="textarea breakable"
            value={text}
            onChange={(event) => {
              setText(clampText(event.target.value, prompt.charLimit));
              setSent(false);
            }}
            placeholder="Say the first thing. It is usually the funniest."
            maxLength={prompt.charLimit * 2}
            enterKeyHint="send"
          />
          <CharCount value={text} max={prompt.charLimit} />
        </div>
        <ActionButton variant="primary" block onClick={send} disabled={!valid}>
          {sent ? 'CHANGE IT' : 'SEND IT'}
        </ActionButton>
        {sent && (
          <p className="center muted" aria-live="polite">
            In. You can still change it until the timer runs out.
          </p>
        )}
      </form>
    </div>
  );
}

export function GuessForm({
  image,
  artist,
  existing,
  timer,
  onSubmit,
  onSound,
}: {
  image: string;
  artist: string;
  existing: string | null;
  timer: React.ReactNode;
  onSubmit(text: string): void;
  onSound(event?: 'ui_click' | 'submit'): void;
}): React.JSX.Element {
  const [text, setText] = useState(existing ?? '');
  const [sent, setSent] = useState(existing !== null);

  const send = (): void => {
    if (text.trim().length === 0) return;
    onSound('submit');
    onSubmit(text.trim());
    setSent(true);
  };

  return (
    <div className="stack">
      <div className="row row--between">
        <PhaseTitle eyebrow={`${artist} drew this`} title="What were they told to draw?" />
        {timer}
      </div>
      <DrawingFrame url={image} artistName={artist} />
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <div className="field">
          <label className="field__label" htmlFor="guess">
            Your guess — make it believable
          </label>
          <input
            id="guess"
            className="input breakable"
            value={text}
            onChange={(event) => {
              setText(clampText(event.target.value, DRAWING_GUESS_MAX_LENGTH));
              setSent(false);
            }}
            maxLength={DRAWING_GUESS_MAX_LENGTH * 2}
            placeholder="a man losing an argument with a bin"
            enterKeyHint="send"
          />
          <CharCount value={text} max={DRAWING_GUESS_MAX_LENGTH} />
        </div>
        <ActionButton variant="primary" block onClick={send} disabled={text.trim().length === 0}>
          {sent ? 'CHANGE IT' : 'SEND IT'}
        </ActionButton>
        <p className="faint center">
          If somebody picks yours instead of the truth, you score. Lie well.
        </p>
      </form>
    </div>
  );
}

/** "Ana, Bo and Cal are drawing" — an Oxford-comma-free join that reads out loud. */
export function listNames(names: readonly string[], suffix: string): string {
  if (names.length === 0) return `Nobody ${suffix}`;
  if (names.length === 1) return `${names[0] ?? ''} ${suffix}`;
  const head = names.slice(0, -1).join(', ');
  return `${head} and ${names.at(-1) ?? ''} ${suffix}`;
}

/**
 * What a non-artist looks at while everybody else draws.
 *
 * This phase used to be the worst dead air in the game: one artist drew, everybody
 * else got a static "X is drawing" card for up to three minutes, three times over.
 * Drawing is simultaneous now, so the wait is a third of the length — and this screen
 * gives it a pulse by naming who is still working and counting submissions as they
 * land. The counter is driven by the broadcast, so it moves on its own.
 */
export function DrawingHold({
  view,
  timer,
}: {
  view: Extract<StateMessage['view'], { phase: 'DRAWING_ACTIVE' }>;
  timer: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="stack center">
      <div className="row row--between">
        <PhaseTitle eyebrow="Pens down soon" title="They are drawing" />
        {timer}
      </div>

      <SubmissionTally view={view} />

      <p className="lead center">
        You will be asked to guess what each one was meant to be. Prepare to be wrong.
      </p>
    </div>
  );
}

/**
 * "3 of 6 handed in", plus who is still going.
 *
 * Shown to anybody waiting on the drawing phase to end. Since everybody in the room
 * draws, that is now mostly artists who have already submitted and are watching their
 * own locked canvas — without this they get a dead screen and no idea how long the
 * wait is. Driven by the broadcast, so it moves on its own.
 */
export function SubmissionTally({
  view,
}: {
  view: Extract<StateMessage['view'], { phase: 'DRAWING_ACTIVE' }>;
}): React.JSX.Element {
  const { submittedCount, artistTotal, pendingArtistNames } = view;
  const done = artistTotal > 0 && submittedCount >= artistTotal;

  return (
    <>
      <Card sunken>
        <p className="tally" aria-live="polite">
          <span className="tally__value">{submittedCount}</span>
          <span className="tally__of"> of {artistTotal}</span>
        </p>
        <p className="center muted">
          {done ? 'Everybody is done. Here we go.' : 'have handed their drawing in'}
        </p>
      </Card>

      {!done && pendingArtistNames.length > 0 && (
        <p className="center faint">{listNames(pendingArtistNames, 'still scribbling')}</p>
      )}
    </>
  );
}

/**
 * READY on a watching screen, with a live count of who the room is waiting for.
 *
 * The count is the point. Without it a skip button is a mystery — you press it and
 * nothing happens, because five other people have not. Naming the number turns a dead
 * wait into a visible one.
 *
 * The phase still ends on its own deadline regardless, so this only ever makes a
 * screen shorter, and only when everybody agrees.
 */
export function ReadyToAdvance({
  you,
  onReady,
}: {
  you: StateMessage['you'];
  onReady(ready: boolean): void;
}): React.JSX.Element | null {
  if (!you.skipOffered) return null;
  const waiting = Math.max(0, you.skipTotal - you.skipReadyCount);

  return (
    <div className="ready">
      <ActionButton
        variant={you.skipReady ? 'ghost' : 'primary'}
        block
        onClick={() => onReady(!you.skipReady)}
      >
        {you.skipReady ? 'WAITING FOR THE REST' : 'READY'}
      </ActionButton>
      <p className="ready__count" aria-live="polite">
        {you.skipReadyCount} of {you.skipTotal} ready
        {waiting > 0 && you.skipReady ? ' · we go when everybody is' : ''}
      </p>
    </div>
  );
}
