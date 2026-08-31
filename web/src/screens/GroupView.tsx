/**
 * BLURT — the shared screen.
 *
 * Landscape-first, readable across a room, and *never required*: the same component
 * renders in a condensed strip under a player's controls so a fully remote group
 * still sees what is happening. Nothing here is interactive except the host's
 * single advance button.
 */

import { brand } from '../brand.js';
import type { StateMessage } from '@shared/protocol.js';
import type { SfxEventId } from '@shared/sfx.js';
import {
  ActionButton,
  AvatarBadge,
  Card,
  DrawingFrame,
  PhaseTitle,
  PlayerChip,
  Progress,
  TimerRing,
  Waiting,
} from '../components/kit.js';
import { Scoreboard, ScoreboardReveal } from '../components/Scoreboard.js';
import { StoryReadout, StoryView } from '../components/StoryView.js';
import { useCountdown } from '../net/useRoom.js';
import { Awards, Highlights } from './Results.js';

export interface GroupViewProps {
  state: StateMessage;
  serverNow(): number;
  isHost: boolean;
  onAdvance(): void;
  onPlayAgain(): void;
  onReturnToLobby(): void;
  condensed?: boolean;
  /** Plays a story section's declared audio cue as that section is revealed. */
  onCue?(event: SfxEventId): void;
}

