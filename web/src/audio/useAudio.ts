/**
 * BLURT — audio wiring.
 *
 * Splits sound into two kinds, because a room full of phones all playing the same
 * sting sounds like a fire alarm:
 *
 *   • **Local UI feedback** (click, submit, vote) plays on the device that caused it.
 *   • **Dramatic cues** (reveal, sting, fanfare) are driven by the server so every
 *     screen lands together — but by default only the shared big screen plays them.
 *     Any device can opt in with a toggle.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MIXER_STORAGE_KEY } from '@shared/constants.js';
import { LOCAL_UI_SFX, isSfxEventId, type SfxEventId } from '@shared/sfx.js';
import type { GameMode } from '@shared/types.js';
import { isPlayableInMode, recipeFor, resolveEvent } from './events.js';
import { Synth, type MixerLevels } from './synth.js';
import { MUSIC_DUCK_SECONDS, MUSIC_LEVEL } from '@shared/constants.js';
import { MusicPlayer, type MusicTrack } from './musicPlayer.js';

const DEFAULT_LEVELS: MixerLevels = { master: 0.7, sfx: 0.9, music: MUSIC_LEVEL, muted: false };

function loadLevels(): MixerLevels {
  try {
    const raw = globalThis.localStorage?.getItem(MIXER_STORAGE_KEY);
    if (raw === null || raw === undefined) return DEFAULT_LEVELS;
    return { ...DEFAULT_LEVELS, ...(JSON.parse(raw) as Partial<MixerLevels>) };
  } catch {
    return DEFAULT_LEVELS;
  }
}

function saveLevels(levels: MixerLevels): void {
  try {
    globalThis.localStorage?.setItem(MIXER_STORAGE_KEY, JSON.stringify(levels));
  } catch {
    // Storage blocked. Volume just will not persist.
  }
}

export interface AudioHandle {
  levels: MixerLevels;
  setLevels(levels: MixerLevels): void;
  /** Play a local UI sound. Always allowed on the device that triggered it. */
  ui(event: SfxEventId): void;
  /** Handle a server-driven cue. Respects the per-device dramatic-audio toggle. */
  cue(event: SfxEventId): void;
  /** Must be called from a real user gesture before anything can make noise. */
  unlock(): void;
  unlocked: boolean;
  /**
   * Choose the music track, or null for silence.
   *
   * Driven by the caller rather than by this hook, because whether a device *should*
   * carry the music is a property of the device (shared screen or one phone in a
   * pocket), not of the audio engine.
   */
  setMusic(track: MusicTrack | null): void;
}

export function useAudio(mode: GameMode, playDramatic: boolean): AudioHandle {
  const synthRef = useRef<Synth | null>(null);
  const [levels, setLevelsState] = useState<MixerLevels>(loadLevels);
  const musicRef = useRef<MusicPlayer | null>(null);
  const levelsRef = useRef(levels);
  levelsRef.current = levels;
  const [unlocked, setUnlocked] = useState(false);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const dramaticRef = useRef(playDramatic);
  dramaticRef.current = playDramatic;

  if (synthRef.current === null) synthRef.current = new Synth();

  useEffect(() => {
    synthRef.current?.setLevels(levels);
    // Mute is the master gain, which the music bus already feeds through — but the
    // slider itself has to reach the player directly.
    musicRef.current?.setLevel(levels.music);
    saveLevels(levels);
  }, [levels]);

  const unlock = useCallback(() => {
    void synthRef.current?.unlock().then(() => setUnlocked(true));
  }, []);

  // The first real gesture anywhere unlocks audio. Browsers require it, and it also
  // means the game never makes a sound before somebody has touched it.
  useEffect(() => {
    const handler = (): void => unlock();
    // Fires on any key, including one typed into a field, and that is correct: typing
    // a name is a gesture, and this listener never calls preventDefault or
    // stopPropagation, so it cannot take a keystroke away from the input it came from.
    // A future window-level *shortcut* would need a focus guard. This is not one.
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [unlock]);

  const play = useCallback((event: SfxEventId) => {
    const synth = synthRef.current;
    if (synth === null) return;
    const currentMode = modeRef.current;
    if (!isPlayableInMode(event, currentMode)) return;
    const recipe = recipeFor(resolveEvent(event, currentMode));
    if (recipe !== null) synth.play(recipe);
  }, []);

  const ui = useCallback(
    (event: SfxEventId) => {
      if (!LOCAL_UI_SFX.has(event)) return;
      play(event);
    },
    [play],
  );

  const cue = useCallback(
    (event: SfxEventId) => {
      if (!isSfxEventId(event)) return;
      if (!dramaticRef.current) return;
      // A sting and music at the same level fight each other, and the sting is the
      // one carrying information. Pull the music down for the length of the moment.
      musicRef.current?.duckFor(MUSIC_DUCK_SECONDS);
      play(event);
    },
    [play],
  );

  const setMusic = useCallback((track: MusicTrack | null) => {
    const synth = synthRef.current;
    if (synth === null) return;

    if (musicRef.current === null) {
      const ctx = synth.context;
      const destination = synth.musicDestination;
      // Before the first user gesture there is no AudioContext, so there is nothing
      // to attach to yet. The next call after unlock will build it.
      if (ctx === null || destination === null) return;
      musicRef.current = new MusicPlayer(ctx, destination);
    }
    void musicRef.current.play(track, levelsRef.current.music);
  }, []);

  return useMemo(
    () => ({ levels, setLevels: setLevelsState, ui, cue, unlock, unlocked, setMusic }),
    [levels, ui, cue, unlock, unlocked, setMusic],
  );
}
