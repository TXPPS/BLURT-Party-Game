/**
 * BLURT — drawing storage.
 *
 * Durable Object storage caps a single value at 128 KiB, and the protocol allows a
 * 200 KB drawing, so images cannot live in the room state object. They are chunked
 * into their own keys instead, which keeps the room state small (it is written on
 * every mutation) and keeps hibernation safe (a drawing survives eviction).
 *
 * Chunks are also held in memory for the life of the object, because the guess and
 * vote phases re-broadcast the same image on every state change.
 */

import { DRAWING_STORAGE_CHUNK_BYTES } from '../../shared/constants.js';

const KEY_PREFIX = 'drawing:';

function chunkKey(index: number, chunk: number): string {
  return `${KEY_PREFIX}${index}:${chunk}`;
}

function countKey(index: number): string {
  return `${KEY_PREFIX}${index}:count`;
}

export class DrawingStore {
  private readonly cache = new Map<number, string>();

  constructor(private readonly storage: DurableObjectStorage) {}

  /** Persist a drawing, splitting it below the per-value storage limit. */
  async put(index: number, dataUrl: string): Promise<void> {
    const chunks: string[] = [];
    for (let offset = 0; offset < dataUrl.length; offset += DRAWING_STORAGE_CHUNK_BYTES) {
      chunks.push(dataUrl.slice(offset, offset + DRAWING_STORAGE_CHUNK_BYTES));
    }
    const writes: Record<string, string | number> = { [countKey(index)]: chunks.length };
    chunks.forEach((chunk, i) => {
      writes[chunkKey(index, i)] = chunk;
    });
    await this.storage.put(writes);
    this.cache.set(index, dataUrl);
  }

  /** Load a drawing back into memory. Returns null when there is nothing stored. */
  async load(index: number): Promise<string | null> {
    const cached = this.cache.get(index);
    if (cached !== undefined) return cached;

    const count = await this.storage.get<number>(countKey(index));
    if (typeof count !== 'number' || count <= 0) return null;

    const keys = Array.from({ length: count }, (_, i) => chunkKey(index, i));
    const parts = await this.storage.get<string>(keys);
    let dataUrl = '';
    for (const key of keys) {
      const part = parts.get(key);
      // A missing chunk means a torn write; treat the whole drawing as absent
      // rather than showing the room half a picture.
      if (part === undefined) return null;
      dataUrl += part;
    }

    this.cache.set(index, dataUrl);
    return dataUrl;
  }

  /** Synchronous read for view building. Only returns what is already in memory. */
  peek(index: number): string | null {
    return this.cache.get(index) ?? null;
  }

  /** Warm the cache for every drawing in a match, so view building stays sync. */
  async warm(count: number): Promise<void> {
    for (let index = 0; index < count; index += 1) {
      if (!this.cache.has(index)) await this.load(index);
    }
  }

  /**
   * Decode a stored drawing to raw PNG bytes for the HTTP route.
   * Returns null when there is nothing stored for that index.
   */
  toBytes(index: number): Uint8Array | null {
    const dataUrl = this.peek(index);
    if (dataUrl === null) return null;
    const comma = dataUrl.indexOf(',');
    if (comma < 0) return null;
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  /** Drop every drawing — used by PLAY AGAIN and by room destruction. */
  async clear(): Promise<void> {
    this.cache.clear();
    await this.storage.delete(
      [...(await this.storage.list({ prefix: KEY_PREFIX })).keys()],
    );
  }
}
