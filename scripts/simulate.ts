/**
 * BLURT — match simulator.
 *
 *   pnpm simulate --players 6 --rounds 5 --mode classic --drawing on
 *   pnpm simulate --matrix          # the full player-count / mode / finale matrix
 *   pnpm simulate --faults          # every fault-injection case
 *
 * Requires `pnpm dev:server` to be running (or pass --url).
 */

import { setTimeout as sleep } from 'node:timers/promises';
import { MAX_PLAYERS } from '../shared/constants.js';
import type { GameMode, TimerSpeed } from '../shared/types.js';
import { Bot, checkInvariants, type BotBehaviour, type InvariantFailure } from './botHarness.js';
import { FAULT_CASES, type FaultCase } from './faults.js';

interface Options {
  url: string;
  players: number;
  rounds: number;
  mode: GameMode;
  drawing: boolean;
  timer: TimerSpeed;
  matrix: boolean;
  faults: boolean;
  quiet: boolean;
  /** Substring filter, so a single fault case can be re-run after a fix. */
  only: string | null;
}

function parseArgs(argv: readonly string[]): Options {
  const get = (flag: string, fallback: string): string => {
    const index = argv.indexOf(`--${flag}`);
    return index >= 0 ? (argv[index + 1] ?? fallback) : fallback;
  };
  const has = (flag: string): boolean => argv.includes(`--${flag}`);

  return {
    url: get('url', 'http://localhost:8787'),
    players: Math.max(2, Math.min(MAX_PLAYERS, Number(get('players', '4')))),
    rounds: Math.max(1, Math.min(15, Number(get('rounds', '5')))),
    mode: get('mode', 'classic') === 'crude' ? 'crude' : 'classic',
    drawing: get('drawing', 'on') !== 'off',
    timer: (['fast', 'normal', 'relaxed'] as const).includes(get('timer', 'fast') as TimerSpeed)
      ? (get('timer', 'fast') as TimerSpeed)
      : 'fast',
    matrix: has('matrix'),
    faults: has('faults'),
    quiet: has('quiet'),
    only: argv.includes('--only') ? get('only', '') : null,
  };
}

const NAMES = [
  'Suspicious Gary', 'Turbo Brenda', 'Disco Grandma', 'Captain Meatball', 'Unlicensed Steve',
  'Professor Pickles', 'Municipal Possum', 'Damp Trombone', 'Feral Barista', 'Sacred Toaster',
];
const AVATARS = [
  'raccoon', 'possum', 'banana', 'pickle', 'hotdog', 'skeleton', 'boot', 'toaster', 'doll', 'clown',
];

export interface RunConfig {
  players: number;
  rounds: number;
  mode: GameMode;
  drawing: boolean;
  timer: TimerSpeed;
  /** Behaviour overrides by player index. */
  behaviours?: Record<number, BotBehaviour>;
  label: string;
  /** Extra assertions for a fault case. */
  expect?: (bots: readonly Bot[]) => InvariantFailure[];
  timeoutMs?: number;
}

export interface RunResult {
  label: string;
  ok: boolean;
  durationMs: number;
  failures: InvariantFailure[];
  code: string;
  finalPhase: string;
}

async function createRoom(url: string): Promise<string> {
  const response = await fetch(`${url}/api/rooms`, { method: 'POST' });
  if (!response.ok) throw new Error(`could not create a room: ${response.status}`);
  const body = (await response.json()) as { code: string };
  return body.code;
}

export async function runMatch(url: string, config: RunConfig): Promise<RunResult> {
  const started = Date.now();
  const code = await createRoom(url);
  const wsUrl = url.replace(/^http/, 'ws');
  const bots: Bot[] = [];

  for (let index = 0; index < config.players; index += 1) {
    const bot = new Bot({
      baseUrl: wsUrl,
      code,
      name: NAMES[index % NAMES.length] ?? `Bot ${index}`,
      avatarId: AVATARS[index % AVATARS.length] ?? 'raccoon',
      isCreator: index === 0,
      behaviour: config.behaviours?.[index] ?? {},
    });
    bots.push(bot);
    await bot.connect();
    // A small stagger mirrors people picking up their phones one at a time.
    await sleep(60);
  }

  const host = bots[0] as Bot;

  // Wait for everyone to be seated and named before the host configures the match.
  await waitUntil(() => (host.state?.players.filter((p) => p.identified).length ?? 0) >= config.players, 8000);

  host.send({
    t: 'update_settings',
    settings: {
      mode: config.mode,
      rounds: config.rounds,
      drawingFinale: config.drawing,
      timerSpeed: config.timer,
    },
  });
  for (const bot of bots) bot.send({ t: 'acknowledge_adult' });
  await sleep(200);

  await waitUntil(() => host.state?.view.phase === 'LOBBY' && host.state.view.canStart === true, 8000);
  host.send({ t: 'start_game' });

  const timeoutMs = config.timeoutMs ?? 180_000;
  const completed = await waitUntil(() => bots.some((b) => b.finished), timeoutMs);
  await sleep(400);

  const failures = completed
    ? checkInvariants(bots)
    : [{ name: 'match completed', detail: `timed out after ${timeoutMs}ms` }];
  if (config.expect !== undefined) failures.push(...config.expect(bots));

  for (const bot of bots) bot.disconnect();
  await sleep(120);

  return {
    label: config.label,
    ok: failures.length === 0,
    durationMs: Date.now() - started,
    failures,
    code,
    finalPhase: bots.find((b) => b.finished)?.state?.phase ?? host.state?.phase ?? 'UNKNOWN',
  };
}

