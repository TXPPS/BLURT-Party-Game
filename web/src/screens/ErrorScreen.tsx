/**
 * BLURT — designed error states.
 *
 * Every failure the protocol can produce has a screen here with copy a player can
 * act on and exactly one working button. None of them show a code, a stack trace or
 * an internal id — `ERROR_COPY` in the protocol is the single source of that wording,
 * so the client and server never disagree about what went wrong.
 */

import { brand } from '../brand.js';
import { ERROR_COPY, type ErrorCode } from '@shared/protocol.js';
import { Button, Card } from '../components/kit.js';

export interface ErrorScreenProps {
  code: ErrorCode;
  /** Server-supplied detail, which is already player-facing. */
  message?: string;
  onRetry?: () => void;
  onHome(): void;
}

/** Which errors are worth offering a retry for, versus starting over. */
const RETRYABLE: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  'SERVER_ERROR',
  'SESSION_NOT_RESTORED',
  'ROOM_NOT_FOUND',
]);

export function ErrorScreen({ code, message, onRetry, onHome }: ErrorScreenProps): React.JSX.Element {
  const copy = ERROR_COPY[code];
  const showRetry = onRetry !== undefined && RETRYABLE.has(code);

  return (
    <main className="page page--narrow page--center">
      <div className="stack stack--loose center">
        <h1 className="logo logo--small">{brand.name}</h1>
        <Card tilt="l">
          <div className="stack">
            <h2 style={{ fontSize: 'var(--t-h2)' }}>{copy.title}</h2>
            <p className="lead breakable">{message ?? copy.body}</p>
            {showRetry && (
              <Button variant="primary" block onClick={onRetry}>
                TRY AGAIN
              </Button>
            )}
            <Button variant={showRetry ? 'secondary' : 'primary'} block onClick={onHome}>
              {code === 'ROOM_FULL' || code === 'GAME_ALREADY_STARTED' ? 'BACK TO THE START' : 'START OVER'}
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}

/** Connection banner, shown over the game rather than replacing it. */
export function ConnectionBanner({ status }: { status: 'connecting' | 'reconnecting' }): React.JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'var(--c-marigold)',
        borderBottom: 'var(--border) solid var(--c-ink)',
        padding: 'var(--s-2) var(--s-3)',
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        textAlign: 'center',
      }}
    >
      {status === 'connecting' ? 'Connecting…' : 'Lost the connection — getting you back in…'}
    </div>
  );
}

/**
 * The browser-support gate. WebSocket has been universal for a decade, but a
 * locked-down or ancient browser should get a sentence rather than a blank page.
 */
export function unsupportedBrowser(): boolean {
  return typeof WebSocket === 'undefined' || typeof globalThis.fetch !== 'function';
}

export function UnsupportedScreen(): React.JSX.Element {
  return (
    <main className="page page--narrow page--center">
      <div className="stack center">
        <h1 className="logo logo--small">{brand.name}</h1>
        <Card>
          <div className="stack">
            <h2>This browser cannot play</h2>
            <p className="lead">
              {brand.name} needs WebSockets, which this browser does not have. Any current version of
              Chrome, Safari, Firefox or Edge will work.
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
