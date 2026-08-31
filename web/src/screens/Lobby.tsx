/**
 * BLURT — the lobby.
 *
 * The room code is the single largest thing on screen, because somebody across the
 * room has to read it off a TV. Everything else is: who is here, what the settings
 * are, and one primary action.
 */

import { ROUND_PRESETS, ROUNDS_MAX, ROUNDS_MIN, TIMER_PRESETS } from '@shared/constants.js';
import type { GameSettings, PublicPlayer } from '@shared/types.js';
import type { LobbyView } from '@shared/views.js';
import { ActionButton, Button, Card, PlayerChip } from '../components/kit.js';

export interface LobbyProps {
  view: LobbyView;
  players: PublicPlayer[];
  settings: GameSettings;
  code: string;
  isHost: boolean;
  onSettings(patch: Partial<GameSettings>): void;
  onStart(): void;
  onKick(playerId: string): void;
  onReady(ready: boolean): void;
  myReady: boolean;
  onSound(event?: 'ui_click' | 'ready'): void;
}

export function Lobby(props: LobbyProps): React.JSX.Element {
  const { view, players, settings, isHost, onSettings, onStart, onKick, onReady, myReady, onSound } = props;
  const named = players.filter((p) => p.identified);

  return (
    <div className="stack">
      <Card>
        <div className="stack">
          <div className="row row--between">
            <h2 className="card__title">Who&apos;s in ({named.length}/10)</h2>
            {!isHost && (
              <ActionButton
                small
                variant={myReady ? 'ghost' : 'primary'}
                onClick={() => {
                  onSound('ready');
                  onReady(!myReady);
                }}
              >
                {myReady ? 'NOT READY' : "I'M READY"}
              </ActionButton>
            )}
          </div>
          <ul className="roster">
            {named.map((player) => (
              <li key={player.id}>
                <PlayerChip player={player} badge={player.isHost ? undefined : player.ready ? 'READY' : 'NOT READY'} />
                {isHost && !player.isHost && (
                  <button
                    className="btn btn--small btn--icon btn--ghost"
                    onClick={() => onKick(player.id)}
                    aria-label={`Remove ${player.name} from the room`}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
            {named.length === 0 && <li className="muted">Nobody yet. Read out the code.</li>}
          </ul>
        </div>
      </Card>

      {isHost ? (
        <>
          <Settings settings={settings} onChange={onSettings} onSound={onSound} />
          <div className="stack stack--tight">
            <ActionButton variant="primary" block onClick={onStart} disabled={!view.canStart}>
              START THE GAME
            </ActionButton>
            {view.blockReason !== null && (
              <p className="faint center" aria-live="polite">
                {view.blockReason}
              </p>
            )}
          </div>
        </>
      ) : (
        <Card sunken>
          <div className="stack stack--tight">
            <p className="eyebrow">Settings</p>
            <p className="lead">
              {settings.mode === 'crude' ? 'Crude' : 'Classic'} · {settings.rounds} rounds ·{' '}
              {TIMER_PRESETS[settings.timerSpeed].label} · Drawing finale{' '}
              {settings.drawingFinale ? 'on' : 'off'}
            </p>
            <p className="faint">Only the host can change these.</p>
          </div>
        </Card>
      )}
    </div>
  );
}

function Settings({
  settings,
  onChange,
  onSound,
}: {
  settings: GameSettings;
  onChange(patch: Partial<GameSettings>): void;
  onSound(event?: 'ui_click' | 'ready'): void;
}): React.JSX.Element {
  const tap = (patch: Partial<GameSettings>): void => {
    onSound();
    onChange(patch);
  };

  return (
    <Card tilt="r">
      <div className="stack">
        <h2 className="card__title">Settings</h2>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label">Mode</legend>
          <div className="row" role="group">
            <Button
              variant={settings.mode === 'classic' ? 'primary' : 'secondary'}
              onClick={() => tap({ mode: 'classic' })}
            >
              CLASSIC
            </Button>
            <Button
              variant={settings.mode === 'crude' ? 'danger' : 'secondary'}
              onClick={() => tap({ mode: 'crude' })}
            >
              CRUDE 18+
            </Button>
          </div>
          <p className="faint" style={{ marginTop: 'var(--s-2)' }}>
            {settings.mode === 'crude'
              ? 'Adult, vulgar, gross-out. Everyone gets asked to confirm.'
              : 'Weird and mischievous, but you could play it with your aunt.'}
          </p>
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label">Rounds</legend>
          <div className="row">
            {ROUND_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                small
                variant={settings.rounds === preset.rounds ? 'primary' : 'secondary'}
                onClick={() => tap({ rounds: preset.rounds })}
              >
                {preset.label} · {preset.rounds}
              </Button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 'var(--s-2)' }}>
            <Button
              small
              icon
              onClick={() => tap({ rounds: Math.max(ROUNDS_MIN, settings.rounds - 1) })}
              ariaLabel="One fewer round"
              disabled={settings.rounds <= ROUNDS_MIN}
            >
              −
            </Button>
            <span
              style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--t-h3)', minWidth: '3ch', textAlign: 'center' }}
              aria-live="polite"
            >
              {settings.rounds}
            </span>
            <Button
              small
              icon
              onClick={() => tap({ rounds: Math.min(ROUNDS_MAX, settings.rounds + 1) })}
              ariaLabel="One more round"
              disabled={settings.rounds >= ROUNDS_MAX}
            >
              +
            </Button>
            <span className="faint">custom, 1–15</span>
          </div>
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label">Timer</legend>
          <div className="row" role="group">
            {(['fast', 'normal', 'relaxed'] as const).map((speed) => (
              <Button
                key={speed}
                small
                variant={settings.timerSpeed === speed ? 'primary' : 'secondary'}
                onClick={() => tap({ timerSpeed: speed })}
              >
                {TIMER_PRESETS[speed].label}
              </Button>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label">Drawing finale</legend>
          <div className="row" role="group">
            <Button
              small
              variant={settings.drawingFinale ? 'primary' : 'secondary'}
              onClick={() => tap({ drawingFinale: true })}
            >
              ON
            </Button>
            <Button
              small
              variant={!settings.drawingFinale ? 'primary' : 'secondary'}
              onClick={() => tap({ drawingFinale: false })}
            >
              OFF
            </Button>
          </div>
        </fieldset>
      </div>
    </Card>
  );
}
