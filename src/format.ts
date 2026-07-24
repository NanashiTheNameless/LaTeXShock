import { CATEGORIES, IssueCounts } from './patterns';

/**
 * Presentation helpers for the log. Kept free of any `vscode` import so they
 * can be exercised by the plain-Node unit tests.
 */

/** Width of the `[tag]` column, so message text lines up down the log. */
const TAG_WIDTH = 10;

/**
 * Renders an event as a padded tag plus message, giving the log a stable left
 * column: `[shock]    sent · power 59 · 500ms`.
 */
export function event(tag: string, message: string): string {
  return `${`[${tag}]`.padEnd(TAG_WIDTH)} ${message}`;
}

/**
 * Human-readable issue tally listing only the categories that actually fired,
 * so a single warning doesn't print four zeroes alongside it.
 */
export function counts(value: IssueCounts): string {
  const parts = CATEGORIES.filter(({ category }) => value[category] > 0).map(
    ({ category, label }) => `${value[category]} ${label}`,
  );
  return parts.length > 0 ? parts.join(' · ') : 'no scorable issues';
}

/** `450ms`, `1.5s`, `3s` - short enough to sit inline in a message. */
export function duration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`;
}

/** `power 59 · 500ms` - the two numbers that describe an activation. */
export function output(power: number, durationMs: number): string {
  return `power ${power} · ${duration(durationMs)}`;
}