export function GroupView(props: GroupViewProps): React.JSX.Element {
  const { state, condensed = false } = props;
  const view = state.view;
  const deadline = 'deadline' in view && view.deadline !== null ? view.deadline.endsAt : null;
  const countdown = useCountdown(deadline, props.serverNow);
  const byId = new Map(state.players.map((p) => [p.id, p]));

  /**
   * In condensed mode this component sits *underneath* a player's own controls, which
   * already carry the timer, the round counter and — if they are competing — the
   * prompt itself. Repeating all of that doubles the scroll on a phone for no
   * information, so the condensed strip drops everything the player already has.
   */
  const timer =
    deadline === null || condensed ? null : (
      <TimerRing seconds={countdown.seconds} fraction={countdown.fraction} label="Time left" />
    );

  const amCompeting = state.you.role === 'COMPETITOR';
  const showPrompt = !condensed || !amCompeting;

  const roundHeader = condensed ? null : (
    <p className="eyebrow">
      Round {'roundNumber' in view ? view.roundNumber : 0} of{' '}
      {'totalRounds' in view ? view.totalRounds : 0}
    </p>
  );

  const advance =
    props.isHost && !condensed ? (
      <ActionButton variant="primary" onClick={props.onAdvance}>
        CONTINUE
      </ActionButton>
    ) : null;

  /**
   * The footer on every screen the room is only watching.
   *
   * Three things that belong together: how long is left, how many people have said
   * they are done, and the host's override. Previously this was the host button alone,
   * so a room waiting on a timer had no idea how long, and a room waiting on one slow
   * reader had no idea who.
   */
  const watchFooter = condensed ? null : (
    <div className="watchfoot">
      {timer}
      {state.you.skipOffered && state.you.skipTotal > 0 && (
        <p className="watchfoot__count" aria-live="polite">
          <strong>{state.you.skipReadyCount}</strong> of {state.you.skipTotal} ready
        </p>
      )}
      {advance}
    </div>
  );

  switch (view.phase) {
    case 'LOBBY':
      return (
        <div className="stack stack--loose">
          <div className="stack center">
            <h1 className={condensed ? 'logo logo--small' : 'logo'}>{brand.name}</h1>
            {!condensed && <p className="tagline">{brand.tagline}</p>}
          </div>
          <div className="stack center">
            <p className="eyebrow">Join at {joinHost(view.joinUrl)}</p>
            <div className="roomcode__panel">
              <span className="roomcode">{state.room.code}</span>
            </div>
            <p className="joinurl muted">{view.joinUrl.length > 0 ? view.joinUrl : `${location.origin}/?room=${state.room.code}`}</p>
          </div>
          {/* The player's own controls already list everybody in the room; the code
              and the join URL are the only parts worth repeating in the strip. */}
          {!condensed && (
            <Card>
              <h2 className="card__title">
                In the room ({state.players.filter((p) => p.identified).length}/10)
              </h2>
              <ul className="roster">
                {state.players
                  .filter((p) => p.identified)
                  .map((player) => (
                    <li key={player.id}>
                      <PlayerChip player={player} badge={player.ready ? 'READY' : undefined} />
                    </li>
                  ))}
              </ul>
              {state.players.filter((p) => p.identified).length === 0 && (
                <p className="muted">Waiting for the first brave soul.</p>
              )}
            </Card>
          )}
        </div>
      );

    case 'GAME_SETUP':
      return (
        <div className="stack center">
          <PhaseTitle eyebrow="Sealed envelope" title="A story has been chosen" />
          <p className="lead center">
            {view.totalRounds} rounds. Nobody is going to tell you what it is about.
          </p>
          {timer}
        </div>
      );

    case 'ROUND_PROMPT':
      return (
        <div className="stack">
          <div className="row row--between">
            {roundHeader}
            {timer}
          </div>
          {showPrompt && (
            <div className="prompt">
              <p className="prompt__text breakable">{view.prompt}</p>
            </div>
          )}
          <div className="stack stack--tight">
            <p className="eyebrow center">Answering</p>
            <ul className="roster row--center">
              {view.competitorIds.map((id) => {
                const player = byId.get(id);
                if (player === undefined) return null;
                return (
                  <li key={id}>
                    <PlayerChip
                      player={player}
                      badge={view.submittedIds.includes(id) ? 'IN' : 'TYPING…'}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      );

    case 'ROUND_WAITING':
      return (
        <div className="stack center">
          <PhaseTitle eyebrow={`Round ${view.roundNumber}`} title="Answers are in" />
          <Waiting message="One of these is about to ruin somebody" />
        </div>
      );

    case 'ROUND_REVEAL':
    case 'ROUND_VOTE':
      return (
        <div className="stack">
          <div className="row row--between">
            {roundHeader}
            {timer}
          </div>
          <div className="prompt">
            <p className="prompt__text breakable">{view.prompt}</p>
          </div>
          {/* The vote screen already lists the answers as buttons; repeating them
              underneath is noise. The reveal is the one beat everybody should read. */}
          {(view.phase === 'ROUND_REVEAL' || !condensed) && (
            <div className="answers answers--wide">
              {view.answers.map((answer) => (
                <div key={answer.id} className="answer breakable">
                  {answer.text}
                </div>
              ))}
            </div>
          )}
          {view.phase === 'ROUND_VOTE' ? (
            <Progress done={view.votesIn} total={view.votersTotal} label="Votes in" />
          ) : (
            watchFooter
          )}
        </div>
      );

    case 'ROUND_RESULTS':
      return (
        <div className="stack">
          <PhaseTitle
            eyebrow={`Round ${view.roundNumber} of ${view.totalRounds}`}
            title={
              view.nobodyVoted
                ? 'NOBODY VOTED. THE UNIVERSE DECIDES.'
                : view.wasCoinFlip
                  ? 'TIE. FLIPPING A COIN.'
                  : view.wasCleanSweep
                    ? 'CLEAN SWEEP'
                    : 'The verdict'
            }
          />
          <div className="answers answers--wide">
            {view.answers.map((answer) => (
              <div
                key={answer.id}
                className="answer breakable"
                data-winner={answer.isWinner}
              >
                {answer.text}
                <div className="answer__meta">
                  <AvatarBadge
                    avatarId={answer.authorAvatarId ?? ''}
                    name={answer.authorName}
                    size="sm"
                    seed={answer.authorId ?? 'house'}
                  />
                  <span className="breakable">
                    {answer.authorName}
                    {answer.isFallback && <span className="faint"> · the house wrote this</span>}
                  </span>
                  <span className="answer__votes">
                    {answer.votes} {answer.votes === 1 ? 'vote' : 'votes'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Scoreboard rows={view.leaderboard} />
          {watchFooter}
        </div>
      );

    case 'STORY_UPDATE':
      return (
        <div className="stack">
          {!condensed && <PhaseTitle eyebrow="The story so far" title="This is what you have done" />}
          {view.stories.map((story) => (
            <StoryView
              key={story.storyId}
              story={story}
              freshSlotIds={view.freshSlotIds}
              {...(props.onCue !== undefined && !condensed ? { onCue: props.onCue } : {})}
            />
          ))}
          {watchFooter}
        </div>
      );

    case 'FINAL_STORY':
      return (
        <div className="stack">
          {!condensed && <PhaseTitle eyebrow="All of it" title="The finished article" />}
          <StoryReadout
            stories={view.stories}
            lineDelayMs={view.lineDelayMs}
            {...(props.onCue !== undefined && !condensed ? { onCue: props.onCue } : {})}
          />
          {watchFooter}
        </div>
      );

    case 'DRAWING_SETUP':
    case 'DRAWING_ACTIVE':
      return (
        <div className="stack center">
          <div className="row row--between">
            <p className="eyebrow">
              {view.phase === 'DRAWING_ACTIVE'
                ? `${view.submittedCount} of ${view.artistTotal} handed in`
                : `${view.artistTotal} drawing at once`}
            </p>
            {timer}
          </div>

          {/* A non-artist's own controls are already the holding screen, tally and
              all, so the condensed strip underneath them would print the same two
              lines twice. An artist sees only a canvas, so for them the strip is
              the one place the count appears — which is why the eyebrow above sits
              outside this guard. */}
          {state.you.role !== 'ARTIST' && !condensed && (
            <>
              <PhaseTitle
                title={
                  view.phase === 'DRAWING_ACTIVE' && view.pendingArtistNames.length > 0
                    ? `${view.pendingArtistNames.join(', ')} still drawing`
                    : 'They are drawing'
                }
                sub="Nobody else knows what."
              />
              <Waiting
                message={
                  view.phase === 'DRAWING_ACTIVE' && view.submittedCount >= view.artistTotal
                    ? 'Everybody is done'
                    : 'Scribbling'
                }
              />
            </>
          )}
        </div>
      );

    case 'DRAWING_GUESS':
      return (
        <div className="stack">
          <div className="row row--between">
            <p className="eyebrow">{view.artistName} drew this</p>
            {timer}
          </div>
          <DrawingFrame url={view.imageUrl} artistName={view.artistName} />
          <Progress done={view.guessesIn} total={view.guessersTotal} label="Guesses in" />
        </div>
      );

    case 'DRAWING_VOTE':
      return (
        <div className="stack">
          <div className="row row--between">
            <PhaseTitle eyebrow="One of these is true" title="Which was the real prompt?" />
            {timer}
          </div>
          <DrawingFrame url={view.imageUrl} artistName={view.artistName} />
          <div className="answers answers--wide">
            {view.options.map((option) => (
              <div key={option.id} className="answer breakable">
                {option.text}
              </div>
            ))}
          </div>
          <Progress done={view.votesIn} total={view.votersTotal} label="Votes in" />
        </div>
      );

    case 'DRAWING_RESULTS':
      return (
        <div className="stack">
          <PhaseTitle
            eyebrow={`Drawing ${view.drawingIndex} of ${view.drawingTotal}`}
            title={view.perfect ? 'Everyone got it' : 'The truth'}
          />
          <DrawingFrame url={view.imageUrl} artistName={view.artistName} />
          <div className="answers answers--wide">
            {view.options.map((option) => (
              <div key={option.id} className="answer breakable" data-winner={option.isReal}>
                {option.text}
                <div className="answer__meta">
                  <span className="breakable">
                    {option.isReal ? '★ THE REAL PROMPT' : `${option.authorName} made this up`}
                  </span>
                  <span className="answer__votes">
                    {option.voterIds.length} {option.voterIds.length === 1 ? 'vote' : 'votes'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {view.unshownArtistCount > 0 && (
            <Card sunken>
              <p className="center">
                <strong>
                  {view.unshownArtistCount} more {view.unshownArtistCount === 1 ? 'drawing' : 'drawings'} we
                  could not get to.
                </strong>{' '}
                No time to show them all — the gallery paid you scale. Every picture is in
                the results.
              </p>
            </Card>
          )}
          <Scoreboard rows={view.leaderboard} />
          {watchFooter}
        </div>
      );

    case 'FINAL_RESULTS':
      return (
        <div className="stack stack--loose">
          {!condensed && <PhaseTitle eyebrow="That is the game" title="Final scores" />}
          {!condensed && <ScoreboardReveal rows={view.leaderboard} />}
          <Awards awards={view.awards} />
          <Highlights highlights={view.highlights} />
          <details>
            <summary className="eyebrow" style={{ cursor: 'pointer' }}>
              Read the whole thing again
            </summary>
            <div className="stack" style={{ marginTop: 'var(--s-4)' }}>
              {view.stories.map((story) => (
                <StoryView key={story.storyId} story={story} />
              ))}
            </div>
          </details>
          {/* The player's own controls carry these when this is a condensed strip;
              rendering them here too put two identical pairs on one screen. */}
          {props.isHost && !condensed && (
            <div className="row row--center">
              <ActionButton variant="primary" onClick={props.onPlayAgain}>
                PLAY AGAIN
              </ActionButton>
              <ActionButton onClick={props.onReturnToLobby}>BACK TO THE LOBBY</ActionButton>
            </div>
          )}
        </div>
      );

    default:
      return <Waiting message="Waiting for the room" />;
  }
}

/** Show just the host part of the join URL — a whole URL is unreadable across a room. */
function joinHost(joinUrl: string): string {
  try {
    return new URL(joinUrl.length > 0 ? joinUrl : location.origin).host;
  } catch {
    return location.host;
  }
}
