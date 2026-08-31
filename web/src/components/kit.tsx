/**
 * BLURT — the component kit.
 *
 * Every screen is built from these. Two rules hold across all of them:
 *   • Player text is always rendered as children so React escapes it. There is no
 *     `dangerouslySetInnerHTML` anywhere in the repo, and eslint enforces that.
 *   • Identity is never colour alone — a player is always an avatar *and* a name.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { accentFor } from '../brand.js';
import { findAvatar } from '../avatars/registry.js';
import type { PublicPlayer } from '@shared/types.js';

/* ------------------------------------------------------------------ *
 * Avatar
 * ------------------------------------------------------------------ */

export function AvatarBadge({
  avatarId,
  name,
  size = 'md',
  seed,
}: {
  avatarId: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  seed?: string;
}): React.JSX.Element {
  const entry = findAvatar(avatarId);
  const Icon = entry?.Component;
  const accent = accentFor(seed ?? avatarId ?? name);
  const className = `avatar${size === 'sm' ? ' avatar--sm' : size === 'lg' ? ' avatar--lg' : size === 'xl' ? ' avatar--xl' : ''}`;

  return (
    <span
      className={className}
      style={{ ['--avatar-accent' as string]: accent, color: 'var(--c-ink)' }}
      role="img"
      aria-label={entry === undefined ? `${name}'s avatar` : `${name}: ${entry.name}`}
    >
      {Icon === undefined ? <Blank /> : <Icon />}
    </span>
  );
}

