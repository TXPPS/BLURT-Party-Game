/**
 * BLURT — a connected room.
 *
 * Decides three things and delegates everything else:
 *   1. Does this device still need to identify, or pass the 18+ gate?
 *   2. Is it showing the shared big-screen layout, the player controls, or both?
 *   3. Which errors are fatal enough to replace the game with a screen.
 *
 * Nothing here computes anything about the game itself.
 */

import { useEffect, useState } from 'react';
import { applyBrand } from '../brand.js';
import type { RoomHandle } from '../net/useRoom.js';
import type { DevicePrefs } from '../net/session.js';
import type { MixerLevels } from '../audio/synth.js';
import { AdultGate, DeviceMenu, DeviceMenuButton, Toasts } from '../components/Overlays.js';
import { Button, Card, PlayerChip } from '../components/kit.js';
import { ConnectionBanner, ErrorScreen } from './ErrorScreen.js';
import { GroupView } from './GroupView.js';
import { Identify } from './Identify.js';
import { Lobby } from './Lobby.js';
import { PlayerView } from './PlayerView.js';

export interface RoomProps {
  room: RoomHandle;
  prefs: DevicePrefs;
  onPrefs(next: DevicePrefs): void;
  levels: MixerLevels;
  onLevels(next: MixerLevels): void;
  onSound(): void;
  onHome(): void;
}

