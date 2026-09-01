/**
 * BLURT — file-based music.
 *
 * Replaces the procedural bed, which a playtest fairly described as a loud drone.
 * Two tracks, supplied by whoever is running the game, living in `web/public/music`.
 *
 * Three things this is careful about, all of them learned from the thing it replaced:
 *
 *   1. **Quiet.** The default level is deliberately low. Bed music that competes with
 *      the room is worse than no bed music.
 *   2. **Absent files are normal.** The folder ships empty. A missing track means
 *      silence for those screens — no throw, no retry loop, and nothing written to
 *      the console, because a QA session should not be a wall of 404 noise.
 *   3. **It routes through the mixer.** Everything goes to the Synth's music bus, so
 *      the existing slider and mute govern it without any special-casing.
 */

import { MUSIC_CROSSFADE_MS } from '../../../shared/constants.js';

export type MusicTrack = 'lobby' | 'game';

/** Ogg first — see web/public/music/README.md for why. */
const SOURCES: Record<MusicTrack, string[]> = {
  lobby: ['/music/lobby.ogg', '/music/lobby.mp3'],
  game: ['/music/game.ogg', '/music/game.mp3'],
};

interface Loaded {
  element: HTMLAudioElement;
  gain: GainNode;
}

/**
 * Resolve the first source that actually exists.
 *
 * Checking `response.ok` is not enough, and finding that out is the reason this
 * function looks the way it does. The site is served with
 * `not_found_handling = "single-page-application"`, so a request for a track that is
 * not there returns **200 with index.html** — indistinguishable from a real hit by
 * status alone, and the player would hand a page of HTML to an <audio> element.
 *
 * So the content type decides. Anything that is not audio is treated as absent.
 */
async function firstPlayable(urls: readonly string[]): Promise<string | null> {
  for (const url of urls) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (!response.ok) continue;
      const type = response.headers.get('content-type') ?? '';
      if (type.startsWith('audio/')) return url;
    } catch {
      // Offline, blocked, whatever. Treat as absent.
    }
  }
  return null;
}

export class MusicPlayer {
  private readonly loaded = new Map<MusicTrack, Loaded | null>();
  private current: MusicTrack | null = null;
  private level = 0;
  private ducked = false;

  constructor(
    private readonly ctx: AudioContext,
    private readonly destination: GainNode,
  ) {}

  get playing(): MusicTrack | null {
    return this.current;
  }

  /**
   * Load a track once. `null` is cached too, so a missing file is asked for exactly
   * once per session rather than on every phase change.
   */
  private async load(track: MusicTrack): Promise<Loaded | null> {
    const cached = this.loaded.get(track);
    if (cached !== undefined) return cached;

    const url = await firstPlayable(SOURCES[track]);
    if (url === null) {
      this.loaded.set(track, null);
      return null;
    }

    const element = new Audio(url);
    element.loop = true;
    element.preload = 'auto';
    element.crossOrigin = 'anonymous';

    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    this.ctx.createMediaElementSource(element).connect(gain);
    gain.connect(this.destination);

    const entry: Loaded = { element, gain };
    this.loaded.set(track, entry);
    return entry;
  }

  /** Fade to `track`, or to silence when it is null. Safe to call repeatedly. */
  async play(track: MusicTrack | null, level: number): Promise<void> {
    this.level = level;
    if (track === this.current) {
      this.applyLevel();
      return;
    }

    const previous = this.current === null ? null : (this.loaded.get(this.current) ?? null);
    this.current = track;

    const next = track === null ? null : await this.load(track);
    // Another change may have landed while that awaited.
    if (this.current !== track) return;

    const now = this.ctx.currentTime;
    const seconds = MUSIC_CROSSFADE_MS / 1000;

    if (previous !== null) {
      previous.gain.gain.cancelScheduledValues(now);
      previous.gain.gain.setTargetAtTime(0, now, seconds / 3);
      // Left playing briefly so the fade is audible, then parked.
      globalThis.setTimeout(() => previous.element.pause(), MUSIC_CROSSFADE_MS + 100);
    }

    if (next === null) return;
    try {
      await next.element.play();
    } catch {
      // Autoplay refused, or the file went away. Silence is an acceptable outcome.
      return;
    }
    next.gain.gain.cancelScheduledValues(this.ctx.currentTime);
    next.gain.gain.setTargetAtTime(this.target(), this.ctx.currentTime, seconds / 3);
  }

  private target(): number {
    return this.ducked ? this.level * 0.25 : this.level;
  }

  private applyLevel(): void {
    const entry = this.current === null ? null : (this.loaded.get(this.current) ?? null);
    entry?.gain.gain.setTargetAtTime(this.target(), this.ctx.currentTime, 0.1);
  }

  setLevel(level: number): void {
    this.level = level;
    this.applyLevel();
  }

  /** Pull the music down under a sting or a reveal, then let it back up. */
  duckFor(seconds: number): void {
    const entry = this.current === null ? null : (this.loaded.get(this.current) ?? null);
    if (entry === undefined || entry === null) return;
    this.ducked = true;
    this.applyLevel();
    globalThis.setTimeout(() => {
      this.ducked = false;
      this.applyLevel();
    }, seconds * 1000);
  }

  stop(): void {
    void this.play(null, this.level);
  }
}
