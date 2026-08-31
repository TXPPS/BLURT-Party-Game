/**
 * BLURT — overlays: the 18+ gate, the sound mixer and the device menu.
 */

import { useState } from 'react';
import type { MixerLevels } from '../audio/synth.js';
import type { DevicePrefs } from '../net/session.js';
import { Button, Modal } from './kit.js';

/**
 * The Crude gate. Shown once per device per session, with real hazard-tape styling
 * and an acknowledgement that has to be tapped — not a checkbox that can be missed.
 */
export function AdultGate({
  onAccept,
  onDecline,
}: {
  onAccept(): void;
  onDecline(): void;
}): React.JSX.Element {
  return (
    <Modal title="CRUDE MODE — 18+" labelledBy="adult-gate-title">
      <div className="stack">
        <div className="hazard" aria-hidden="true" />
        <p className="lead">
          This room is playing in Crude mode. The prompts, the stories, the names and the pictures
          are adult, vulgar and frequently disgusting.
        </p>
        <p className="muted">
          Nothing sexualising minors, nothing non-consensual, and nothing aimed at who anybody is.
          Everything else is fair game.
        </p>
        <Button variant="danger" block onClick={onAccept}>
          I AM 18 OR OVER — LET ME IN
        </Button>
        <Button variant="ghost" block onClick={onDecline}>
          NO THANKS
        </Button>
        <div className="hazard" aria-hidden="true" />
      </div>
    </Modal>
  );
}

export function DeviceMenu({
  levels,
  onLevels,
  prefs,
  onPrefs,
  onLeave,
  onClose,
  canBigScreen,
}: {
  levels: MixerLevels;
  onLevels(next: MixerLevels): void;
  prefs: DevicePrefs;
  onPrefs(next: DevicePrefs): void;
  onLeave(): void;
  onClose(): void;
  canBigScreen: boolean;
}): React.JSX.Element {
  return (
    <Modal title="This device" onClose={onClose}>
      <div className="stack">
        <Slider
          label="Master volume"
          value={levels.master}
          onChange={(master) => onLevels({ ...levels, master })}
        />
        <Slider
          label="Sound effects"
          value={levels.sfx}
          onChange={(sfx) => onLevels({ ...levels, sfx })}
        />
        <Slider
          label="Music"
          value={levels.music}
          onChange={(music) => onLevels({ ...levels, music })}
        />
        <Toggle
          label="Mute everything"
          checked={levels.muted}
          onChange={(muted) => onLevels({ ...levels, muted })}
        />

        <hr style={{ border: 0, borderTop: 'var(--border-thin) dashed var(--c-ink-faint)' }} />

        <Toggle
          label="Play the dramatic sounds on this device"
          hint="Off by default so a room full of phones does not echo. Turn it on if this is the only screen."
          checked={prefs.playDramaticSfx}
          onChange={(playDramaticSfx) => onPrefs({ ...prefs, playDramaticSfx })}
        />
        <Toggle
          label="Show what the group is seeing"
          hint="Adds a condensed version of the shared screen under your controls."
          checked={prefs.showGroupView}
          onChange={(showGroupView) => onPrefs({ ...prefs, showGroupView })}
        />
        {canBigScreen && (
          <Toggle
            label="Use this device as the big screen"
            hint="Full shared-screen layout. Your own controls move to the bottom."
            checked={prefs.bigScreen}
            onChange={(bigScreen) => onPrefs({ ...prefs, bigScreen })}
          />
        )}

        <hr style={{ border: 0, borderTop: 'var(--border-thin) dashed var(--c-ink-faint)' }} />

        <Button variant="danger" block onClick={onLeave}>
          LEAVE THE ROOM
        </Button>
        <Button variant="ghost" block onClick={onClose}>
          DONE
        </Button>
      </div>
    </Modal>
  );
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange(value: number): void;
}): React.JSX.Element {
  const id = `slider-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label} — {Math.round(value * 100)}%
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: '100%', minHeight: 'var(--tap-min)' }}
      />
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange(value: boolean): void;
}): React.JSX.Element {
  return (
    <div className="stack stack--tight">
      <Button block variant={checked ? 'primary' : 'secondary'} onClick={() => onChange(!checked)}>
        <span aria-hidden="true">{checked ? '☑' : '☐'}</span> {label}
      </Button>
      {hint !== undefined && <p className="faint">{hint}</p>}
    </div>
  );
}

/** The floating settings button that opens the device menu. */
export function DeviceMenuButton({ onOpen }: { onOpen(): void }): React.JSX.Element {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      className="btn btn--small btn--icon"
      onClick={onOpen}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      aria-label="This device: sound and display settings"
      style={{ position: 'relative' }}
    >
      <span aria-hidden="true">⚙</span>
      {hovered && <span className="visually-hidden">Settings</span>}
    </button>
  );
}

export function Toasts({
  toasts,
}: {
  toasts: readonly { id: number; kind: string; message: string }[];
}): React.JSX.Element {
  return (
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast breakable" data-kind={toast.kind}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
