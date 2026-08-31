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
import { loadDevicePrefs, saveDevicePrefs, type DevicePrefs } from './net/session.js';
import { useRoom } from './net/useRoom.js';
import { Home } from './screens/Home.js';
import { Room } from './screens/Room.js';
import { UnsupportedScreen, unsupportedBrowser } from './screens/ErrorScreen.js';

interface Target {
  code: string;
  intent: 'create' | 'join';
}

function targetFromUrl(): Target | null {
  const code = normalizeRoomCode(new URL(location.href).searchParams.get('room') ?? '');
  return code.length === 4 ? { code, intent: 'join' } : null;
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

  const audio = useAudio('classic', prefs.playDramaticSfx);
  const onCue = useCallback((event: SfxEventId) => audio.cue(event), [audio]);
  const room = useRoom(target?.code ?? null, target?.intent ?? 'join', onCue);

  const goHome = useCallback(() => {
    const url = new URL(location.href);
    url.searchParams.delete('room');
    history.pushState(null, '', url);
    setTarget(null);
  }, []);

  const enter = useCallback((code: string, intent: 'create' | 'join') => {
    const url = new URL(location.href);
    url.searchParams.set('room', code);
    history.pushState(null, '', url);
    setTarget({ code, intent });
  }, []);

  if (unsupportedBrowser()) return <UnsupportedScreen />;

  if (target === null) {
    return (
      <div className="app">
        <Home onCreate={(code) => enter(code, 'create')} onJoin={(code) => enter(code, 'join')} />
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
      onSound={() => audio.ui('ui_click')}
      onHome={goHome}
    />
  );
}
