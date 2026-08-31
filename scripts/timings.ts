/**
 * BLURT — match timing report.
 *
 * Answers two different questions that are easy to conflate:
 *
 *   **Round-trip time** is the network. A ping is sent on every phase change and the
 *   server echoes `sentAt`, so each sample is a true client→edge→client round trip
 *   measured by the same clock. Against `wrangler dev` this is loopback and will read
 *   as ~1ms; against a deployed Worker it is what a player's phone actually feels.
 *
 *   **Phase duration** is the pacing. How long each phase really ran, which is a
 *   design number, not a network one — it barely moves between local and production.
 *
 * Reporting them in one table with separate columns keeps anybody from reading a fast
 * local run as evidence that the deployed game will feel fast.
 */

import type { Phase } from '../shared/types.js';
import type { Bot } from './botHarness.js';

export interface PhaseTiming {
  phase: Phase;
  /** How many times the match entered this phase. */
  occurrences: number;
  /** Total time spent in this phase across the whole match. */
  totalMs: number;
  /** Mean time per visit — the number that describes how the phase feels. */
  meanMs: number;
  longestMs: number;
  samples: number;
  medianRttMs: number | null;
  p95RttMs: number | null;
  maxRttMs: number | null;
}

function quantile(sorted: readonly number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return sorted[index] ?? null;
}

/**
 * Fold every bot's samples together.
 *
 * The phase sequence is taken from whichever bot saw the most transitions — a bot
 * that dropped mid-match has a short log, and using it would lose phases entirely.
 */
export function collectTimings(bots: readonly Bot[], matchEndedAt: number): PhaseTiming[] {
  const sequence = bots
    .map((b) => b.phaseLog)
    .reduce<{ phase: Phase; at: number }[]>((best, log) => (log.length > best.length ? log : best), []);

  const durations = new Map<Phase, number[]>();
  for (let i = 0; i < sequence.length; i += 1) {
    const entry = sequence[i];
    if (entry === undefined) continue;
    const next = sequence[i + 1];
    const endedAt = next === undefined ? matchEndedAt : next.at;
    const list = durations.get(entry.phase) ?? [];
    list.push(Math.max(0, endedAt - entry.at));
    durations.set(entry.phase, list);
  }

  const rtts = new Map<Phase, number[]>();
  for (const bot of bots) {
    for (const sample of bot.rtt) {
      const list = rtts.get(sample.phase) ?? [];
      list.push(sample.ms);
      rtts.set(sample.phase, list);
    }
  }

  // First-appearance order, so the table reads in the order a player lived it.
  const order: Phase[] = [];
  for (const entry of sequence) if (!order.includes(entry.phase)) order.push(entry.phase);

  return order.map((phase) => {
    const spent = durations.get(phase) ?? [];
    const total = spent.reduce((a, b) => a + b, 0);
    const samples = (rtts.get(phase) ?? []).slice().sort((a, b) => a - b);
    return {
      phase,
      occurrences: spent.length,
      totalMs: total,
      meanMs: spent.length === 0 ? 0 : Math.round(total / spent.length),
      longestMs: spent.length === 0 ? 0 : Math.max(...spent),
      samples: samples.length,
      medianRttMs: quantile(samples, 0.5),
      p95RttMs: quantile(samples, 0.95),
      maxRttMs: samples.at(-1) ?? null,
    };
  });
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

function ms(value: number | null): string {
  return value === null ? '\u2014' : `${value}ms`;
}

function secs(value: number): string {
  return `${(value / 1000).toFixed(1)}s`;
}

/** A fixed-width table, so it is readable pasted into a report. */
export function formatTimings(rows: readonly PhaseTiming[], totalMs: number, url: string): string {
  const lines: string[] = [];
  const local = /localhost|127\.0\.0\.1/.test(url);

  lines.push('');
  lines.push('\u2500'.repeat(8) + ' PHASE TIMINGS ' + '\u2500'.repeat(8));
  lines.push(`target: ${url}`);
  if (local) lines.push('NOTE: loopback \u2014 the RTT columns are not representative of the edge.');
  lines.push('');
  lines.push(
    pad('phase', 18) + pad('n', 4) + pad('mean', 9) + pad('longest', 10) +
      pad('total', 9) + pad('rtt p50', 10) + pad('rtt p95', 10) + 'rtt max',
  );
  lines.push('\u2500'.repeat(78));

  for (const row of rows) {
    lines.push(
      pad(row.phase, 18) +
        pad(String(row.occurrences), 4) +
        pad(secs(row.meanMs), 9) +
        pad(secs(row.longestMs), 10) +
        pad(secs(row.totalMs), 9) +
        pad(ms(row.medianRttMs), 10) +
        pad(ms(row.p95RttMs), 10) +
        ms(row.maxRttMs),
    );
  }

  const all = rows.flatMap((r) => r.samples === 0 ? [] : [r.medianRttMs ?? 0]);
  const overall = all.length === 0 ? null : Math.round(all.reduce((a, b) => a + b, 0) / all.length);
  const accounted = rows.reduce((sum, r) => sum + r.totalMs, 0);

  lines.push('\u2500'.repeat(78));
  lines.push(`total match wall time:        ${secs(totalMs)}  (${secs(accounted)} inside phases)`);
  lines.push(`mean of per-phase median RTT: ${ms(overall)}`);
  lines.push('');
  return lines.join('\n');
}