function Blank(): React.JSX.Element {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="26" r="11" fill="var(--c-ink)" opacity="0.25" />
      <path d="M12 56c0-11 9-18 20-18s20 7 20 18z" fill="var(--c-ink)" opacity="0.25" />
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * Player chip
 * ------------------------------------------------------------------ */

export function PlayerChip({
  player,
  badge,
  compact = false,
}: {
  player: PublicPlayer;
  badge?: string | undefined;
  /** Tight header slots clamp the name; everywhere else it gets its full 20 chars. */
  compact?: boolean;
}): React.JSX.Element {
  return (
    <span
      className={`chip${compact ? ' chip--compact' : ''}`}
      data-state={player.connected ? 'online' : 'offline'}
    >
      <AvatarBadge avatarId={player.avatarId} name={player.name} size="sm" seed={player.id} />
      <span className="chip__name" title={player.name}>
        {player.name.length > 0 ? player.name : 'Choosing a name…'}
      </span>
      {player.isHost && <span className="chip__badge">HOST</span>}
      {badge !== undefined && <span className="chip__badge">{badge}</span>}
      {!player.connected && <span className="chip__badge">AWAY</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Buttons
 * ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled = false,
  block = false,
  small = false,
  type = 'button',
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  block?: boolean;
  small?: boolean;
  type?: 'button' | 'submit';
  ariaLabel?: string;
}): React.JSX.Element {
  const classes = ['btn'];
  if (variant === 'primary') classes.push('btn--primary');
  if (variant === 'danger') classes.push('btn--danger');
  if (variant === 'ghost') classes.push('btn--ghost');
  if (block) classes.push('btn--block');
  if (small) classes.push('btn--small');

  return (
    <button
      type={type}
      className={classes.join(' ')}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

/**
 * A button that refuses to fire twice in quick succession.
 *
 * The server is idempotent anyway, but a double-tap that visibly does nothing is
 * better UX than one that visibly fires twice — and this is what makes rapid tapping
 * on a phone feel solid rather than broken.
 *
 * **It is never a form submitter.** Disabling itself inside the click handler runs
 * *before* the browser dispatches the form's `submit` event, and a disabled submitter
 * cancels that submission outright — the action silently does nothing. Callers pass
 * the work as `onClick` and wire the form's own `onSubmit` separately for the Enter
 * key. The `type` prop is deliberately forced to `button` to make that impossible to
 * get wrong.
 */
export function ActionButton(
  props: Omit<Parameters<typeof Button>[0], 'type'> & { cooldownMs?: number },
): React.JSX.Element {
  const { onClick, cooldownMs = 600, ...rest } = props;
  const [locked, setLocked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <Button
      {...rest}
      type="button"
      disabled={rest.disabled === true || locked}
      onClick={() => {
        if (locked) return;
        setLocked(true);
        timer.current = setTimeout(() => setLocked(false), cooldownMs);
        onClick?.();
      }}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Timer ring
 * ------------------------------------------------------------------ */

export function TimerRing({
  seconds,
  fraction,
  label,
}: {
  seconds: number;
  fraction: number;
  label: string;
}): React.JSX.Element {
  const urgent = seconds <= 10 && seconds > 0;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="timer" data-urgent={urgent} role="timer" aria-label={`${label}: ${seconds} seconds left`}>
      <svg className="timer__ring" viewBox="0 0 68 68" aria-hidden="true">
        <circle cx="34" cy="34" r={radius} fill="none" stroke="var(--c-card-sunken)" strokeWidth="7" />
        <circle
          cx="34"
          cy="34"
          r={radius}
          fill="none"
          stroke={urgent ? 'var(--c-danger)' : 'var(--c-teal)'}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, fraction)))}
        />
        <circle cx="34" cy="34" r={radius + 4} fill="none" stroke="var(--c-ink)" strokeWidth="3" />
      </svg>
      <span className="timer__value" aria-hidden="true">
        {seconds}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Structure
 * ------------------------------------------------------------------ */

export function PhaseTitle({
  eyebrow,
  title,
  sub,
}: {
  eyebrow?: string;
  title: string;
  sub?: ReactNode;
}): React.JSX.Element {
  return (
    <header className="stack stack--tight center">
      {eyebrow !== undefined && <p className="eyebrow">{eyebrow}</p>}
      <h1 style={{ fontSize: 'var(--t-h2)' }}>{title}</h1>
      {sub !== undefined && <p className="muted lead">{sub}</p>}
    </header>
  );
}

export function Card({
  children,
  tilt,
  sunken = false,
  className = '',
}: {
  children: ReactNode;
  tilt?: 'l' | 'r';
  sunken?: boolean;
  className?: string;
}): React.JSX.Element {
  const classes = ['card'];
  if (tilt === 'l') classes.push('card--tilt-l');
  if (tilt === 'r') classes.push('card--tilt-r');
  if (sunken) classes.push('card--sunken');
  if (className.length > 0) classes.push(className);
  return <div className={classes.join(' ')}>{children}</div>;
}

/** A waiting state with personality, never a dead screen. */
export function Waiting({ message, detail }: { message: string; detail?: ReactNode }): React.JSX.Element {
  return (
    <div className="stack center" role="status">
      <p className="waiting">
        <span>
          {message}
          <span className="dots" aria-hidden="true" />
        </span>
      </p>
      {detail !== undefined && <p className="muted">{detail}</p>}
    </div>
  );
}

export function Progress({ done, total, label }: { done: number; total: number; label: string }): React.JSX.Element {
  const pct = total <= 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="stack stack--tight">
      <div className="row row--between">
        <span className="eyebrow">{label}</span>
        <span className="eyebrow" aria-hidden="true">
          {done}/{total}
        </span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${label}: ${done} of ${total}`}
      >
        <div className="progress__bar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  labelledBy = 'modal-title',
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  labelledBy?: string;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  // Focus moves into the dialog on open, and Escape closes it when closing is allowed.
  useEffect(() => {
    ref.current?.focus();
    if (onClose === undefined) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} ref={ref}>
        <h2 id={labelledBy} style={{ marginBottom: 'var(--s-3)' }}>
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

/** Character counter that turns loud before the limit, not after it. */
export function CharCount({ value, max }: { value: string; max: number }): React.JSX.Element {
  const used = useMemo(() => [...value].length, [value]);
  const warn = used > max * 0.9;
  return (
    <p className={`counter${warn ? ' counter--warn' : ''}`} aria-live="polite">
      {used} / {max}
    </p>
  );
}
