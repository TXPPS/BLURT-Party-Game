/**
 * BLURT — awards and the highlight reel.
 *
 * Everything on this screen is derived from a stat the game actually tracked. An
 * award with no qualifier says so in its own words rather than being hidden or
 * faked — see `shared/awards.ts`, where each one carries its own empty-case line.
 */

import type { Award, HighlightReel } from '@shared/types.js';
import { AvatarBadge, Card, DrawingFrame } from '../components/kit.js';

export function Awards({ awards }: { awards: readonly Award[] }): React.JSX.Element {
  if (awards.length === 0) return <></>;
  return (
    <section className="stack">
      <h2 className="center" style={{ fontSize: 'var(--t-h2)' }}>
        The awards
      </h2>
      <div className="awards">
        {awards.map((award) => (
          <article key={award.id} className="award" data-empty={award.winnerId === null}>
            <h3 className="award__title">{award.title}</h3>
            <p className="award__winner breakable">
              {award.winnerAvatarId !== null && (
                <AvatarBadge
                  avatarId={award.winnerAvatarId}
                  name={award.winnerName}
                  size="sm"
                  seed={award.winnerId ?? award.id}
                />
              )}
              {award.winnerName}
            </p>
            <p className="faint breakable">{award.detail}</p>
            <p className="muted breakable" style={{ marginTop: 'var(--s-2)' }}>
              {award.blurb}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function Highlights({ highlights }: { highlights: HighlightReel }): React.JSX.Element {
  const hasAnything =
    highlights.topAnswers.length > 0 ||
    highlights.gallery.length > 0 ||
    highlights.funniestDrawing !== null ||
    highlights.bestStoryLine !== null;
  if (!hasAnything) return <></>;

  return (
    <section className="stack">
      <h2 className="center" style={{ fontSize: 'var(--t-h2)' }}>
        Highlights
      </h2>

      {highlights.topAnswers.length > 0 && (
        <div className="stack stack--tight">
          <p className="eyebrow center">Most voted answers</p>
          <div className="answers answers--wide">
            {highlights.topAnswers.map((answer, index) => (
              <div key={`${answer.text}-${index}`} className="answer breakable">
                <p className="faint breakable">{answer.promptLabel}</p>
                <p className="lead breakable" style={{ marginTop: 'var(--s-2)' }}>
                  {answer.text}
                </p>
                <div className="answer__meta">
                  {answer.authorAvatarId !== null && (
                    <AvatarBadge
                      avatarId={answer.authorAvatarId}
                      name={answer.authorName}
                      size="sm"
                      seed={answer.authorId ?? 'house'}
                    />
                  )}
                  <span className="breakable">{answer.authorName}</span>
                  <span className="answer__votes">
                    {answer.votes} {answer.votes === 1 ? 'vote' : 'votes'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {highlights.funniestDrawing !== null && (
        <Card tilt="l">
          <div className="stack stack--tight">
            <p className="eyebrow">Most convincing lies told about one drawing</p>
            <DrawingFrame
              url={highlights.funniestDrawing.imageUrl}
              artistName={highlights.funniestDrawing.artistName}
            />
            <p className="row">
              <AvatarBadge
                avatarId={highlights.funniestDrawing.artistAvatarId}
                name={highlights.funniestDrawing.artistName}
                size="sm"
                seed={highlights.funniestDrawing.artistId}
              />
              <span className="breakable">
                {highlights.funniestDrawing.artistName} — {highlights.funniestDrawing.decoyVotesAttracted} people
                picked a lie instead
              </span>
            </p>
          </div>
        </Card>
      )}

      {highlights.gallery.length > 0 && (
        <Card tilt="r">
          <div className="stack stack--tight">
            <p className="eyebrow">
              The gallery{' '}
              {highlights.gallery.some((entry) => !entry.showcased) && (
                <span className="faint">· including the ones there was no time for</span>
              )}
            </p>
            <ul className="gallery">
              {highlights.gallery.map((entry) => (
                <li key={entry.artistId} className="gallery__item">
                  <DrawingFrame url={entry.imageUrl} artistName={entry.artistName} />
                  <p className="gallery__caption">
                    <AvatarBadge
                      avatarId={entry.artistAvatarId}
                      name={entry.artistName}
                      size="sm"
                      seed={entry.artistId}
                    />
                    <span className="breakable">
                      <strong>{entry.artistName}</strong> drew{' '}
                      <span className="gallery__subject">{entry.subject}</span>
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      {highlights.bestStoryLine !== null && (
        <Card tilt="r">
          <div className="stack stack--tight">
            <p className="eyebrow">The line the room chose</p>
            <p className="lead breakable" style={{ fontFamily: 'var(--font-display)' }}>
              “{highlights.bestStoryLine.text}”
            </p>
            <p className="faint">
              {highlights.bestStoryLine.authorName} · {highlights.bestStoryLine.votes} votes
            </p>
          </div>
        </Card>
      )}
    </section>
  );
}
