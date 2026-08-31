/**
 * BLURT — shoot the avatar contact sheet.
 *
 * Points a browser at the dev-only /avatars.html page and captures it. The page uses
 * the real avatar components and the real palette, so what lands in the PNG is exactly
 * what a player sees — not a re-drawn approximation that could flatter the originals.
 *
 *   pnpm avatars                      # needs `pnpm dev:web` running
 *   BLURT_WEB=http://localhost:5173 pnpm avatars
 */

import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = 'artifacts/avatars';
const BASE = process.env.BLURT_WEB ?? 'http://localhost:5173';

const chromiumPath = ((): string | null => {
  const override = process.env.BLURT_CHROMIUM;
  if (override !== undefined && override !== '') return override;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (root === undefined || root === '') return null;
  const candidate = `${root}/chromium`;
  return existsSync(candidate) ? candidate : null;
})();

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({
    ...(chromiumPath === null ? {} : { executablePath: chromiumPath }),
    args: ['--disable-features=AutofillServerCommunication,OptimizationHints,Translate'],
  });
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });

  try {
    await page.goto(`${BASE}/avatars.html`, { waitUntil: 'networkidle', timeout: 30_000 });
    // The crude pack is a dynamic import; wait for it rather than racing it.
    await page.waitForSelector('[data-sheet-ready="yes"]', { timeout: 20_000 });
    await page.screenshot({ path: `${OUT}/contact-sheet.png`, fullPage: true });

    const counts = await page.$$eval('section h2', (hs) => hs.map((h) => h.textContent ?? ''));
    for (const c of counts) console.log(`  ${c}`);
    console.log(`\n✓ ${OUT}/contact-sheet.png`);
  } catch (error) {
    console.error(`✗ could not shoot the sheet: ${(error as Error).message}`);
    console.error(`  Is the web dev server up? (pnpm dev:web, or set BLURT_WEB)`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

void main();
