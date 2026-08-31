/**
 * BLURT — the player device.
 *
 * Portrait-first, one job per screen, and never a dead wait: every "hold on" state
 * says what the group is doing and how long it has left. Screen routing is a pure
 * function of (phase, role) — this component computes nothing about the game.
 */

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { PrivateMessage } from '@shared/protocol.js';
import type { StateMessage } from '@shared/protocol.js';
import { clampText, textLength } from '@shared/sanitize.js';
import { ActionButton, Card, CharCount, PhaseTitle, TimerRing, Waiting } from '../components/kit.js';
import { Scoreboard } from '../components/Scoreboard.js';
import { useCountdown } from '../net/useRoom.js';

const DrawingCanvas = lazy(() =>
  import('../components/Canvas.js').then((m) => ({ default: m.DrawingCanvas })),
);

export interface PlayerViewProps {
  state: StateMessage;
  privateData: PrivateMessage | null;
  serverNow(): number;
  onAnswer(roundId: string, text: string): void;
  onVote(roundId: string, answerId: string): void;
  onDrawing(roundId: string, dataUrl: string): void;
  onGuess(roundId: string, text: string): void;
  onDrawingVote(roundId: string, optionId: string): void;
  onSound(event?: 'ui_click' | 'submit' | 'vote_cast' | 'timer_warning' | 'timer_out'): void;
}

/** Seconds remaining at which a player's own device warns them. */
const TIMER_WARNING_AT = 10;

/**
 * The deadline warning is a *local* sound, deliberately.
 *
 * Dramatic cues are driven by the server and, by default, only the shared screen
 * plays them — but "your time is running out" is about this player's own device, so
 * everybody should hear their own.
 */
