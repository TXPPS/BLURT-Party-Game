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
