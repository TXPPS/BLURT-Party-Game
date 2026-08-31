/**
 * BLURT — the room hook.
 *
 * One hook owns the socket, the last state broadcast, the last private payload, the
 * toast queue and the connection status. Screens read from it and send intents
 * through it; none of them touch a socket, and none of them compute a score.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ClientMessage, ErrorCode, PrivateMessage, ServerMessage, StateMessage } from '@shared/protocol.js';
import type { SfxEventId } from '@shared/sfx.js';
import type { Phase } from '@shared/types.js';
import { RoomSocket, type ConnectionStatus } from './socket.js';
import type { GameMode } from '@shared/types.js';
import { clearSession } from './session.js';

export interface Toast {
  id: number;
  kind: 'info' | 'good' | 'bad' | 'host';
  message: string;
}

export interface FatalError {
  code: ErrorCode;
  message: string;
}

export interface RoomHandle {
  status: ConnectionStatus;
  state: StateMessage | null;
  privateData: PrivateMessage | null;
  toasts: Toast[];
  fatal: FatalError | null;
  /** Non-fatal error for the current screen, cleared on the next state change. */
  notice: FatalError | null;
  send(message: ClientMessage): void;
  /** Server time, corrected for this device's clock skew. */
  serverNow(): number;
  leave(): void;
  dismissToast(id: number): void;
}

/** How long a toast stays on screen. */
const TOAST_MS = 4200;

/**
 * Countdown updates are quantised to this. At the longest phase (120s) that is ~240
 * updates over the whole phase rather than ~7,200.
 */
const RING_QUANTUM_MS = 500;

export function useRoom(
  code: string | null,
  intent: 'create' | 'join',
  createMode: GameMode | null,
  onSfx: (event: SfxEventId) => void,
): RoomHandle {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [state, setState] = useState<StateMessage | null>(null);
  /**
   * The private payload is stamped with the phase it arrived during.
   *
   * `state` and `private` are two frames that land in the same tick, and React
   * batches them — so clearing the payload from a phase-change effect would race
   * with the payload that just arrived and could wipe the live prompt. Tagging it
   * instead makes staleness a comparison rather than a timing question.
   */
  const [privateSlot, setPrivateSlot] = useState<{ phase: Phase | null; data: PrivateMessage } | null>(
    null,
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [fatal, setFatal] = useState<FatalError | null>(null);
  const [notice, setNotice] = useState<FatalError | null>(null);

  const socketRef = useRef<RoomSocket | null>(null);
  const latestPhase = useRef<Phase | null>(null);
  const toastSeq = useRef(0);
  const sfxRef = useRef(onSfx);
  sfxRef.current = onSfx;

  useEffect(() => {
    if (code === null) return;

    const socket = new RoomSocket(code, intent, createMode, {
      onStatus: setStatus,
      onMessage: (message: ServerMessage) => {
        switch (message.t) {
          case 'state':
            latestPhase.current = message.phase;
            setState(message);
            // A phase change invalidates any error about the previous phase.
            setNotice(null);
            break;
          case 'private':
            setPrivateSlot({ phase: latestPhase.current, data: message });
            break;
          case 'toast': {
            toastSeq.current += 1;
            const toast: Toast = { id: toastSeq.current, kind: message.kind, message: message.message };
            // Cap the stack: a burst of joins must never bury the controls underneath.
            setToasts((current) => [...current, toast].slice(-3));
            setTimeout(
              () => setToasts((current) => current.filter((t) => t.id !== toast.id)),
              TOAST_MS,
            );
            break;
          }
          case 'sfx':
            sfxRef.current(message.eventId as SfxEventId);
            break;
          case 'error':
            if (message.fatal) setFatal({ code: message.code, message: message.message });
            else setNotice({ code: message.code, message: message.message });
            break;
          default:
            break;
        }
      },
    });

    socketRef.current = socket;
    socket.connect();
    return () => {
      socket.close();
      socketRef.current = null;
    };
    // `intent` is captured once on purpose: re-running this effect would tear the
    // socket down mid-match, and after the first handshake the intent is history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // A payload from a phase the room has left is simply not surfaced, so a stale
  // prompt can never be answered into the round that replaced it.
  const privateData =
    privateSlot !== null && state !== null && privateSlot.phase === state.phase
      ? privateSlot.data
      : null;

  const send = useCallback((message: ClientMessage) => {
    socketRef.current?.send(message);
  }, []);

  const serverNow = useCallback(() => socketRef.current?.now() ?? Date.now(), []);

  const leave = useCallback(() => {
    clearSession();
    socketRef.current?.close();
    location.href = '/';
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  return useMemo(
    () => ({ status, state, privateData, toasts, fatal, notice, send, serverNow, leave, dismissToast }),
    [status, state, privateData, toasts, fatal, notice, send, serverNow, leave, dismissToast],
  );
}

/**
 * Countdown against a server deadline, ticking locally.
 *
 * The server never sends the time remaining — it sends an absolute deadline once,
 * and this counts down against it. That is the whole reason a 10-player room does
 * not generate a broadcast every second.
 */
export function useCountdown(
  endsAt: number | null,
  serverNow: () => number,
  onExpire?: () => void,
): { remainingMs: number; fraction: number; seconds: number } {
  const [remainingMs, setRemainingMs] = useState(() =>
    endsAt === null ? 0 : Math.max(0, endsAt - serverNow()),
  );
  const startedRef = useRef<number>(remainingMs);
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (endsAt === null) {
      setRemainingMs(0);
      return;
    }
    expiredRef.current = false;
    startedRef.current = Math.max(1, endsAt - serverNow());

    let frame = 0;
    let lastPushed = -1;
    const tick = (): void => {
      const left = Math.max(0, endsAt - serverNow());
      // Only re-render when something *visible* changes.
      //
      // Setting state every animation frame re-renders the whole screen 60 times a
      // second for a number that changes once a second, which is exactly the kind of
      // thing that makes a mid-range Android phone feel broken. The ring is quantised
      // to 200 steps, which is finer than a pixel on any real device.
      const quantised = Math.round(left / RING_QUANTUM_MS);
      if (quantised !== lastPushed) {
        lastPushed = quantised;
        setRemainingMs(left);
      }
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpireRef.current?.();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [endsAt, serverNow]);

  const total = startedRef.current;
  return {
    remainingMs,
    fraction: total <= 0 ? 0 : Math.min(1, Math.max(0, remainingMs / total)),
    seconds: Math.ceil(remainingMs / 1000),
  };
}
