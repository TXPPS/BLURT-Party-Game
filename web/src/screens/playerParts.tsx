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