async function waitUntil(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(50);
  }
  return predicate();
}

/**
 * The player-count matrix.
 *
 * 2 / 4 / 10 across both modes, with and without the finale, is the floor the brief
 * sets — those are the counts where the rules genuinely differ (the house plays at
 * two, three-way matchups start at nine). 3, 6 and 8 get one full run each to cover
 * the single-voter case and the 2/3-competitor alternation band.
 *
 * Rounds are kept at 3: the round *loop* is identical at 5, and the extra two rounds
 * per config buy nothing except wall clock. `--faults` covers 1 and 15 explicitly.
 */
function buildMatrix(): RunConfig[] {
  const configs: RunConfig[] = [];

  for (const players of [2, 4, 10]) {
    for (const mode of ['classic', 'crude'] as const) {
      for (const drawing of [true, false]) {
        configs.push({
          players,
          rounds: 3,
          mode,
          drawing,
          timer: 'fast',
          label: `${players}p ${mode} ${drawing ? 'finale' : 'no-finale'} 3r`,
          timeoutMs: 300_000,
        });
      }
    }
  }

  for (const players of [3, 6, 8]) {
    configs.push({
      players,
      rounds: 3,
      mode: players === 6 ? 'crude' : 'classic',
      drawing: true,
      timer: 'fast',
      label: `${players}p ${players === 6 ? 'crude' : 'classic'} finale 3r`,
      timeoutMs: 300_000,
    });
  }

  // One long match, to prove a story continuation and a 5-round STORY_UPDATE cadence.
  configs.push({
    players: 5,
    rounds: 5,
    mode: 'classic',
    drawing: true,
    timer: 'fast',
    label: '5p classic finale 5r',
    timeoutMs: 360_000,
  });

  return configs;
}

function report(results: readonly RunResult[]): number {
  const failed = results.filter((r) => !r.ok);
  console.log('\n──────── RESULTS ────────');
  for (const result of results) {
    const mark = result.ok ? '✓' : '✗';
    console.log(
      `${mark} ${result.label.padEnd(34)} ${String(Math.round(result.durationMs / 1000)).padStart(3)}s  ${result.code}  → ${result.finalPhase}`,
    );
    for (const failure of result.failures) console.log(`    ✗ ${failure.name}: ${failure.detail}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} passed.\n`);
  return failed.length;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const health = await fetch(`${options.url}/api/health`).catch(() => null);
  if (health === null || !health.ok) {
    console.error(`✗ No server at ${options.url}. Start one with: pnpm dev:server`);
    process.exit(2);
  }

  let configs: RunConfig[];
  if (options.matrix) configs = buildMatrix();
  else if (options.faults) configs = FAULT_CASES.map((c: FaultCase) => c.config);
  else {
    configs = [
      {
        players: options.players,
        rounds: options.rounds,
        mode: options.mode,
        drawing: options.drawing,
        timer: options.timer,
        label: `${options.players}p ${options.mode} ${options.drawing ? 'finale' : 'no-finale'} ${options.rounds}r`,
      },
    ];
  }

  if (options.only !== null) {
    const needle = options.only.toLowerCase();
    configs = configs.filter((c) => c.label.toLowerCase().includes(needle));
    if (configs.length === 0) {
      console.error(`✗ no case matches --only "${options.only}"`);
      process.exit(2);
    }
  }

  const results: RunResult[] = [];
  for (const config of configs) {
    if (!options.quiet) process.stdout.write(`▶ ${config.label} … `);
    const result = await runMatch(options.url, config);
    if (!options.quiet) process.stdout.write(`${result.ok ? '✓' : '✗'} ${Math.round(result.durationMs / 1000)}s\n`);
    results.push(result);
  }

  process.exit(report(results) === 0 ? 0 : 1);
}

if (process.argv[1]?.includes('simulate')) {
  void main();
}
