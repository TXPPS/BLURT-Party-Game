/**
 * BLURT — name and avatar.
 *
 * The random name generator is the first thing a player touches, so it is
 * deliberately the loudest control on the screen. It runs entirely on the device —
 * the pools are pure data and `generateName` is a pure function, so NAME ME is
 * instant and works before the socket has even settled.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { NAME_MAX_LENGTH } from '@shared/constants.js';
import { generateName, mergePools, type NamePools } from '@shared/nameGenerator.js';
import { clampWhileTyping, textLength } from '@shared/sanitize.js';
import { makeRng, seedFromString } from '@shared/rng.js';
import { classicNamePools } from '@content/classic/names.js';
import type { GameMode } from '@shared/types.js';
import { AvatarBadge, Button, CharCount, Card, Modal } from '../components/kit.js';
import { classicAvatars, defaultAvatarId, loadCrudeAvatars, type AvatarEntry } from '../avatars/registry.js';

export interface IdentifyProps {
  mode: GameMode;
  adultAcknowledged: boolean;
  onSubmit(name: string, avatarId: string): void;
  onSound(event?: 'ui_click' | 'join'): void;
  playerId: string;
}

export function Identify({ mode, adultAcknowledged, onSubmit, onSound, playerId }: IdentifyProps): React.JSX.Element {
  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState(() => defaultAvatarId(playerId));
  const [nameModal, setNameModal] = useState(false);
  const [avatars, setAvatars] = useState<AvatarEntry[]>(classicAvatars);
  const [crudePools, setCrudePools] = useState<NamePools | null>(null);

  const crudeUnlocked = mode === 'crude' && adultAcknowledged;

  // The crude packs are separate chunks and only ever fetched here, once the room is
  // in Crude mode and this device has passed the gate.
  useEffect(() => {
    if (!crudeUnlocked) {
      setAvatars(classicAvatars);
      return;
    }
    let cancelled = false;
    void loadCrudeAvatars().then((pack) => {
      if (!cancelled) setAvatars([...classicAvatars, ...pack]);
    });
    void import('@content/crude/names.js').then((module) => {
      if (!cancelled) setCrudePools(module.crudeNamePools);
    });
    return () => {
      cancelled = true;
    };
  }, [crudeUnlocked]);

  const valid = textLength(name.trim()) > 0 && textLength(name) <= NAME_MAX_LENGTH;

  return (
    <main className="page page--narrow">
      <div className="stack">
        <header className="stack stack--tight center">
          <p className="eyebrow">Who are you</p>
          <h1 style={{ fontSize: 'var(--t-h2)' }}>Pick a name and a face</h1>
        </header>

        <Card>
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              if (!valid) return;
              onSound('join');
              onSubmit(name.trim(), avatarId);
            }}
          >
            <div className="field">
              <label className="field__label" htmlFor="player-name">
                Your name
              </label>
              <input
                id="player-name"
                className="input"
                value={name}
                onChange={(event) => setName(clampWhileTyping(event.target.value, NAME_MAX_LENGTH))}
                maxLength={NAME_MAX_LENGTH * 2}
                placeholder="Suspicious Gary"
                autoComplete="off"
                enterKeyHint="done"
              />
              <CharCount value={name} max={NAME_MAX_LENGTH} />
            </div>

            <Button
              block
              onClick={() => {
                onSound();
                setNameModal(true);
              }}
            >
              🎲 NAME ME
            </Button>

            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="field__label" style={{ marginBottom: 'var(--s-2)' }}>
                Your face
              </legend>
              <div className="roster roster--grid" role="radiogroup" aria-label="Choose an avatar">
                {avatars.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    role="radio"
                    aria-checked={avatar.id === avatarId}
                    className="btn"
                    style={{
                      flexDirection: 'column',
                      gap: 'var(--s-2)',
                      padding: 'var(--s-3) var(--s-2)',
                      background:
                        avatar.id === avatarId ? 'var(--c-marigold)' : 'var(--c-card)',
                    }}
                    onClick={() => {
                      onSound();
                      setAvatarId(avatar.id);
                    }}
                  >
                    <AvatarBadge avatarId={avatar.id} name={avatar.name} seed={avatar.id} />
                    <span style={{ fontSize: 'var(--t-small)' }}>{avatar.name}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <Button variant="primary" block type="submit" disabled={!valid}>
              THAT&apos;S ME
            </Button>
          </form>
        </Card>
      </div>

      {nameModal && (
        <NameMeModal
          allowCrude={crudeUnlocked}
          crudePools={crudePools}
          onSound={onSound}
          onClose={() => setNameModal(false)}
          onUse={(picked) => {
            setName(picked);
            setNameModal(false);
          }}
        />
      )}
    </main>
  );
}

/**
 * NAME ME → pick a pack → AGAIN / USE THIS NAME.
 *
 * AGAIN never repeats the name on screen — `generateName` takes the current one as
 * `avoid`, which is enforced by `tests/nameGenerator.test.ts`.
 */
function NameMeModal({
  allowCrude,
  crudePools,
  onUse,
  onClose,
  onSound,
}: {
  allowCrude: boolean;
  crudePools: NamePools | null;
  onUse(name: string): void;
  onClose(): void;
  onSound(event?: 'ui_click' | 'join'): void;
}): React.JSX.Element {
  const [pack, setPack] = useState<'classic' | 'crude' | null>(allowCrude ? null : 'classic');
  const [current, setCurrent] = useState('');
  const [seed, setSeed] = useState(() => seedFromString(`${Date.now()}`));

  const pools = useMemo<NamePools>(
    () => (pack === 'crude' && crudePools !== null ? mergePools(classicNamePools, crudePools) : classicNamePools),
    [pack, crudePools],
  );

  const roll = useCallback(
    (avoid: string) => {
      const rng = makeRng(seed);
      setCurrent(generateName(rng, pools, avoid.length > 0 ? { avoid } : {}));
      setSeed((value) => (value * 1664525 + 1013904223) >>> 0);
    },
    [pools, seed],
  );

  useEffect(() => {
    if (pack !== null && current.length === 0) roll('');
  }, [pack, current, roll]);

  if (pack === null) {
    return (
      <Modal title="Which kind of name?" onClose={onClose}>
        <div className="stack">
          <Button block onClick={() => setPack('classic')}>
            CLASSIC — merely suspicious
          </Button>
          <Button block variant="danger" onClick={() => setPack('crude')}>
            CRUDE — regrettable
          </Button>
          <Button variant="ghost" block onClick={onClose}>
            CANCEL
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="How about this" onClose={onClose}>
      <div className="stack">
        <Card sunken>
          <p className="center breakable" style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--t-h2)' }} aria-live="polite">
            {current}
          </p>
        </Card>
        <Button
          block
          onClick={() => {
            onSound();
            roll(current);
          }}
        >
          AGAIN
        </Button>
        <Button variant="primary" block onClick={() => onUse(current)}>
          USE THIS NAME
        </Button>
        <Button variant="ghost" block onClick={onClose}>
          CANCEL
        </Button>
      </div>
    </Modal>
  );
}
