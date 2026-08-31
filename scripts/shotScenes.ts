/**
 * BLURT — the scene catalogue.
 *
 * One entry per screen worth photographing, each knowing how many players it needs
 * and how to drive the room to that exact moment. Adding a screen to the visual audit
 * means adding an entry here; the sweep in `screenshots.ts` does the rest.
 */

import { setTimeout as sleep } from 'node:timers/promises';
import type { Browser, Page } from 'playwright';
import {
  BASE,
  OUT,
  answerAll,
  auditFindings,
  auditPage,
  newRoom,
  artistPages,
  playDrawing,
  playRound,
  readyAll,
  scribble,
  setFinale,
  setRounds,
  voteAll,
  waitForPhase,
  type Scene,
} from './shotDriver.js';

export const SCENES: Scene[] = [
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
    // Story-heavy scenes replay whole matches, so they are sampled at the widths
    // where layout risk actually lives rather than at all five.
    widths: [320, 1280],
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
    widths: [390, 1920],
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
    widths: [320, 768],
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
      // Several canvases are live at once now; scribble on one so the shot has ink,
      // and leave the rest unsubmitted so the phase stays open to be photographed.
      const [artist] = await artistPages(pages);
      if (artist !== undefined) await scribble(artist);
    },
    shootIndex: 'artist',
  },
  {
    // The waiting state during the shared drawing window.
    //
    // Everybody draws now, so the person waiting is almost always an artist who has
    // already submitted and is sitting on a locked canvas — that is the screen worth
    // photographing, hence `shootIndex: 'artist'`. ('waiter' still exists in the
    // driver for the case that does produce a non-artist: somebody who was departed
    // when the finale was planned and has since reconnected.)
    //
    // Six players, one submission, so the tally reads a partial "1 of 6" rather than
    // zero or a full house.
    name: '11b-drawing-hold',
    players: 6,
    shoot: 'both',
    widths: [320, 390],
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

      // One artist submits so the tally reads "1 of N" rather than zero.
      const [first] = await artistPages(pages);
      if (first !== undefined) {
        await scribble(first);
        await first.getByRole('button', { name: 'THAT IS MY FINAL ANSWER' }).click().catch(() => undefined);
      }
      await sleep(400);
    },
    shootIndex: 'artist',
  },
  {
    // Closes the loop the brief asks for: create → play → results → PLAY AGAIN →
    // back to the lobby, all through the real UI rather than the harness.
    name: '13-play-again',
    players: 3,
    widths: [390],
    async setup({ pages }) {
      const host = pages[0] as Page;
      await readyAll(pages);
      await setRounds(host, 3);
      for (let i = 3; i > 1; i -= 1) await host.getByRole('button', { name: 'One fewer round' }).click();
      await setFinale(host, false);
      await host.getByRole('button', { name: 'START THE GAME' }).click();
      await playRound(pages);
      await waitForPhase(host, 'FINAL_STORY');
      await host.getByRole('button', { name: 'CONTINUE' }).first().click().catch(() => undefined);
      await waitForPhase(host, 'FINAL_RESULTS');

      await host.getByRole('button', { name: 'PLAY AGAIN' }).first().click();
      await waitForPhase(host, 'GAME_SETUP', 20_000);
      await waitForPhase(host, 'ROUND_PROMPT', 20_000);

      // …and back out again.
      await answerAll(pages);
      await waitForPhase(host, 'ROUND_VOTE');
      await voteAll(pages);
      await waitForPhase(host, 'ROUND_RESULTS');
      await host.getByRole('button', { name: 'CONTINUE' }).first().click().catch(() => undefined);
      await waitForPhase(host, 'FINAL_STORY');
      await host.getByRole('button', { name: 'CONTINUE' }).first().click().catch(() => undefined);
      await waitForPhase(host, 'FINAL_RESULTS');
      await host.getByRole('button', { name: 'BACK TO THE LOBBY' }).first().click();
      await waitForPhase(host, 'LOBBY', 20_000);
    },
  },
  {
    name: '12-final-results',
    players: 4,
    shoot: 'both',
    widths: [390, 1280],
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

      // Every artist gets a turn, so the finale has to be played out rather than
      // waited out — three drawings left to their own timers is six minutes.
      for (let drawing = 0; drawing < 4; drawing += 1) {
        const phase = await pages[0]!
          .locator('[data-phase]')
          .getAttribute('data-phase')
          .catch(() => null);
        if (phase === 'FINAL_RESULTS') break;
        await playDrawing(pages);
        await pages[0]!.getByRole('button', { name: 'CONTINUE' }).first().click().catch(() => undefined);
        await sleep(600);
      }
      await waitForPhase(pages[0]!, 'FINAL_RESULTS', 120_000);
      await sleep(4000);
    },
  },
];

export async function shootHomeScenes(browser: Browser, width: number): Promise<void> {
  const context = await browser.newContext({
    viewport: { width, height: Math.max(720, Math.round(width * 0.85)) },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(300);
  await page.screenshot({ path: `${OUT}/01-home@${width}.png`, fullPage: true });
  auditFindings.push(...(await auditPage(page, `01-home@${width}`)));

  await page.getByRole('button', { name: 'JOIN WITH A CODE' }).click();
  await sleep(250);
  await page.screenshot({ path: `${OUT}/02-join@${width}.png`, fullPage: true });

  const code = await newRoom();
  await page.goto(`${BASE}/?room=${code}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Pick a name and a face', { timeout: 15_000 });
  await sleep(300);
  await page.screenshot({ path: `${OUT}/03-identify@${width}.png`, fullPage: true });
  auditFindings.push(...(await auditPage(page, `03-identify@${width}`)));

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
  auditFindings.push(...(await auditPage(page, `91-error-fatal@${width}`)));

  await context.close();
}

