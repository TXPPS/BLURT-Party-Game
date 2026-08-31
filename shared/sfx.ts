/**
 * BLURT — sound event vocabulary.
 *
 * The *names* of sounds live in `/shared` because three places need to agree on
 * them: the server (which drives dramatic cues over the `sfx` message), the content
 * pack (whose sections declare an `audioCue`), and the browser synth engine (which
 * decides how to actually make the noise).
 *
 * No audio files exist anywhere in this project. Every sound is synthesised at
 * runtime from oscillators and noise — see `web/src/audio/synth.ts`.
 */

export const SFX_EVENTS = [
  // UI feedback — played locally on the device that caused them.
  'ui_click',
  'ui_back',
  'join',
  'ready',
  'submit',
  'vote_cast',

  // Dramatic cues — driven by the server so every screen lands together.
  'game_start',
  'prompt_in',
  'timer_warning',
  'timer_out',
  'reveal',
  'votes_locked',
  'win_sting',
  'lose_sting',
  'buzzer',
  'ding',
  'applause',
  'gasp',
  'airhorn',
  'sad_trombone',
  'record_scratch',
  'spring',
  'splat',
  'glass_break',
  'distant_scream',
  'angel_choir',
  'awkward_cough',
  'censor_beep',
  'drumroll',
  'story_stamp',
  'final_fanfare',

  // Crude pool — only reachable when the room mode is 'crude'.
  'fart_small',
  'fart_large',
  'toilet_flush',
  'wet_splat',
  'wheeze_laugh',
] as const;

export type SfxEventId = (typeof SFX_EVENTS)[number];

/** Events that are only ever played in Crude mode. */
export const CRUDE_ONLY_SFX: ReadonlySet<SfxEventId> = new Set<SfxEventId>([
  'fart_small',
  'fart_large',
  'toilet_flush',
  'wet_splat',
  'wheeze_laugh',
]);

/**
 * Events a device plays for its own interactions rather than waiting for the server.
 *
 * The two timer cues are here deliberately. Dramatic cues are server-driven and, by
 * default, only the shared screen plays them — but "your time is running out" is
 * about this player's own deadline, so every device must be able to sound its own.
 */
export const LOCAL_UI_SFX: ReadonlySet<SfxEventId> = new Set<SfxEventId>([
  'ui_click',
  'ui_back',
  'join',
  'ready',
  'submit',
  'vote_cast',
  'timer_warning',
  'timer_out',
]);

const EVENT_SET: ReadonlySet<string> = new Set(SFX_EVENTS);

export function isSfxEventId(value: string): value is SfxEventId {
  return EVENT_SET.has(value);
}
