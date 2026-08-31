/**
 * BLURT — entry point.
 *
 * The brand palette is written into `:root` *before* React mounts, so there is no
 * flash of unstyled colour and `brand.ts` stays the only place colours are defined.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './styles/game.css';
import { applyBrand, brand } from './brand.js';
import { App } from './App.js';

applyBrand('classic');
document.title = `${brand.name} — ${brand.tagline}`;

const container = document.getElementById('root');
if (container === null) throw new Error('missing #root');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
