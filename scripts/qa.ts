/**
 * BLURT — manual-QA remote control.
 *
 *   pnpm qa bots 5              # fill the room with stand-in players
 *   pnpm qa phase DRAWING_GUESS # jump straight to a screen
 *   pnpm qa clear               # remove the stand-ins
 *
 * Reads the room code and the token from the environment so neither ends up in your
 * shell history:
 *
 *   export BLURT_URL=https://blurt.<subdomain>.workers.dev
 *   export BLURT_ROOM=ABCD
 *   export BLURT_QA_TOKEN=...        # the same value as the QA_TOKEN worker secret
 *
 * The routes 404 unless that secret is set on the deployment, so this is inert
 * against any environment where QA mode was never turned on.
 */

const BASE = process.env.BLURT_URL ?? 'http://localhost:8787';
const ROOM = (process.env.BLURT_ROOM ?? '').toUpperCase();
const TOKEN = process.env.BLURT_QA_TOKEN ?? '';

const PHASES = [
  'LOBBY', 'GAME_SETUP', 'ROUND_PROMPT', 'ROUND_WAITING', 'ROUND_REVEAL', 'ROUND_VOTE',
  'ROUND_RESULTS', 'STORY_UPDATE', 'FINAL_STORY', 'DRAWING_SETUP', 'DRAWING_ACTIVE',
  'DRAWING_GUESS', 'DRAWING_VOTE', 'DRAWING_RESULTS', 'FINAL_RESULTS',
];

function usage(problem?: string): never {
  if (problem !== undefined) console.error(`✗ ${problem}\n`);
  console.error(`BLURT manual-QA remote control

  pnpm qa bots [count]     add stand-in players (default 5)
  pnpm qa clear            remove them
  pnpm qa phase <PHASE>    jump the room to a phase

Environment:
  BLURT_URL        ${BASE}
  BLURT_ROOM       ${ROOM === '' ? '(unset — required)' : ROOM}
  BLURT_QA_TOKEN   ${TOKEN === '' ? '(unset — required)' : '(set)'}

Phases: ${PHASES.join(' ')}`);
  process.exit(2);
}

async function call(params: Record<string, string>): Promise<void> {
  const url = new URL(`${BASE}/api/qa/${ROOM}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'X-QA-Token': TOKEN },
  }).catch((error: unknown) => {
    console.error(`✗ could not reach ${BASE}: ${(error as Error).message}`);
    process.exit(1);
  });

  if (response.status === 404) {
    console.error('✗ 404 — QA mode is not enabled on this deployment.');
    console.error('  Set the secret:  npx wrangler secret put QA_TOKEN --config server/wrangler.toml');
    process.exit(1);
  }
  if (response.status === 403) {
    console.error('✗ 403 — BLURT_QA_TOKEN does not match the deployment’s QA_TOKEN.');
    process.exit(1);
  }
  console.log(`${response.status} ${await response.text()}`);
}

async function main(): Promise<void> {
  const [action, arg] = process.argv.slice(2);
  if (action === undefined) usage();
  if (ROOM.length !== 4) usage('BLURT_ROOM must be the four-letter room code');
  if (TOKEN === '') usage('BLURT_QA_TOKEN is required');

  switch (action) {
    case 'bots':
      return call({ action: 'bots', count: arg ?? '5' });
    case 'clear':
      return call({ action: 'clear-bots' });
    case 'phase': {
      const phase = (arg ?? '').toUpperCase();
      if (!PHASES.includes(phase)) usage(`unknown phase "${arg ?? ''}"`);
      return call({ action: 'phase', to: phase });
    }
    default:
      usage(`unknown command "${action}"`);
  }
}

void main();
