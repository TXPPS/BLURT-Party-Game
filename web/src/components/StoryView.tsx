/**
 * BLURT — rendering an assembled story.
 *
 * The server sends lines already split into static text and inserted answers, so
 * this component never parses anything — it just decides how each segment looks.
 * Player answers are rendered as children, so React escapes them.
 *
 * Locked sections stay in the DOM (blurred and `aria-hidden`) rather than being
 * removed, so the story visibly has more to come without spoiling it.
 */

import { useEffect, useRef, useState } from 'react';
import type { RenderedStory } from '@shared/types.js';
import { AvatarBadge } from './kit.js';

export function StoryView({
  story,
  freshSlotIds = [],
  showAuthors = true,
}: {
  story: RenderedStory;
  freshSlotIds?: readonly string[];
  showAuthors?: boolean;
}): React.JSX.Element {
  const fresh = new Set(freshSlotIds);

  return (
    <article className="story">
      <h2 className="story__title">{story.title}</h2>
      <p className="story__genre eyebrow">{story.genre}</p>

      {story.sections.map((section) => (
        <section
          key={section.id}
          className={`story__section${section.unlocked ? '' : ' story__locked'}`}
          aria-hidden={section.unlocked ? undefined : true}
        >
          {section.lines.map((line) => (
            <p key={line.lineId} className="story__line breakable">
              {line.segments.map((segment, index) =>
                segment.kind === 'text' ? (
                  <span key={index}>{segment.text}</span>
                ) : (
                  <span
                    key={index}
                    className="fill"
                    data-house={segment.authorId === null}
                    data-fresh={fresh.has(segment.slotId)}
                  >
                    {segment.text}
                    {showAuthors && section.unlocked && (
                      <span className="fill__author">
                        {segment.authorAvatarId !== null && (
                          <AvatarBadge
                            avatarId={segment.authorAvatarId}
                            name={segment.authorName}
                            size="sm"
                            seed={segment.authorId ?? segment.authorName}
                          />
                        )}
                        {segment.authorName}
                      </span>
                    )}
                  </span>
                ),
              )}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}

/**
 * The final read-out, paced line by line.
 *
 * Under `prefers-reduced-motion` the whole story appears at once — the pacing is
 * decoration, and the text is the information.
 */
export function StoryReadout({
  stories,
  lineDelayMs,
  onFinished,
}: {
  stories: readonly RenderedStory[];
  lineDelayMs: number;
  onFinished?: () => void;
}): React.JSX.Element {
  const totalLines = stories.reduce(
    (sum, story) => sum + story.sections.reduce((n, section) => n + section.lines.length, 0),
    0,
  );
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [shown, setShown] = useState(reduced ? totalLines : 0);
  const finishedRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced || shown >= totalLines) {
      if (!finishedRef.current && shown >= totalLines) {
        finishedRef.current = true;
        onFinished?.();
      }
      return;
    }
    const timer = setTimeout(() => setShown((n) => n + 1), lineDelayMs);
    return () => clearTimeout(timer);
  }, [shown, totalLines, lineDelayMs, reduced, onFinished]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'end' });
  }, [shown, reduced]);

  let counter = 0;
  return (
    <div className="stack" aria-live="polite">
      {stories.map((story) => (
        <article className="story" key={story.storyId}>
          <h2 className="story__title">{story.title}</h2>
          <p className="story__genre eyebrow">{story.genre}</p>
          {story.sections.map((section) => (
            <section key={section.id} className="story__section">
              {section.lines.map((line) => {
                const index = counter;
                counter += 1;
                if (index >= shown) return null;
                return (
                  <p
                    key={line.lineId}
                    className="story__line breakable"
                    style={{ animation: 'stamp-in var(--d-slow) var(--ease-spring) both' }}
                  >
                    {line.segments.map((segment, i) =>
                      segment.kind === 'text' ? (
                        <span key={i}>{segment.text}</span>
                      ) : (
                        <span key={i} className="fill" data-house={segment.authorId === null}>
                          {segment.text}
                          <span className="fill__author">{segment.authorName}</span>
                        </span>
                      ),
                    )}
                  </p>
                );
              })}
            </section>
          ))}
        </article>
      ))}
      <div ref={endRef} />
    </div>
  );
}
