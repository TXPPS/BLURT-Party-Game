/**
 * BLURT — the scoreboard.
 *
 * Two modes: a plain live table used between rounds, and a dramatic bottom-up reveal
 * for the end of the match. The reveal counts scores up, so the number climbing is
 * the last thing anybody watches before the awards.
 */

import { useEffect, useRef, useState } from 'react';
import type { LeaderboardRow } from '@shared/views.js';
import { AvatarBadge } from './kit.js';

export function Scoreboard({ rows, showDelta = true }: { rows: readonly LeaderboardRow[]; showDelta?: boolean }): React.JSX.Element {
  return (
    <ol className="scores">
      {rows.map((row) => (
        <li key={row.playerId} className="score" data-rank={row.rank} data-offline={!row.connected}>
          <span className="score__rank" aria-hidden="true">
            {row.rank}
          </span>
          <AvatarBadge avatarId={row.avatarId} name={row.name} size="sm" seed={row.playerId} />
          <span className="score__name" title={row.name}>
            {row.name}
            {!row.connected && <span className="faint"> · away</span>}
          </span>
          <span className="row" style={{ gap: 'var(--s-2)', flexWrap: 'nowrap' }}>
            {showDelta && row.delta > 0 && <span className="score__delta">+{row.delta}</span>}
            <span className="score__points">{row.score}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Bottom-up reveal: last place first, one row at a time, each score counting up from
 * zero. Reduced motion shows the finished table immediately.
 */
export function ScoreboardReveal({ rows }: { rows: readonly LeaderboardRow[] }): React.JSX.Element {
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ordered = [...rows].reverse();
  const [revealed, setRevealed] = useState(reduced ? ordered.length : 0);

  useEffect(() => {
    if (reduced || revealed >= ordered.length) return;
    const timer = setTimeout(() => setRevealed((n) => n + 1), 900);
    return () => clearTimeout(timer);
  }, [revealed, ordered.length, reduced]);

  return (
    <ol className="scores" aria-label="Final scores">
      {ordered.slice(0, revealed).map((row) => (
        <li
          key={row.playerId}
          className="score"
          data-rank={row.rank}
          data-offline={!row.connected}
          style={{ animation: 'stamp-in var(--d-slow) var(--ease-spring) both' }}
        >
          <span className="score__rank" aria-hidden="true">
            {row.rank}
          </span>
          <AvatarBadge avatarId={row.avatarId} name={row.name} size="sm" seed={row.playerId} />
          <span className="score__name" title={row.name}>
            {row.name}
          </span>
          <span className="score__points">
            <CountUp to={row.score} instant={reduced} />
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Animates a number up to its target. The final value is always exact. */
function CountUp({ to, instant }: { to: number; instant: boolean }): React.JSX.Element {
  const [value, setValue] = useState(instant ? to : 0);
  const frameRef = useRef(0);

  useEffect(() => {
    if (instant) {
      setValue(to);
      return;
    }
    const started = performance.now();
    const duration = 700;
    const tick = (): void => {
      const progress = Math.min(1, (performance.now() - started) / duration);
      // Ease-out so it decelerates into the real number rather than snapping.
      setValue(Math.round(to * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [to, instant]);

  return <>{value}</>;
}