function useTimerSounds(seconds: number, active: boolean, play: (e: 'timer_warning' | 'timer_out') => void): void {
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

export function PlayerView(props: PlayerViewProps): React.JSX.Element {
  const { state } = props;
  const view = state.view;
  const deadline = 'deadline' in view && view.deadline !== null ? view.deadline.endsAt : null;
  const countdown = useCountdown(deadline, props.serverNow);

  // Only warn on phases this player can still act in — a spectator does not need to
  // be told that somebody else is running out of time.
  const actionable =
    view.phase === 'ROUND_PROMPT' ||
    view.phase === 'ROUND_VOTE' ||
    view.phase === 'DRAWING_ACTIVE' ||
    view.phase === 'DRAWING_GUESS' ||
    view.phase === 'DRAWING_VOTE';
  useTimerSounds(countdown.seconds, deadline !== null && actionable, props.onSound);

  const timer =
    deadline === null ? null : (
      <TimerRing seconds={countdown.seconds} fraction={countdown.fraction} label="Time left" />
    );

  switch (view.phase) {
    case 'GAME_SETUP':
      return (
        <div className="stack center">
          <PhaseTitle eyebrow="Sealed" title="A story has been chosen" sub="You will not be told which one." />
          <Waiting message="Shuffling" detail={`${view.totalRounds} rounds. Nobody knows what happens next.`} />
        </div>
      );

    case 'ROUND_PROMPT': {
      const prompt = props.privateData?.prompt;
      if (prompt === undefined) {
        return (
          <SpectatorBeat
            timer={timer}
            title="You are off the hook"
            body="Two of them are answering something. You will get to judge it in a moment."
            round={`Round ${view.roundNumber} of ${view.totalRounds}`}
          />
        );
      }
      return <AnswerForm prompt={prompt} timer={timer} onSubmit={props.onAnswer} onSound={props.onSound} view={view} />;
    }

    case 'ROUND_WAITING':
      return (
        <div className="stack center">
          <PhaseTitle eyebrow={`Round ${view.roundNumber}`} title="Answers are in" />
          <Waiting message="Bracing" detail="Nobody knows whose is whose. That is the point." />
        </div>
      );

    case 'ROUND_REVEAL':
      return (
        <div className="stack">
          <PhaseTitle eyebrow={`Round ${view.roundNumber} of ${view.totalRounds}`} title="Read them" />
          <Card sunken>
            <p className="lead breakable">{view.prompt}</p>
          </Card>
          <div className="answers">
            {view.answers.map((answer) => (
              <div
                key={answer.id}
                className="answer breakable"
                data-mine={props.privateData?.myAnswerId === answer.id}
              >
                {answer.text}
              </div>
            ))}
          </div>
          <p className="faint center">Voting opens in a second.</p>
        </div>
      );

    case 'ROUND_VOTE': {
      const options = props.privateData?.votableAnswers;
      const myVote = props.privateData?.myVote;
      if (options === undefined || options.length === 0) {
        return (
          <SpectatorBeat
            timer={timer}
            title="This one is not yours to judge"
            body="You wrote one of these. Sit very still."
            round={`Round ${view.roundNumber} of ${view.totalRounds}`}
          />
        );
      }
      return (
        <div className="stack">
          <div className="row row--between">
            <PhaseTitle eyebrow={`Round ${view.roundNumber}`} title="Pick the better one" />
            {timer}
          </div>
          <Card sunken>
            <p className="lead breakable">{view.prompt}</p>
          </Card>
          <div className="answers">
            {options.map((answer) => (
              <ActionButton
                key={answer.id}
                variant={myVote === answer.id ? 'primary' : 'secondary'}
                block
                disabled={myVote !== undefined}
                onClick={() => {
                  props.onSound('vote_cast');
                  props.onVote(view.roundId, answer.id);
                }}
              >
                <span className="breakable" style={{ textAlign: 'left' }}>
                  {answer.text}
                </span>
              </ActionButton>
            ))}
          </div>
          {myVote !== undefined && <p className="center muted">Locked in. No takebacks.</p>}
        </div>
      );
    }

    case 'ROUND_RESULTS':
      return (
        <div className="stack">
          <PhaseTitle
            eyebrow={`Round ${view.roundNumber} of ${view.totalRounds}`}
            title={view.nobodyVoted ? 'Nobody voted' : view.wasCoinFlip ? 'It was a tie' : 'Results'}
          />
          <Scoreboard rows={view.leaderboard} />
          <p className="faint center">Look at the big screen.</p>
        </div>
      );

    case 'STORY_UPDATE':
    case 'FINAL_STORY':
      return (
        <div className="stack center">
          <PhaseTitle
            eyebrow="The story so far"
            title={view.phase === 'FINAL_STORY' ? 'The whole thing' : 'What you have done'}
          />
          {/* Deliberately not "look up": plenty of groups play with no shared screen
              at all, and the condensed group view is right below these words. */}
          <Waiting message="Reading it out" detail="This is the good bit." />
        </div>
      );

    case 'DRAWING_SETUP':
      return (
        <div className="stack center">
          <PhaseTitle
            eyebrow={`Drawing ${view.drawingIndex} of ${view.drawingTotal}`}
            title={state.you.role === 'ARTIST' ? 'You are drawing this one' : `${view.artistName} is drawing`}
          />
          <Waiting message="Getting the pens out" />
        </div>
      );

    case 'DRAWING_ACTIVE': {
      const brief = props.privateData?.drawingPrompt;
      if (state.you.role !== 'ARTIST' || brief === undefined) {
        return (
          <SpectatorBeat
            timer={timer}
            title={`${view.artistName} is drawing`}
            body="You will be asked to guess what it was. Prepare to be wrong."
            round={`Drawing ${view.drawingIndex} of ${view.drawingTotal}`}
          />
        );
      }
      return (
        <Suspense fallback={<Waiting message="Loading the canvas" />}>
          <DrawingCanvas
            subject={brief.subject}
            context={brief.context}
            submitted={brief.submitted}
            timer={timer}
            onSubmit={(dataUrl) => props.onDrawing(brief.roundId, dataUrl)}
          />
        </Suspense>
      );
    }

    case 'DRAWING_GUESS': {
      if (state.you.role === 'ARTIST') {
        return (
          <SpectatorBeat
            timer={timer}
            title="They are guessing"
            body="You know what it was. Say nothing."
            round={`Drawing ${view.drawingIndex} of ${view.drawingTotal}`}
          />
        );
      }
      return (
        <GuessForm
          image={view.imageUrl}
          artist={view.artistName}
          existing={props.privateData?.myDrawingGuess ?? null}
          timer={timer}
          onSubmit={(text) => props.onGuess(view.roundId, text)}
          onSound={props.onSound}
        />
      );
    }

    case 'DRAWING_VOTE': {
      const options = props.privateData?.votableDrawingOptions;
      const myVote = props.privateData?.myDrawingVote;
      if (state.you.role === 'ARTIST' || options === undefined) {
        return (
          <SpectatorBeat
            timer={timer}
            title="They are voting on your drawing"
            body="Some of them are about to fall for a lie."
            round={`Drawing ${view.drawingIndex} of ${view.drawingTotal}`}
          />
        );
      }
      return (
        <div className="stack">
          <div className="row row--between">
            <PhaseTitle eyebrow="Which one was real" title="Pick the actual prompt" />
            {timer}
          </div>
          <div className="drawing-frame">
            <img src={view.imageUrl} alt={`Drawing by ${view.artistName}`} />
          </div>
          <div className="answers">
            {options.map((option) => (
              <ActionButton
                key={option.id}
                variant={myVote === option.id ? 'primary' : 'secondary'}
                block
                disabled={myVote !== undefined}
                onClick={() => {
                  props.onSound('vote_cast');
                  props.onDrawingVote(view.roundId, option.id);
                }}
              >
                <span className="breakable" style={{ textAlign: 'left' }}>
                  {option.text}
                </span>
              </ActionButton>
            ))}
          </div>
        </div>
      );
    }

    case 'DRAWING_RESULTS':
      return (
        <div className="stack">
          <PhaseTitle eyebrow={`Drawing ${view.drawingIndex} of ${view.drawingTotal}`} title="How that went" />
          <Scoreboard rows={view.leaderboard} />
          <p className="faint center">Look at the big screen.</p>
        </div>
      );

    case 'FINAL_RESULTS':
      return (
        <div className="stack">
          <PhaseTitle eyebrow="That is the game" title="Final scores" />
          <Scoreboard rows={view.leaderboard} showDelta={false} />
          <p className="faint center">The host decides whether you get to do that again.</p>
        </div>
      );

    default:
      return <Waiting message="Waiting for the room" />;
  }
}

/* ------------------------------------------------------------------ *
 * Sub-screens
 * ------------------------------------------------------------------ */

function SpectatorBeat({
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

function AnswerForm({
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

function GuessForm({
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
      <div className="drawing-frame">
        <img src={image} alt={`Drawing by ${artist}`} />
      </div>
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
              setText(clampText(event.target.value, 100));
              setSent(false);
            }}
            maxLength={200}
            placeholder="a man losing an argument with a bin"
            enterKeyHint="send"
          />
          <CharCount value={text} max={100} />
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
