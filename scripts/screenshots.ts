/**
 * BLURT — visual audit harness.
 *
 * Drives the *running* application with real browser contexts (one per player) and
 * captures every screen at every breakpoint the design has to survive. This is what
 * Phase 9 audits against — not the source, the actual pixels.
 *
 *   pnpm screenshots                    # full sweep
 *   pnpm screenshots --only lobby       # one scene
 *   pnpm screenshots --width 320        # one breakpoint
 *
 * Requires the app to be served (wrangler dev on :8787 by default).
 */

import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  BASE,
  OUT,
  WIDTHS,
  auditFindings,
  auditPage,
  joinAs,
  newRoom,
  waitForPhase,
} from './shotDriver.js';
import { SCENES, shootHomeScenes } from './shotScenes.js';

const args = process.argv.slice(2);

function valueOf(flag: string): string | null {
  const index = args.indexOf(`--${flag}`);
  return index >= 0 ? (args[index + 1] ?? null) : null;
}

const onlyScene = valueOf('only');
const onlyWidth = valueOf('width');

/**
 * Which chromium to drive, or null to let Playwright choose.
 *
 * This was hardcoded to one sandbox's path, which meant the visual audit ran on that
 * machine and nowhere else — a fresh clone could not shoot a single screenshot. Where
 * a browser lives is a property of the machine, not of this repo.
 *
 * `BLURT_CHROMIUM` wins if set. Otherwise use a browser preinstalled at the
 * conventional `PLAYWRIGHT_BROWSERS_PATH/chromium` when one is actually there, and
 * failing that let Playwright resolve its own — which is what a developer has after
 * `npx playwright install chromium`.
 */
const chromiumPath = ((): string | null => {
  const override = process.env.BLURT_CHROMIUM;
  if (override !== undefined && override !== '') return override;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (root === undefined || root === '') return null;
  const candidate = `${root}/chromium`;
  return existsSync(candidate) ? candidate : null;
})();


async function main(): Promise<void> {
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (health === null || !health.ok) {
    console.error(`✗ No app at ${BASE}. Run: pnpm dev:server (and pnpm build first)`);
    process.exit(2);
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({
    ...(chromiumPath === null ? {} : { executablePath: chromiumPath }),
    // The game makes no third-party requests; silence the browser's own so a sandbox
    // without egress does not fill the log with failed connections.
    args: ['--disable-features=AutofillServerCommunication,OptimizationHints,Translate'],
  });
  const widths = onlyWidth === null ? WIDTHS : [Number(onlyWidth)];

  for (const width of widths) {
    if (onlyScene === null || onlyScene.startsWith('0')) {
      console.log(`▶ home scenes @ ${width}`);
      await shootHomeScenes(browser, width);
    }

    for (const scene of SCENES) {
      if (scene.players === 0) continue;
      if (onlyScene !== null && !scene.name.includes(onlyScene)) continue;
      if (scene.widths !== undefined && !scene.widths.includes(width)) continue;

      console.log(`▶ ${scene.name} @ ${width}`);
      const code = await newRoom();
      const contexts: BrowserContext[] = [];
      const pages: Page[] = [];
      const names = [
        'Suspicious Gary', 'Turbo Brenda', 'Disco Grandma', 'Captain Meatball', 'Unlicensed Steve',
        'Professor Pickles', 'Municipal Possum', 'Damp Trombone', 'Feral Barista', 'Sacred Toaster',
      ];

      try {
        for (let i = 0; i < scene.players; i += 1) {
          const joined = await joinAs(browser, code, names[i] as string, i, width);
          contexts.push(joined.context);
          pages.push(joined.page);
        }
        await scene.setup({ pages, code, waitForPhase });

        const host = pages[0] as Page;
        await sleep(250);
        await host.screenshot({ path: `${OUT}/${scene.name}-host@${width}.png`, fullPage: true });
        auditFindings.push(...(await auditPage(host, `${scene.name}-host@${width}`)));
        if (scene.shoot === 'both' || scene.shoot === 'player') {
          let player = (pages[1] ?? pages[0]) as Page;
          if (scene.shootIndex !== undefined) {
            const wantCanvas = scene.shootIndex === 'artist';
            const withCanvas = await Promise.all(
              pages.map(async (p) => ((await p.locator('.canvas-wrap canvas').count()) > 0)),
            );
            const index = withCanvas.findIndex((has) => has === wantCanvas);
            const found = index >= 0 ? pages[index] : undefined;
            if (found !== undefined) player = found;
          }
          await player.screenshot({ path: `${OUT}/${scene.name}-player@${width}.png`, fullPage: true });
          auditFindings.push(...(await auditPage(player, `${scene.name}-player@${width}`)));
        }
      } catch (error) {
        console.error(`  ✗ ${scene.name} @ ${width}: ${(error as Error).message}`);
        const host = pages[0];
        if (host !== undefined) {
          await host.screenshot({ path: `${OUT}/FAILED-${scene.name}@${width}.png`, fullPage: true }).catch(() => undefined);
        }
      } finally {
        for (const context of contexts) await context.close();
      }
    }
  }

  await browser.close();

  const unique = [...new Set(auditFindings)];
  if (unique.length > 0) {
    console.log(`\n──────── LAYOUT / A11Y FINDINGS (${unique.length}) ────────`);
    for (const finding of unique) console.log(`  ✗ ${finding}`);
  } else {
    console.log('\n✓ no overflow, undersized targets or unlabelled controls found.');
  }
  console.log(`\n✓ screenshots in ${OUT}\n`);
}

void main();

