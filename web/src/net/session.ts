/**
 * BLURT — session persistence.
 *
 * `sessionStorage`, not `localStorage`, and that is a security decision rather than
 * a stylistic one: a second tab must be a *new player*, not a second window onto the
 * same identity. Storing the reconnect token per-tab makes tab-hijacking impossible
 * by construction.
 */

import { DEVICE_PREFS_STORAGE_KEY, SESSION_STORAGE_KEY } from '@shared/constants.js';

export interface StoredSession {
  roomCode: string;
  playerId: string;
  token: string;
}

function readJson<T>(storage: Storage | undefined, key: string): T | null {
  try {
    const raw = storage?.getItem(key);
    return raw === null || raw === undefined ? null : (JSON.parse(raw) as T);
  } catch {
    // Private browsing, disabled storage, or corrupt JSON — behave like a fresh tab.
    return null;
  }
}

function writeJson(storage: Storage | undefined, key: string, value: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked. The game still works; reconnect just will not.
  }
}

export function loadSession(): StoredSession | null {
  const stored = readJson<StoredSession>(globalThis.sessionStorage, SESSION_STORAGE_KEY);
  if (stored === null) return null;
  if (
    typeof stored.roomCode !== 'string' ||
    typeof stored.playerId !== 'string' ||
    typeof stored.token !== 'string'
  ) {
    return null;
  }
  return stored;
}

export function saveSession(session: StoredSession): void {
  writeJson(globalThis.sessionStorage, SESSION_STORAGE_KEY, session);
}

export function clearSession(): void {
  try {
    globalThis.sessionStorage?.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}

/* ------------------------------------------------------------------ *
 * Device preferences — these are genuinely per-device, so localStorage is right.
 * ------------------------------------------------------------------ */

export interface DevicePrefs {
  /**
   * Whether this device plays the server-driven dramatic stings.
   *
   * `null` means "decide for me", which is the default and resolves to: yes if this
   * device is the host or is showing the big-screen layout, no otherwise. That is the
   * behaviour the design asks for — the shared screen carries the drama, and a room
   * full of phones does not echo it — while still letting a fully remote player turn
   * it on for themselves. Once somebody touches the toggle their choice sticks.
   */
  playDramaticSfx: boolean | null;
  /** Show the condensed group view under the player controls. */
  showGroupView: boolean;
  /** Render the shared big-screen layout instead of the player controls. */
  bigScreen: boolean;
}

export const DEFAULT_DEVICE_PREFS: DevicePrefs = {
  playDramaticSfx: null,
  showGroupView: true,
  bigScreen: false,
};

/** Resolve the `null` ("decide for me") case against what this device actually is. */
export function playsDramaticSfx(prefs: DevicePrefs, isHost: boolean): boolean {
  return prefs.playDramaticSfx ?? (isHost || prefs.bigScreen);
}

export function loadDevicePrefs(): DevicePrefs {
  const stored = readJson<Partial<DevicePrefs>>(globalThis.localStorage, DEVICE_PREFS_STORAGE_KEY);
  return { ...DEFAULT_DEVICE_PREFS, ...(stored ?? {}) };
}

export function saveDevicePrefs(prefs: DevicePrefs): void {
  writeJson(globalThis.localStorage, DEVICE_PREFS_STORAGE_KEY, prefs);
}