export function Room(props: RoomProps): React.JSX.Element {
  const { room, prefs, onPrefs, onSound } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [declinedAdult, setDeclinedAdult] = useState(false);

  const state = room.state;
  const mode = state?.room.settings.mode ?? 'classic';

  // Crude mode is a data-attribute flip plus a swapped palette — never a second UI.
  useEffect(() => {
    applyBrand(mode);
  }, [mode]);

  // Keep the URL shareable and refresh-safe.
  useEffect(() => {
    if (state === null) return;
    const url = new URL(location.href);
    if (url.searchParams.get('room') !== state.room.code) {
      url.searchParams.set('room', state.room.code);
      history.replaceState(null, '', url);
    }
  }, [state]);

  if (room.fatal !== null) {
    return <ErrorScreen code={room.fatal.code} message={room.fatal.message} onHome={props.onHome} />;
  }

  if (state === null) {
    return (
      <main className="page page--narrow page--center">
        <ConnectionBanner status={room.status === 'reconnecting' ? 'reconnecting' : 'connecting'} />
        <Card>
          <p className="lead center">Getting you into the room…</p>
        </Card>
      </main>
    );
  }

  const me = state.players.find((p) => p.id === state.you.playerId);
  const needsGate = state.you.needsAdultGate && !declinedAdult;

  if (needsGate) {
    return (
      <div className="app">
        <AdultGate
          onAccept={() => room.send({ t: 'acknowledge_adult' })}
          onDecline={() => {
            setDeclinedAdult(true);
            props.onHome();
          }}
        />
      </div>
    );
  }

  if (me === undefined || !me.identified) {
    return (
      <div className="app">
        {room.status !== 'open' && (
          <ConnectionBanner status={room.status === 'reconnecting' ? 'reconnecting' : 'connecting'} />
        )}
        <Identify
          mode={mode}
          adultAcknowledged={!state.you.needsAdultGate}
          playerId={state.you.playerId}
          onSound={onSound}
          onSubmit={(name, avatarId) => room.send({ t: 'identify', name, avatarId })}
        />
        <Toasts toasts={room.toasts} />
      </div>
    );
  }

  const groupView = (
    <GroupView
      state={state}
      serverNow={room.serverNow}
      isHost={state.you.isHost}
      onAdvance={() => room.send({ t: 'advance' })}
      onPlayAgain={() => room.send({ t: 'play_again' })}
      onReturnToLobby={() => room.send({ t: 'return_to_lobby' })}
    />
  );

  const controls =
    state.phase === 'LOBBY' ? (
      <Lobby
        view={state.view.phase === 'LOBBY' ? state.view : { phase: 'LOBBY', joinUrl: '', canStart: false, blockReason: null, crudeAcknowledged: false }}
        players={state.players}
        settings={state.room.settings}
        code={state.room.code}
        isHost={state.you.isHost}
        myReady={me.ready}
        onSound={onSound}
        onSettings={(patch) => room.send({ t: 'update_settings', settings: patch })}
        onStart={() => room.send({ t: 'start_game' })}
        onKick={(playerId) => room.send({ t: 'kick_player', playerId })}
        onReady={(ready) => room.send({ t: 'set_ready', ready })}
      />
    ) : (
      <PlayerView
        state={state}
        privateData={room.privateData}
        serverNow={room.serverNow}
        onSound={onSound}
        onAnswer={(roundId, text) => room.send({ t: 'submit_answer', roundId, text })}
        onVote={(roundId, answerId) => room.send({ t: 'submit_vote', roundId, answerId })}
        onDrawing={(roundId, strokesPngDataUrl) =>
          room.send({ t: 'submit_drawing', roundId, strokesPngDataUrl })
        }
        onGuess={(roundId, text) => room.send({ t: 'submit_drawing_guess', roundId, text })}
        onDrawingVote={(roundId, optionId) => room.send({ t: 'submit_drawing_vote', roundId, optionId })}
      />
    );

  const hostBanner =
    state.room.hostMigratesAt !== null ? (
      <div
        role="status"
        style={{
          background: 'var(--c-marigold)',
          border: 'var(--border-thin) solid var(--c-ink)',
          borderRadius: 'var(--r-button)',
          padding: 'var(--s-2) var(--s-3)',
          fontWeight: 600,
        }}
      >
        The host has dropped out. If they are not back shortly, somebody else takes over.
      </div>
    ) : null;

  return (
    <div className={`app${prefs.bigScreen ? ' host-display' : ''}`} data-phase={state.phase}>
      {room.status !== 'open' && (
        <ConnectionBanner status={room.status === 'reconnecting' ? 'reconnecting' : 'connecting'} />
      )}

      <main className={`page${prefs.bigScreen ? '' : ' page--narrow'}`}>
        <div className="row row--between">
          <span className="row" style={{ gap: 'var(--s-2)' }}>
            <span className="eyebrow">ROOM {state.room.code}</span>
            {state.phase !== 'LOBBY' && (
              <span className="eyebrow">
                {state.room.roundNumber}/{state.room.totalRounds}
              </span>
            )}
          </span>
          <span className="row" style={{ gap: 'var(--s-2)' }}>
            <PlayerChip player={me} compact />
            <DeviceMenuButton onOpen={() => setMenuOpen(true)} />
          </span>
        </div>

        {hostBanner}

        {room.notice !== null && (
          <Card sunken>
            <p role="alert" className="breakable">
              {room.notice.message}
            </p>
          </Card>
        )}

        {prefs.bigScreen ? (
          <>
            {groupView}
            <details className="groupview">
              <summary className="groupview__label" style={{ cursor: 'pointer' }}>
                My controls
              </summary>
              <div style={{ marginTop: 'var(--s-4)' }}>{controls}</div>
            </details>
          </>
        ) : (
          <>
            {controls}
            {prefs.showGroupView && (
              <section className="groupview">
                <p className="groupview__label">What the group is seeing</p>
                <GroupView
                  state={state}
                  serverNow={room.serverNow}
                  isHost={state.you.isHost}
                  onAdvance={() => room.send({ t: 'advance' })}
                  onPlayAgain={() => room.send({ t: 'play_again' })}
                  onReturnToLobby={() => room.send({ t: 'return_to_lobby' })}
                  condensed
                />
              </section>
            )}
          </>
        )}

        {state.you.isHost && state.phase === 'FINAL_RESULTS' && !prefs.bigScreen && (
          <div className="row row--center">
            <Button variant="primary" onClick={() => room.send({ t: 'play_again' })}>
              PLAY AGAIN
            </Button>
            <Button onClick={() => room.send({ t: 'return_to_lobby' })}>BACK TO THE LOBBY</Button>
          </div>
        )}
      </main>

      <Toasts toasts={room.toasts} />

      {menuOpen && (
        <DeviceMenu
          levels={props.levels}
          onLevels={props.onLevels}
          prefs={prefs}
          onPrefs={onPrefs}
          canBigScreen
          onLeave={room.leave}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}
