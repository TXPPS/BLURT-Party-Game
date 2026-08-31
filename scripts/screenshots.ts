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

import { mkdir, rm } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const BASE = process.env.BLURT_URL ?? 'http://localhost:8787';
const OUT = 'artifacts/screenshots';

/** The breakpoints the brief requires: small phone → big TV. */
const WIDTHS = [320, 390, 768, 1280, 1920];

interface Scene {
  name: string;
  /** Player count needed for this scene. */
  players: number;
  /** Drive the room to the moment worth photographing. */
  setup(ctx: SceneContext): Promise<void>;
  /** Which page to shoot. Defaults to the host. */
  shoot?: 'host' | 'player' | 'both';
  /** Only shoot these widths (default: all). */
  widths?: number[];
  /** Shoot the artist's device rather than player index 1. */
  shootIndex?: 'artist';
}

interface SceneContext {
  pages: Page[];
  code: string;
  waitForPhase(page: Page, phase: string, timeoutMs?: number): Promise<void>;
}

const args = process.argv.slice(2);
const onlyScene = valueOf('only');
const onlyWidth = valueOf('width');

function valueOf(flag: string): string | null {
  const index = args.indexOf(`--${flag}`);
  return index >= 0 ? (args[index + 1] ?? null) : null;
}

async function newRoom(): Promise<string> {
  const response = await fetch(`${BASE}/api/rooms`, { method: 'POST' });
  const body = (await response.json()) as { code: string };
  return body.code;
}

