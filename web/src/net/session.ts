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
  /** This device plays the dramatic stings (default: only the big screen does). */
  playDramaticSfx: boolean;
  /** Show the condensed group view under the player controls. */
  showGroupView: boolean;
  /** Render the shared big-screen layout instead of the player controls. */
  bigScreen: boolean;
}

export const DEFAULT_DEVICE_PREFS: DevicePrefs = {
  playDramaticSfx: false,
  showGroupView: true,
  bigScreen: false,
};

export function loadDevicePrefs(): DevicePrefs {
  const stored = readJson<Partial<DevicePrefs>>(globalThis.localStorage, DEVICE_PREFS_STORAGE_KEY);
  return { ...DEFAULT_DEVICE_PREFS, ...(stored ?? {}) };
}

export function saveDevicePrefs(prefs: DevicePrefs): void {
  writeJson(globalThis.localStorage, DEVICE_PREFS_STORAGE_KEY, prefs);
}
