/**
 * BLURT — hate-speech blocklist.
 *
 * IMPORTANT: this list exists to stop the *machine* from generating something
 * hateful. It is applied to:
 *   • the curated room-code wordlist (checked at build time by `scripts/contentLint.ts`)
 *   • every name the random name generator produces, including the joined pair
 *   • story titles, prose, disguised prompts and house fallbacks
 *
 * It is deliberately **not** applied to what players type. Crude mode is meant to be
 * filthy, and policing a player's joke is not this game's job. The abuse surface we
 * actually care about — structural attacks on other players' screens — is handled in
 * `sanitize.ts`.
 *
 * ── Matching strategy ─────────────────────────────────────────────────────────
 * Two folded forms, because one is not enough:
 *   • `foldBasic`  — lowercase, leetspeak resolved, non-letters removed.
 *   • `foldSquash` — the above, plus runs of a repeated letter collapsed, which is
 *                    what catches drawn-out spellings.
 *
 * Long roots are matched as substrings of the squashed text (elongation defeated).
 * Short roots (≤ 4 characters) are matched against whole *unsquashed* words, because
 * squashing them produces disastrous false positives — `coon` squashes to `con`, and
 * `speed` squashes to `sped`. Word-level matching on the unsquashed form keeps
 * "con", "speed" and "raccoon" innocent while still catching the standalone slur.
 *
 * Known and accepted false positive: squash-matching means the place name "Niger"
 * cannot appear in generated content. Since this list only ever gates content we
 * author ourselves, that costs us nothing.
 */

/**
 * Slur roots and unambiguous hate terms, stored lowercase.
 * Kept short on purpose: every entry must be a term whose *only* everyday reading is
 * a slur, otherwise it produces false positives on innocent words.
 */
const HATE_ROOTS: readonly string[] = [
  'nigger',
  'nigga',
  'faggot',
  'fag',
  'kike',
  'spic',
  'chink',
  'gook',
  'wetback',
  'beaner',
  'towelhead',
  'raghead',
  'coon',
  'tranny',
  'shemale',
  'retard',
  'mongoloid',
  'nazi',
  'hitler',
  'heil',
  'lynching',
  'klux',
  'kkk',
  'whitepower',
  'zipperhead',
  'paki',
  'redskin',
  'squaw',
  'halfbreed',
  'spastic',
];

/**
 * Terms that must never appear in *generated* content because they describe illegal
 * or non-consensual acts. Crude mode is vulgar, not criminal — see CONTENT_GUIDE.md.
 */
const HARD_BOUNDARY_ROOTS: readonly string[] = [
  'rape',
  'rapist',
  'molest',
  'pedo',
  'paedo',
  'childporn',
  'incest',
  'bestiality',
  'jailbait',
  'underage',
  'grooming',
  'snuff',
  'necrophil',
];

/** Substitutions people use to smuggle a blocked term past a naive filter. */
const LEET_MAP: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '!': 'i',
  '|': 'i',
  '3': 'e',
  '4': 'a',
  '@': 'a',
  '5': 's',
  $: 's',
  '6': 'g',
  '7': 't',
  '+': 't',
  '8': 'b',
  '9': 'g',
};

/** Lowercase, resolve leetspeak, drop everything that is not a letter. */
export function foldBasic(input: string): string {
  const lowered = input.normalize('NFKD').toLowerCase();
  let mapped = '';
  for (const char of lowered) mapped += LEET_MAP[char] ?? char;
  return mapped.replace(/[^a-z]/gu, '');
}

/** `foldBasic`, plus repeated-letter runs collapsed to one. */
export function foldSquash(input: string): string {
  return foldBasic(input).replace(/(.)\1+/gu, '$1');
}

/** Roots at or below this length are matched as whole words, never as substrings. */
const SHORT_ROOT_MAX_LENGTH = 4;

interface PreparedRoot {
  original: string;
  folded: string;
  short: boolean;
}

function prepare(roots: readonly string[]): PreparedRoot[] {
  return roots.map((root) => {
    const basic = foldBasic(root);
    const short = basic.length <= SHORT_ROOT_MAX_LENGTH;
    return { original: root, folded: short ? basic : foldSquash(root), short };
  });
}

const PREPARED_HATE = prepare(HATE_ROOTS);
const PREPARED_BOUNDARY = prepare(HARD_BOUNDARY_ROOTS);

export interface BlocklistHit {
  root: string;
  category: 'hate' | 'boundary';
}

/** Returns every blocked root found in `input`, or an empty array when it is clean. */
export function findBlocked(input: string): BlocklistHit[] {
  const squashed = foldSquash(input);
  const words = new Set(
    input
      .toLowerCase()
      .split(/[^a-z0-9@$!|+]+/u)
      .map(foldBasic)
      .filter((w) => w.length > 0),
  );

  const hits: BlocklistHit[] = [];
  const scan = (roots: readonly PreparedRoot[], category: 'hate' | 'boundary'): void => {
    for (const root of roots) {
      if (root.folded.length === 0) continue;
      const matched = root.short ? words.has(root.folded) : squashed.includes(root.folded);
      if (matched) hits.push({ root: root.original, category });
    }
  };

  scan(PREPARED_HATE, 'hate');
  scan(PREPARED_BOUNDARY, 'boundary');
  return hits;
}

/** True when the text contains nothing from the blocklist. */
export function isClean(input: string): boolean {
  return findBlocked(input).length === 0;
}

/** Exposed for the content linter's coverage report. */
export const BLOCKLIST_SIZE = HATE_ROOTS.length + HARD_BOUNDARY_ROOTS.length;