/** Each player gets an isolated context, because sessionStorage is per-tab identity. */
async function joinAs(
  browser: Browser,
  code: string,
  name: string,
  avatarIndex: number,
  width: number,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width, height: Math.max(720, Math.round(width * 0.85)) },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error(`  ! page error (${name}): ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') console.error(`  ! console (${name}): ${message.text()}`);
  });

  await page.goto(`${BASE}/?room=${code}`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Your name').fill(name);
  const avatars = page.getByRole('radio');
  await avatars.nth(avatarIndex % (await avatars.count())).click();
  await page.getByRole('button', { name: "THAT'S ME" }).click();
  await page.waitForSelector('text=/ROOM [A-Z]{4}/', { timeout: 15_000 });
  return { context, page };
}

async function waitForPhase(page: Page, phase: string, timeoutMs = 60_000): Promise<void> {
  await page.waitForFunction(
    (want) => document.querySelector('[data-phase]')?.getAttribute('data-phase') === want,
    phase,
    { timeout: timeoutMs },
  );
  // Let the entrance animations settle before the shutter.
  await sleep(350);
}

async function readyAll(pages: Page[]): Promise<void> {
  for (const page of pages.slice(1)) {
    const ready = page.getByRole('button', { name: "I'M READY" });
    if (await ready.isVisible().catch(() => false)) await ready.click();
  }
}

/**
 * Only two or three of the players are competing in any matchup, and their devices
 * render the prompt on their own timeline. Waiting for the control to appear (rather
 * than sampling `isVisible` once) is the difference between a reliable harness and a
 * flaky one.
 */
async function answerAll(pages: Page[]): Promise<void> {
  const lines = [
    'a single wet glove, still warm',
    'four hundred paperclips and a note',
    'the concept of a Tuesday',
    'my uncle, legally',
  ];
  await Promise.all(
    pages.map(async (page, index) => {
      const box = page.getByLabel('Your answer');
      const appeared = await box
        .waitFor({ state: 'visible', timeout: 6000 })
        .then(() => true)
        .catch(() => false);
      if (!appeared) return;
      await box.fill(lines[index % lines.length] as string);
      await page.getByRole('button', { name: 'SEND IT' }).click();
    }),
  );
}

async function voteAll(pages: Page[]): Promise<void> {
  await Promise.all(
    pages.map(async (page) => {
      const buttons = page.locator('.answers button.btn');
      const appeared = await buttons
        .first()
        .waitFor({ state: 'visible', timeout: 6000 })
        .then(() => true)
        .catch(() => false);
      if (!appeared) return;
      await buttons.first().click().catch(() => undefined);
    }),
  );
}

/** Set the host's round count using the preset buttons, then nudge with -/+. */
async function setRounds(host: Page, rounds: number): Promise<void> {
  const presets: Record<number, string> = { 3: 'QUICK · 3', 5: 'STANDARD · 5', 8: 'LONG · 8' };
  const preset = presets[rounds];
  if (preset !== undefined) {
    await host.getByRole('button', { name: preset }).click();
    return;
  }
  await host.getByRole('button', { name: 'QUICK · 3' }).click();
  for (let i = 3; i > rounds; i -= 1) await host.getByRole('button', { name: 'One fewer round' }).click();
  for (let i = 3; i < rounds; i += 1) await host.getByRole('button', { name: 'One more round' }).click();
}

async function setFinale(host: Page, on: boolean): Promise<void> {
  const group = host.locator('fieldset', { hasText: 'DRAWING FINALE' });
  await group.getByRole('button', { name: on ? 'ON' : 'OFF' }).click();
}

/** Push the room through one complete standard round. */
async function playRound(pages: Page[]): Promise<void> {
  const host = pages[0] as Page;
  await waitForPhase(host, 'ROUND_PROMPT');
  await answerAll(pages);
  await waitForPhase(host, 'ROUND_VOTE');
  await voteAll(pages);
  await waitForPhase(host, 'ROUND_RESULTS');
  await host.getByRole('button', { name: 'CONTINUE' }).first().click().catch(() => undefined);
}

/** Draw four strokes on the artist's canvas so the picture is not blank. */
async function scribble(page: Page): Promise<void> {
  const canvas = page.locator('.canvas-wrap canvas');
  const box = await canvas.boundingBox();
  if (box === null) return;
  for (let i = 0; i < 4; i += 1) {
    const y = box.y + box.height * (0.25 + i * 0.15);
    await page.mouse.move(box.x + box.width * 0.2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, y + 18, { steps: 6 });
    await page.mouse.move(box.x + box.width * 0.8, y - 12, { steps: 6 });
    await page.mouse.up();
  }
}

/** One drawing: artist draws, everyone guesses, everyone votes. */
async function playDrawing(pages: Page[]): Promise<void> {
  const host = pages[0] as Page;
  await waitForPhase(host, 'DRAWING_ACTIVE');
  const artist = await Promise.all(
    pages.map(async (page) => ((await page.locator('.canvas-wrap canvas').count()) > 0 ? page : null)),
  ).then((found) => found.find((p) => p !== null) ?? null);
  if (artist !== null) {
    await scribble(artist);
    await artist.getByRole('button', { name: 'THAT IS MY FINAL ANSWER' }).click().catch(() => undefined);
  }

  await waitForPhase(host, 'DRAWING_GUESS');
  await Promise.all(
    pages.map(async (page, index) => {
      const box = page.getByLabel('Your guess — make it believable');
      const ok = await box.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
      if (!ok) return;
      await box.fill(['a man losing to a bin', 'two crabs in a suit', 'the concept of Tuesday', 'a haunted kettle'][index % 4] as string);
      await page.getByRole('button', { name: 'SEND IT' }).click();
    }),
  );

  await waitForPhase(host, 'DRAWING_VOTE');
  await voteAll(pages);
  await waitForPhase(host, 'DRAWING_RESULTS');
}

const SCENES: Scene[] = [
  {
    name: '01-home',
    players: 0,
    async setup() {
      /* handled specially */
    },
  },
  {
    name: '02-join',
    players: 0,
    async setup() {
      /* handled specially */
    },
  },
  {
    name: '03-identify',
    players: 0,
    async setup() {
      /* handled specially */
    },
  },
  {
    name: '04-lobby-2p',
    players: 2,
    async setup({ pages }) {
      await readyAll(pages);
      await sleep(400);
    },
  },
  {
    name: '05-lobby-10p',
    players: 10,
    widths: [390, 1280],
    async setup({ pages }) {
      await readyAll(pages);
      await sleep(600);
    },
  },
  {
    name: '06-round-prompt',
    players: 4,
    shoot: 'both',
    async setup({ pages }) {
      await readyAll(pages);
      await pages[0]!.getByRole('button', { name: 'START THE GAME' }).click();
      await waitForPhase(pages[0]!, 'ROUND_PROMPT');
    },
  },
  {
    name: '07-round-vote',
    players: 4,
    shoot: 'both',
    async setup({ pages }) {
      await readyAll(pages);
      await pages[0]!.getByRole('button', { name: 'START THE GAME' }).click();
      await waitForPhase(pages[0]!, 'ROUND_PROMPT');
      await answerAll(pages);
      await waitForPhase(pages[0]!, 'ROUND_VOTE');
    },
  },
  {
    name: '08-round-results',
    players: 4,
    shoot: 'both',
    async setup({ pages }) {
      await readyAll(pages);
      await pages[0]!.getByRole('button', { name: 'START THE GAME' }).click();
      await waitForPhase(pages[0]!, 'ROUND_PROMPT');
      await answerAll(pages);
      await waitForPhase(pages[0]!, 'ROUND_VOTE');
      await voteAll(pages);
      await waitForPhase(pages[0]!, 'ROUND_RESULTS');
    },
  },
  {
    name: '09-story-update',
    players: 4,
    async setup({ pages }) {
      await readyAll(pages);
      await setRounds(pages[0]!, 3);
      await setFinale(pages[0]!, false);
      await pages[0]!.getByRole('button', { name: 'START THE GAME' }).click();
      await playRound(pages);
      await playRound(pages);
      await waitForPhase(pages[0]!, 'STORY_UPDATE');
    },
  },
  {
    name: '10-final-story',
    players: 4,
    async setup({ pages }) {
      await readyAll(pages);
      await setRounds(pages[0]!, 3);
      await setFinale(pages[0]!, false);
      await pages[0]!.getByRole('button', { name: 'START THE GAME' }).click();
      await playRound(pages);
      await playRound(pages);
      await pages[0]!.getByRole('button', { name: 'CONTINUE' }).first().click().catch(() => undefined);
      await playRound(pages);
      await waitForPhase(pages[0]!, 'FINAL_STORY');
      await sleep(4000);
    },
  },
  {
    name: '11-drawing-canvas',
    players: 4,
    shoot: 'both',
    widths: [320, 390, 1280],
    async setup({ pages }) {
      await readyAll(pages);
      await setRounds(pages[0]!, 3);
      await setFinale(pages[0]!, true);
      await pages[0]!.getByRole('button', { name: 'START THE GAME' }).click();
      await playRound(pages);
      await playRound(pages);
      await pages[0]!.getByRole('button', { name: 'CONTINUE' }).first().click().catch(() => undefined);
      await playRound(pages);
      await waitForPhase(pages[0]!, 'FINAL_STORY');
      await pages[0]!.getByRole('button', { name: 'CONTINUE' }).first().click().catch(() => undefined);
      await waitForPhase(pages[0]!, 'DRAWING_ACTIVE', 90_000);
      const artist = await Promise.all(
        pages.map(async (p) => ((await p.locator('.canvas-wrap canvas').count()) > 0 ? p : null)),
      ).then((found) => found.find((p) => p !== null) ?? null);
      if (artist !== null) await scribble(artist);
    },
    shootIndex: 'artist',
  },
  {
    name: '12-final-results',
    players: 4,
    shoot: 'both',
    async setup({ pages }) {
      await readyAll(pages);
      await setRounds(pages[0]!, 3);
      await setFinale(pages[0]!, true);
      await pages[0]!.getByRole('button', { name: 'START THE GAME' }).click();
      await playRound(pages);
      await playRound(pages);
      await pages[0]!.getByRole('button', { name: 'CONTINUE' }).first().click().catch(() => undefined);
      await playRound(pages);
      await waitForPhase(pages[0]!, 'FINAL_STORY');
      await pages[0]!.getByRole('button', { name: 'CONTINUE' }).first().click().catch(() => undefined);
      await playDrawing(pages);
      await pages[0]!.getByRole('button', { name: 'CONTINUE' }).first().click().catch(() => undefined);
      await waitForPhase(pages[0]!, 'FINAL_RESULTS', 240_000);
      await sleep(5000);
    },
  },
];

async function shootHomeScenes(browser: Browser, width: number): Promise<void> {
  const context = await browser.newContext({
    viewport: { width, height: Math.max(720, Math.round(width * 0.85)) },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(300);
  await page.screenshot({ path: `${OUT}/01-home@${width}.png`, fullPage: true });

  await page.getByRole('button', { name: 'JOIN WITH A CODE' }).click();
  await sleep(250);
  await page.screenshot({ path: `${OUT}/02-join@${width}.png`, fullPage: true });

  const code = await newRoom();
  await page.goto(`${BASE}/?room=${code}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Pick a name and a face', { timeout: 15_000 });
  await sleep(300);
  await page.screenshot({ path: `${OUT}/03-identify@${width}.png`, fullPage: true });

  await page.getByRole('button', { name: '🎲 NAME ME' }).click();
  await sleep(250);
  await page.screenshot({ path: `${OUT}/03b-nameme@${width}.png`, fullPage: true });

  // Error states. A code that does not resolve is refused before a socket opens;
  // a well-formed but dead code gets the designed fatal screen.
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'JOIN WITH A CODE' }).click();
  await page.getByLabel('Room code').fill('ZZZZ');
  await page.getByRole('button', { name: 'JOIN' }).click();
  await page.waitForSelector('text=/No room called/', { timeout: 10_000 }).catch(() => undefined);
  await sleep(200);
  await page.screenshot({ path: `${OUT}/90-error-no-room@${width}.png`, fullPage: true });

  await page.goto(`${BASE}/?room=ZZZZ`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=/No room with that code|START OVER/', { timeout: 12_000 }).catch(() => undefined);
  await sleep(250);
  await page.screenshot({ path: `${OUT}/91-error-fatal@${width}.png`, fullPage: true });

  await context.close();
}

async function main(): Promise<void> {
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (health === null || !health.ok) {
    console.error(`✗ No app at ${BASE}. Run: pnpm dev:server (and pnpm build first)`);
    process.exit(2);
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
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
        if (scene.shoot === 'both' || scene.shoot === 'player') {
          let player = (pages[1] ?? pages[0]) as Page;
          if (scene.shootIndex === 'artist') {
            const found = await Promise.all(
              pages.map(async (p) => ((await p.locator('.canvas-wrap canvas').count()) > 0 ? p : null)),
            ).then((list) => list.find((p) => p !== null));
            if (found !== undefined && found !== null) player = found;
          }
          await player.screenshot({ path: `${OUT}/${scene.name}-player@${width}.png`, fullPage: true });
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
  console.log(`\n✓ screenshots in ${OUT}\n`);
}

void main();
