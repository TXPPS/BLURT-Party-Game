/**
 * BLURT — the app shell.
 *
 * Two states: not in a room (the front door), or in one. The room code lives in the
 * URL so a shared link works, a refresh works, and the browser back button does
 * something sensible.
 */

import { useCallback, useEffect, useState } from 'react';
import type { SfxEventId } from '@shared/sfx.js';
import { normalizeRoomCode } from '@shared/sanitize.js';
import { useAudio } from './audio/useAudio.js';
import { loadDevicePrefs, playsDramaticSfx, saveDevicePrefs, type DevicePrefs } from './net/session.js';
import { useRoom } from './net/useRoom.js';
import { Home } from './screens/Home.js';
import { Room } from './screens/Room.js';
import { UnsupportedScreen, unsupportedBrowser } from './screens/ErrorScreen.js';
import type { GameMode } from '@shared/types.js';
import type { MusicTrack } from './audio/musicPlayer.js';
import { LOBBY_PHASES } from './audio/musicPhases.js';

interface Target {
  code: string;
  intent: 'create' | 'join';
  mode: GameMode | null;
}

function targetFromUrl(): Target | null {
  const code = normalizeRoomCode(new URL(location.href).searchParams.get('room') ?? '');
  return code.length === 4 ? { code, intent: 'join', mode: null } : null;
}

export function App(): React.JSX.Element {
  const [target, setTarget] = useState<Target | null>(targetFromUrl);
  const [prefs, setPrefs] = useState<DevicePrefs>(loadDevicePrefs);

  // Back/forward between the front door and a room.
  useEffect(() => {
    const onPop = (): void => setTarget(targetFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const updatePrefs = useCallback((next: DevicePrefs) => {
    setPrefs(next);
    saveDevicePrefs(next);
  }, []);

  // `isHost` only becomes known once the room answers, so the audio hook is fed the
  // resolved value each render rather than a value frozen at mount.
  const [isHost, setIsHost] = useState(false);
  const audio = useAudio('classic', playsDramaticSfx(prefs, isHost));
  const onCue = useCallback((event: SfxEventId) => audio.cue(event), [audio]);
  const room = useRoom(target?.code ?? null, target?.intent ?? 'join', target?.mode ?? null, onCue);

  const hostNow = room.state?.you.isHost ?? false;
  useEffect(() => setIsHost(hostNow), [hostNow]);

  /**
   * Which of the two tracks belongs to the screen we are on.
   *
   * The split is "is anybody under time pressure": lobby music covers the screens
   * where people are arriving, reading or gloating, and game music covers the ones
   * with a clock. FINAL_RESULTS goes back to the lobby track deliberately — the match
   * is over and the room is talking again.
   */
  const musicTrack = ((): MusicTrack | null => {
    const phase = room.state?.phase;
    if (phase === undefined) return 'lobby';
    return LOBBY_PHASES.has(phase) ? 'lobby' : 'game';
  })();

  /**
   * Music plays on whichever device is carrying the room for everybody — the host's
   * screen, or anything switched to the big-screen layout — and stays off on a
   * pocketful of phones, which would be six copies of one loop drifting out of sync.
   * Same rule as the dramatic stings, for the same reason.
   */
  const carriesMusic = playsDramaticSfx(prefs, hostNow);
  useEffect(() => {
    if (!audio.unlocked) return;
    audio.setMusic(carriesMusic ? musicTrack : null);
  }, [audio, carriesMusic, musicTrack]);

  const goHome = useCallback(() => {
    const url = new URL(location.href);
    url.searchParams.delete('room');
    history.pushState(null, '', url);
    setTarget(null);
  }, []);

  const enter = useCallback((code: string, intent: 'create' | 'join', mode: GameMode | null = null) => {
    const url = new URL(location.href);
    url.searchParams.set('room', code);
    history.pushState(null, '', url);
    setTarget({ code, intent, mode });
  }, []);

  if (unsupportedBrowser()) return <UnsupportedScreen />;

  if (target === null) {
    return (
      <div className="app">
        <Home onCreate={(code, mode) => enter(code, 'create', mode)} onJoin={(code) => enter(code, 'join')} />
      </div>
    );
  }

  return (
    <Room
      key={target.code}
      room={room}
      prefs={prefs}
      onPrefs={updatePrefs}
      levels={audio.levels}
      onLevels={audio.setLevels}
      onSound={(event) => audio.ui(event ?? 'ui_click')}
      onCue={(event) => audio.cue(event)}
      onHome={goHome}
    />
  );
}
