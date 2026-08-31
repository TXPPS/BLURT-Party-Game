/**
 * BLURT — the player device.
 *
 * Portrait-first, one job per screen, and never a dead wait: every "hold on" state
 * says what the group is doing and how long it has left. Screen routing is a pure
 * function of (phase, role) — this component computes nothing about the game.
 */

import { lazy, Suspense } from 'react';
import type { PrivateMessage, StateMessage } from '@shared/protocol.js';
import { ActionButton, Card, DrawingFrame, PhaseTitle, TimerRing, Waiting } from '../components/kit.js';
import { Scoreboard } from '../components/Scoreboard.js';
import { useCountdown } from '../net/useRoom.js';
import { AnswerForm, DrawingHold, GuessForm, SpectatorBeat, listNames, useTimerSounds } from './playerParts.js';

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
          <p className="faint center">The full breakdown is below.</p>
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
            eyebrow={view.artistTotal === 1 ? 'One artist' : `${view.artistTotal} artists`}
            title={state.you.role === 'ARTIST' ? 'You are drawing' : listNames(view.artistNames, 'are drawing')}
          />
          <Waiting message="Getting the pens out" />
        </div>
      );

    case 'DRAWING_ACTIVE': {
      const brief = props.privateData?.drawingPrompt;
      if (state.you.role !== 'ARTIST' || brief === undefined) {
        return <DrawingHold view={view} timer={timer} />;
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
          <DrawingFrame url={view.imageUrl} artistName={view.artistName} />
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
          <p className="faint center">The full breakdown is below.</p>
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
