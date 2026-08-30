/**
 * BLURT — text sanitisation.
 *
 * This is the *only* place player-supplied text is cleaned. The server runs it on
 * every inbound string before the value is stored; the client runs the same code
 * for live input feedback, so what you see while typing is what the room gets.
 *
 * Scope note: this module is about structural safety (control characters, Zalgo,
 * length, emptiness). It does not judge what the joke was. Crude mode is meant to
 * be crude — see CONTENT_GUIDE.md for the content boundaries, which are enforced
 * by the content pipeline, not by this file.
 */

/**
 * Control characters, invisible separators and bidirectional overrides.
 * Tab / newline / carriage return are deliberately absent: they survive to the
 * whitespace-collapse step, which turns them into ordinary spaces.
 */
const INVISIBLE_AND_BIDI = new RegExp(
  '[' +
    '\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F' + // C0 + C1 controls
    '\\u00AD' + // soft hyphen
    '\\u061C' + // arabic letter mark
    '\\u180E' + // mongolian vowel separator
    '\\u200B-\\u200F' + // zero-width space/non-joiner/joiner, LRM, RLM
    '\\u202A-\\u202E' + // bidi embedding + override
    '\\u2060-\\u2064\\u2066-\\u206F' + // word joiner, invisible operators, bidi isolates
    '\\uFEFF' + // byte-order mark
    '\\uFFF9-\\uFFFB' + // interlinear annotation
    ']',
  'gu',
);

/** Unicode combining marks. Stacking dozens of these is how "Zalgo" text is made. */
const COMBINING_MARK = /\p{M}/u;

/** Maximum combining marks allowed to ride on a single base character. */
const MAX_COMBINING_MARKS_PER_GRAPHEME = 2;

export interface SanitizeOptions {
  maxLength: number;
  /** When true, an empty result is returned as '' rather than rejected. */
  allowEmpty?: boolean;
}

export interface SanitizeResult {
  ok: boolean;
  value: string;
  /** Populated only when `ok` is false. */
  reason?: 'empty' | 'too_long' | 'not_a_string';
}

/**
 * Normalise, de-fang and length-limit a player-supplied string.
 *
 * Order matters:
 *   1. NFKC folds compatibility look-alikes (fullwidth, ligatures) to plain forms.
 *   2. Invisible / bidi characters are dropped outright.
 *   3. Combining marks are capped per base character (kills Zalgo without banning
 *      legitimate accents or scripts that genuinely need marks).
 *   4. Whitespace collapses to single spaces and the result is trimmed.
 *   5. Length is enforced by code point, not UTF-16 unit, so an emoji counts as one.
 */
export function sanitizeText(input: unknown, options: SanitizeOptions): SanitizeResult {
  if (typeof input !== 'string') return { ok: false, value: '', reason: 'not_a_string' };

  let text = input.normalize('NFKC').replace(INVISIBLE_AND_BIDI, '');
  text = capCombiningMarks(text);
  text = text.replace(/\s+/gu, ' ').trim();

  const points = [...text];
  if (points.length > options.maxLength) {
    return {
      ok: false,
      value: points.slice(0, options.maxLength).join('').trim(),
      reason: 'too_long',
    };
  }

  if (text.length === 0 && options.allowEmpty !== true) {
    return { ok: false, value: '', reason: 'empty' };
  }

  return { ok: true, value: text };
}

/**
 * Lenient variant used for client-side input feedback: never rejects, just returns
 * the best legal version of what the player has typed so far.
 */
export function clampText(input: string, maxLength: number): string {
  return sanitizeText(input, { maxLength, allowEmpty: true }).value;
}

function capCombiningMarks(text: string): string {
  let out = '';
  let marksOnCurrentBase = 0;
  for (const char of text) {
    if (COMBINING_MARK.test(char)) {
      if (marksOnCurrentBase >= MAX_COMBINING_MARKS_PER_GRAPHEME) continue;
      marksOnCurrentBase += 1;
    } else {
      marksOnCurrentBase = 0;
    }
    out += char;
  }
  return out;
}

/** Code-point length — the number a player intuitively counts, and what limits use. */
export function textLength(text: string): number {
  return [...text].length;
}

/**
 * Room codes are always four A–Z letters. Players paste them with spaces, dashes and
 * lowercase; this makes all of that work without a "wrong format" scolding.
 */
export function normalizeRoomCode(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^A-Z]/gu, '')
    .slice(0, 4);
}

/**
 * Resolve a duplicate display name by appending a numeric suffix. This never merges
 * sessions — identity comes from the secret token alone.
 */
export function disambiguateName(
  desired: string,
  taken: readonly string[],
  maxLength: number,
): string {
  const lowerTaken = new Set(taken.map((n) => n.toLowerCase()));
  if (!lowerTaken.has(desired.toLowerCase())) return desired;

  for (let n = 2; n <= 99; n += 1) {
    const suffix = ` ${n}`;
    const room = maxLength - suffix.length;
    const base = [...desired].slice(0, Math.max(1, room)).join('').trim();
    const candidate = `${base}${suffix}`;
    if (!lowerTaken.has(candidate.toLowerCase())) return candidate;
  }
  return desired;
}
