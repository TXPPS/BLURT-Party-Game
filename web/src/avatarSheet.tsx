/**
 * BLURT — avatar contact sheet.
 *
 * A dev-only page at /avatars.html that renders every avatar in both packs at the
 * three sizes that matter, using the real components and the real palette. Vite
 * serves any HTML file in the project root during dev; it is not in the production
 * rollup input, so it costs the shipped bundle nothing.
 *
 * The point is judging the set as a set. Two things only show up this way: whether a
 * silhouette still reads at 40px on a phone, and whether thirty drawings look like
 * one family or thirty separate decisions.
 */

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { applyBrand } from './brand.js';
import { classicAvatars, loadCrudeAvatars, type AvatarEntry } from './avatars/registry.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/game.css';

const SIZES = [40, 80, 160] as const;

function Pack({ title, entries }: { title: string; entries: AvatarEntry[] }): React.JSX.Element {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ font: '700 18px var(--font-display)', margin: '0 0 14px' }}>
        {title} — {entries.length}
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 18,
        }}
      >
        {entries.map((entry) => (
          <div
            key={entry.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: 12,
              border: '3px solid var(--c-ink)',
              borderRadius: 16,
              background: 'var(--c-card)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
              {SIZES.map((size) => (
                <span
                  key={size}
                  className="avatar"
                  style={{ width: size, height: size, ['--avatar-accent' as string]: 'var(--c-accent)' }}
                >
                  <entry.Component />
                </span>
              ))}
            </div>
            <span style={{ font: '600 12px var(--font-body)', textAlign: 'center' }}>{entry.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Sheet(): React.JSX.Element {
  const [crude, setCrude] = useState<AvatarEntry[]>([]);
  useEffect(() => {
    applyBrand('classic');
    void loadCrudeAvatars().then(setCrude);
  }, []);

  return (
    <main style={{ padding: 28 }} data-sheet-ready={crude.length > 0 ? 'yes' : 'no'}>
      <Pack title="Classic" entries={classicAvatars} />
      {crude.length > 0 && <Pack title="Crude" entries={crude} />}
    </main>
  );
}

createRoot(document.getElementById('sheet') as HTMLElement).render(
  <StrictMode>
    <Sheet />
  </StrictMode>,
);
