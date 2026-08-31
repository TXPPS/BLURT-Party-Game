/**
 * BLURT — driving a real room from real browsers.
 *
 * Everything here is a primitive the scene catalogue composes: open a room, join as a
 * player, push the room to a phase, audit whatever is on screen. Split out of
 * `screenshots.ts` so that file is the sweep itself and nothing else.
 */

import { setTimeout as sleep } from 'node:timers/promises';
import type { Browser, BrowserContext, Page } from 'playwright';

export const BASE = process.env.BLURT_URL ?? 'http://localhost:8787';
export const OUT = 'artifacts/screenshots';

/**
 * Every layout and a11y violation the sweep saw, across all scenes and widths.
 * `auditPage` appends; the sweep de-duplicates and reports at the end.
 */
export const auditFindings: string[] = [];

/** The breakpoints the brief requires: small phone → big TV. */
export const WIDTHS = [320, 390, 768, 1280, 1920];

export interface Scene {
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
  /**
   * Which player device to photograph. 'artist' finds a live canvas; 'waiter' finds
   * somebody *without* one, which is the only way to photograph the holding screen
   * now that several people draw at once.
   */
  shootIndex?: 'artist' | 'waiter';
}

export interface SceneContext {
  pages: Page[];
  code: string;
  waitForPhase(page: Page, phase: string, timeoutMs?: number): Promise<void>;
}


export async function newRoom(): Promise<string> {
  const response = await fetch(`${BASE}/api/rooms`, { method: 'POST' });
  const body = (await response.json()) as { code: string };
  return body.code;
}

/** Each player gets an isolated context, because sessionStorage is per-tab identity. */
export async function joinAs(
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

/**
 * Structural checks run against the *live* DOM at every breakpoint.
 *
 * Screenshots prove how something looks; these prove the things a screenshot cannot:
 * that nothing overflows sideways, that every control is thumb-sized, and that
 * everything interactive has an accessible name.
 */
export async function auditPage(page: Page, label: string): Promise<string[]> {
  return page.evaluate((where) => {
    const problems: string[] = [];
    const root = document.documentElement;

    if (root.scrollWidth > window.innerWidth + 1) {
      problems.push(
        `${where}: horizontal overflow — content is ${root.scrollWidth}px wide in a ${window.innerWidth}px viewport`,
      );
    }

    const MIN_TAP = 44;
    const controls = [...document.querySelectorAll('button, a[href], input, textarea, select')];
    for (const element of controls) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue; // not rendered
      if (box.height < MIN_TAP || box.width < MIN_TAP) {
        const name = element.textContent?.trim().slice(0, 24) ?? element.tagName;
        problems.push(
          `${where}: tap target too small (${Math.round(box.width)}x${Math.round(box.height)}) — "${name}"`,
        );
      }
      const label =
        element.getAttribute('aria-label') ??
        element.getAttribute('title') ??
        element.textContent?.trim() ??
        '';
      const labelled =
        label.length > 0 ||
        element.id.length > 0 ? document.querySelector(`label[for="${element.id}"]`) !== null : false;
      if (label.length === 0 && !labelled) {
        problems.push(`${where}: control with no accessible name — <${element.tagName.toLowerCase()}>`);
      }
    }

    for (const img of document.querySelectorAll('img')) {
      if (!img.hasAttribute('alt')) problems.push(`${where}: <img> with no alt attribute`);
    }

    // Player text must wrap rather than spill out of its container.
    for (const el of document.querySelectorAll('.breakable')) {
      if (el.scrollWidth > el.clientWidth + 2) {
        problems.push(`${where}: text overflows its container — "${el.textContent?.trim().slice(0, 32)}"`);
      }
    }

    return problems;
  }, label);
}

export async function waitForPhase(page: Page, phase: string, timeoutMs = 60_000): Promise<void> {
  await page.waitForFunction(
    (want) => document.querySelector('[data-phase]')?.getAttribute('data-phase') === want,
    phase,
    { timeout: timeoutMs },
  );
  // Let the entrance animations settle before the shutter.
  await sleep(350);
}

export async function readyAll(pages: Page[]): Promise<void> {
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
export async function answerAll(pages: Page[]): Promise<void> {
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

export async function voteAll(pages: Page[]): Promise<void> {
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
export async function setRounds(host: Page, rounds: number): Promise<void> {
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

export async function setFinale(host: Page, on: boolean): Promise<void> {
  const group = host.locator('fieldset', { hasText: 'DRAWING FINALE' });
  await group.getByRole('button', { name: on ? 'ON' : 'OFF' }).click();
}

/** Push the room through one complete standard round. */
export async function playRound(pages: Page[]): Promise<void> {
  const host = pages[0] as Page;
  await waitForPhase(host, 'ROUND_PROMPT');
  await answerAll(pages);
  await waitForPhase(host, 'ROUND_VOTE');
  await voteAll(pages);
  await waitForPhase(host, 'ROUND_RESULTS');
  await host.getByRole('button', { name: 'CONTINUE' }).first().click().catch(() => undefined);
}

/** Draw four strokes on the artist's canvas so the picture is not blank. */
export async function scribble(page: Page): Promise<void> {
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

/** Every page currently showing a canvas — several at once, since drawing is shared. */
export async function artistPages(pages: readonly Page[]): Promise<Page[]> {
  const found = await Promise.all(
    pages.map(async (page) => ((await page.locator('.canvas-wrap canvas').count()) > 0 ? page : null)),
  );
  return found.filter((page): page is Page => page !== null);
}

/**
 * The drawing window. Happens **once per match**, not once per drawing.
 *
 * This used to be folded into one `playDrawing`, which then waited for DRAWING_ACTIVE
 * again on the second showcase — a phase that never comes back — and sat there until
 * the scene timed out. Splitting the two makes the shape of the finale explicit.
 */
export async function playDrawingPhase(pages: Page[]): Promise<void> {
  const host = pages[0] as Page;
  await waitForPhase(host, 'DRAWING_ACTIVE');
  // All artists must submit or the phase waits out its deadline.
  for (const artist of await artistPages(pages)) {
    await scribble(artist);
    await artist.getByRole('button', { name: 'THAT IS MY FINAL ANSWER' }).click().catch(() => undefined);
  }
}

/** One picture's showcase: everyone guesses, everyone votes, the truth lands. */
export async function playShowcase(pages: Page[]): Promise<void> {
  const host = pages[0] as Page;
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


