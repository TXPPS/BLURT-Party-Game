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

const DEFAULT_LEVELS: MixerLevels = { master: 0.7, sfx: 0.9, music: 0.35, muted: false };

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
   * Start or stop the music bed.
   *
   * Driven by the caller rather than by this hook, because whether a device *should*
   * carry the music is a property of the device (shared screen or one phone in a
   * pocket), not of the audio engine.
   */
  setMusic(on: boolean, seed?: number): void;
}

export function useAudio(mode: GameMode, playDramatic: boolean): AudioHandle {
  const synthRef = useRef<Synth | null>(null);
  const [levels, setLevelsState] = useState<MixerLevels>(loadLevels);
  const [unlocked, setUnlocked] = useState(false);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const dramaticRef = useRef(playDramatic);
  dramaticRef.current = playDramatic;

  if (synthRef.current === null) synthRef.current = new Synth();

  useEffect(() => {
    synthRef.current?.setLevels(levels);
    saveLevels(levels);
  }, [levels]);

  const unlock = useCallback(() => {
    void synthRef.current?.unlock().then(() => setUnlocked(true));
  }, []);

  // The first real gesture anywhere unlocks audio. Browsers require it, and it also
  // means the game never makes a sound before somebody has touched it.
  useEffect(() => {
    const handler = (): void => unlock();
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
      // A sting and a music bed at the same level fight each other, and the sting is
      // the one carrying information. Pull the bed down for the length of the moment.
      synthRef.current?.duckMusic();
      play(event);
    },
    [play],
  );

  const setMusic = useCallback((on: boolean, seed = 0) => {
    const synth = synthRef.current;
    if (synth === null) return;
    if (on) synth.startMusic(seed);
    else synth.stopMusic();
  }, []);

  return useMemo(
    () => ({ levels, setLevels: setLevelsState, ui, cue, unlock, unlocked, setMusic }),
    [levels, ui, cue, unlock, unlocked, setMusic],
  );
}
