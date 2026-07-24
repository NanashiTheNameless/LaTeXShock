import { IssueCounts, emptyCounts, matchCategory } from './patterns';

/**
 * Parses the text of a LaTeX `.log` file (from `latexmk`/`pdflatex`) into
 * per-category issue counts.
 *
 * This is the manual-parsing alternative to the VS Code diagnostics API. It
 * is line-based: LaTeX wraps log lines near 79 columns, so a warning whose
 * keyword is pushed onto a continuation line can be missed. For the common
 * single-line warnings (undefined refs/citations, over/underfull hbox,
 * package/font warnings) it is reliable, and it is free of any `vscode`
 * dependency so it can be unit-tested directly.
 */
export function parseLatexLog(content: string): IssueCounts {
  const counts = emptyCounts();
  for (const line of content.split(/\r?\n/)) {
    const category = matchCategory(line);
    if (category) {
      counts[category] += 1;
      continue;
    }
    // A generic warning line with no more specific match counts as a package
    // warning, mirroring the diagnostics classifier's fallback.
    if (/warning/i.test(line)) {
      counts.packageWarnings += 1;
    }
  }
  return counts;
}

/**
 * Heuristic detection of a hard failure from log text. A LaTeX error line
 * begins with `!` (e.g. `! Undefined control sequence.`), and a fatal run
 * typically ends with an emergency stop. Callers should still prefer the
 * build task's exit code when they have it; this exists for parity when only
 * the log is available.
 */
export function logIndicatesFailure(content: string): boolean {
  return /^!\s/m.test(content) || /Emergency stop/i.test(content) || /Fatal error occurred/i.test(content);
}
