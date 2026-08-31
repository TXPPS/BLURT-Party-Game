/**
 * BLURT — the front door.
 *
 * Two things to do and no explaining: start a room, or type four letters. The design
 * target is a group getting from "open the site" to "everyone is in" in about ten
 * seconds, which means nothing here asks for anything it does not need.
 */

import { useEffect, useState } from 'react';
import { brand } from '../brand.js';
import { Button, Card } from '../components/kit.js';
import { lookupRoom } from '../net/socket.js';
import { parseRoomCode } from '@shared/roomCode.js';
import type { GameMode } from '@shared/types.js';

export interface HomeProps {
  onCreate(code: string, mode: GameMode): void;
  onJoin(code: string): void;
  /** Prefilled from `?room=CODE` on a shared link. */
  initialCode?: string;
}

/**
 * `mode` sits between `home` and creating the room on purpose.
 *
 * Content mode used to be a lobby setting, which put it *after* the name and avatar
 * pickers — so the host, the one person who deliberately chose Crude, was the only
 * player who could not have a crude name or a crude face. Asking here means the
 * choice is made before any identity exists, for the host and for everyone joining.
 */
type Stage = 'home' | 'mode' | 'gate' | 'join';

export function Home({ onCreate, onJoin, initialCode }: HomeProps): React.JSX.Element {
  const [stage, setStage] = useState<Stage>(initialCode === undefined ? 'home' : 'join');
  const [code, setCode] = useState(initialCode ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = `${brand.name} — ${brand.tagline}`;
  }, []);

  const create = async (mode: GameMode): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/rooms', { method: 'POST' });
      if (!response.ok) throw new Error('room service unavailable');
      const body = (await response.json()) as { code: string };
      onCreate(body.code, mode);
    } catch {
      setError('Could not start a room. Check your connection and try again.');
      setBusy(false);
    }
  };

  const join = async (): Promise<void> => {
    const parsed = parseRoomCode(code);
    if (!parsed.ok) {
      setError(parsed.reason);
      return;
    }
    setBusy(true);
    setError(null);
    const room = await lookupRoom(parsed.code);
    if (!room.exists) {
      setError(`No room called ${parsed.code}. Codes expire after a while — check the big screen.`);
      setBusy(false);
      return;
    }
    if (room.full) {
      setError(`${parsed.code} is full. Ten players is the limit.`);
      setBusy(false);
      return;
    }
    if (room.started) {
      setError(`${parsed.code} has already started. You can join when they get back to the lobby.`);
      setBusy(false);
      return;
    }
    onJoin(parsed.code);
  };

  return (
    <main className="page page--narrow page--center">
      <div className="stack stack--loose center">
        <div className="stack stack--tight center">
          <h1 className="logo">{brand.name}</h1>
          <p className="tagline">{brand.tagline}</p>
        </div>

        {stage === 'home' ? (
          <Card tilt="l">
            <div className="stack">
              <p className="lead">{brand.blurb}</p>
              <Button variant="primary" block onClick={() => setStage('mode')} disabled={busy}>
                {busy ? 'Finding a room…' : 'START A ROOM'}
              </Button>
              <Button
                block
                onClick={() => {
                  setStage('join');
                  setError(null);
                }}
              >
                JOIN WITH A CODE
              </Button>
              <p className="faint center">2–10 players · one device each · no accounts, ever</p>
            </div>
          </Card>
        ) : stage === 'mode' ? (
          <Card tilt="r">
            <div className="stack">
              <p className="eyebrow">Pick your poison</p>
              <h2 className="card__title">How filthy?</h2>

              <Button variant="primary" block onClick={() => void create('classic')} disabled={busy}>
                CLASSIC
              </Button>
              <p className="faint center">Sharp, silly, safe for the room. Nobody has to explain anything.</p>

              <Button variant="danger" block onClick={() => setStage('gate')} disabled={busy}>
                CRUDE · 18+
              </Button>
              <p className="faint center">Adult, vulgar, frequently disgusting. Different stories, names and faces.</p>

              <Button block onClick={() => { setStage('home'); setError(null); }} disabled={busy}>
                BACK
              </Button>
            </div>
          </Card>
        ) : stage === 'gate' ? (
          <Card tilt="l">
            <div className="stack">
              <div className="hazard" aria-hidden="true" />
              <h2 className="card__title">CRUDE MODE — 18+</h2>
              <p className="lead">
                The prompts, the stories, the names and the pictures are adult, vulgar and
                frequently disgusting.
              </p>
              <Button variant="danger" block onClick={() => void create('crude')} disabled={busy}>
                {busy ? 'Finding a room…' : 'I AM 18 OR OVER — LET ME IN'}
              </Button>
              <Button variant="ghost" block onClick={() => setStage('mode')} disabled={busy}>
                NO THANKS
              </Button>
              <div className="hazard" aria-hidden="true" />
            </div>
          </Card>
        ) : (
          <Card tilt="r">
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                void join();
              }}
            >
              <div className="field">
                <label className="field__label" htmlFor="room-code">
                  Room code
                </label>
                <input
                  id="room-code"
                  className="input input--code"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4));
                    setError(null);
                  }}
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                  maxLength={4}
                  placeholder="BEEF"
                  aria-describedby="room-code-help"
                  autoFocus
                />
                <p id="room-code-help" className="faint center">
                  Four letters, from the big screen.
                </p>
              </div>
              <Button variant="primary" block type="submit" disabled={busy || code.length < 4}>
                {busy ? 'Looking…' : 'JOIN'}
              </Button>
              <Button
                variant="ghost"
                block
                onClick={() => {
                  setStage('home');
                  setError(null);
                }}
              >
                BACK
              </Button>
            </form>
          </Card>
        )}

        {error !== null && (
          <Card sunken>
            <p role="alert" className="lead">
              {error}
            </p>
          </Card>
        )}

        <p className="faint center">
          {brand.shortDescription} Original game, original art, synthesised sound.
        </p>
      </div>
    </main>
  );
}
