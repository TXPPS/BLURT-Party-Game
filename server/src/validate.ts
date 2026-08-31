/**
 * BLURT — inbound message validation.
 *
 * Every byte that arrives from a client passes through here before anything else
 * looks at it. Nothing downstream ever type-asserts on a client payload; if a
 * message is not in this schema it does not exist.
 *
 * Text fields are validated for *shape* here and sanitised for *content* in the
 * handler via `shared/sanitize.ts`, because the sanitiser's job (normalise, strip,
 * clamp) is not the same as zod's (is this even a string of plausible length).
 */

import { z } from 'zod';
import {
  ANSWER_MAX_LENGTH,
  DRAWING_GUESS_MAX_LENGTH,
  DRAWING_PAYLOAD_MAX_BYTES,
  MESSAGE_MAX_BYTES,
  NAME_MAX_LENGTH,
  ROUNDS_MAX,
  ROUNDS_MIN,
} from '../../shared/constants.js';
import type { ClientMessage } from '../../shared/protocol.js';

/**
 * Raw string limits are generous multiples of the display limits: NFKC folding and
 * whitespace collapsing can shrink a string, so rejecting at exactly the display
 * limit would refuse text that sanitises down to something legal.
 */
const RAW_SLACK = 4;

const rawText = (max: number) => z.string().max(max * RAW_SLACK);
const id = z.string().min(1).max(64);

const settingsPatch = z
  .object({
    mode: z.enum(['classic', 'crude']).optional(),
    rounds: z.number().int().min(ROUNDS_MIN).max(ROUNDS_MAX).optional(),
    timerSpeed: z.enum(['fast', 'normal', 'relaxed']).optional(),
    drawingFinale: z.boolean().optional(),
  })
  .strict();

/**
 * A data URL for a PNG. The prefix is pinned so a client cannot smuggle
 * `data:text/html` into something that is later rendered as an image source.
 */
const pngDataUrl = z
  .string()
  .max(DRAWING_PAYLOAD_MAX_BYTES)
  .refine((value) => value.startsWith('data:image/png;base64,'), {
    message: 'drawing must be a base64 PNG data URL',
  })
  .refine((value) => /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value), {
    message: 'drawing payload is not valid base64',
  });

export const clientMessageSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('create_room'),
    protocolVersion: z.number().int(),
    hostName: rawText(NAME_MAX_LENGTH).optional(),
    mode: z.enum(['classic', 'crude']).optional(),
  }),
  z.object({
    t: z.literal('join_room'),
    protocolVersion: z.number().int(),
    code: z.string().max(32),
  }),
  z.object({ t: z.literal('identify'), name: rawText(NAME_MAX_LENGTH), avatarId: id }),
  z.object({ t: z.literal('set_ready'), ready: z.boolean() }),
  z.object({ t: z.literal('advance_ready'), ready: z.boolean() }),
  z.object({ t: z.literal('update_settings'), settings: settingsPatch }),
  z.object({ t: z.literal('kick_player'), playerId: id }),
  z.object({ t: z.literal('start_game') }),
  z.object({ t: z.literal('submit_answer'), roundId: id, text: rawText(ANSWER_MAX_LENGTH) }),
  z.object({ t: z.literal('submit_vote'), roundId: id, answerId: id }),
  z.object({ t: z.literal('submit_drawing'), roundId: id, strokesPngDataUrl: pngDataUrl }),
  z.object({
    t: z.literal('submit_drawing_guess'),
    roundId: id,
    text: rawText(DRAWING_GUESS_MAX_LENGTH),
  }),
  z.object({ t: z.literal('submit_drawing_vote'), roundId: id, optionId: id }),
  z.object({ t: z.literal('advance') }),
  z.object({ t: z.literal('play_again') }),
  z.object({ t: z.literal('return_to_lobby') }),
  z.object({
    t: z.literal('reconnect'),
    protocolVersion: z.number().int(),
    roomCode: z.string().max(32),
    playerId: id,
    token: z.string().min(1).max(128),
  }),
  z.object({ t: z.literal('acknowledge_adult') }),
  z.object({ t: z.literal('ping'), sentAt: z.number() }),
]);

export type ParseResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; reason: 'too_large' | 'not_json' | 'not_a_message'; detail: string };

/**
 * Parse a raw WebSocket frame.
 *
 * Refuses, in order: binary frames, oversized payloads, malformed JSON, and
 * anything that is not a message in the schema. None of these mutate state, and
 * none of them leak an internal detail back to the client.
 */
export function parseClientMessage(raw: string | ArrayBuffer): ParseResult {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'not_json', detail: 'binary frames are not part of the protocol' };
  }
  if (raw.length > MESSAGE_MAX_BYTES) {
    return { ok: false, reason: 'too_large', detail: `${raw.length} bytes` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'not_json', detail: 'payload was not JSON' };
  }

  const result = clientMessageSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.join('.') ?? '';
    return {
      ok: false,
      reason: 'not_a_message',
      detail: where.length > 0 ? `${where}: ${first?.message ?? ''}` : (first?.message ?? 'invalid'),
    };
  }

  return { ok: true, message: result.data as ClientMessage };
}
