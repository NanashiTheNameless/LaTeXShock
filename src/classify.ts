import * as vscode from 'vscode';
import { IssueCounts, emptyCounts, matchCategory } from './patterns';
import { IssueCategory } from './config';

export { IssueCounts, emptyCounts } from './patterns';

/**
 * Maps a single diagnostic message to a scalable issue category, or `null`
 * when it doesn't correspond to one we score.
 *
 * Any unmatched message at Warning severity or below is treated as a generic
 * package/LaTeX warning, since that is the broadest configured bucket.
 */
export function classify(
  message: string,
  severity: vscode.DiagnosticSeverity,
): IssueCategory | null {
  const matched = matchCategory(message);
  if (matched) {
    return matched;
  }
  if (severity !== vscode.DiagnosticSeverity.Error) {
    return 'packageWarnings';
  }
  return null;
}

/**
 * Tallies the diagnostics currently reported for the given documents into
 * per-category counts. `uris` should be the source files whose diagnostics
 * we care about (typically the `.tex`/`.bib` files of the build).
 */
export function tally(uris: readonly vscode.Uri[]): IssueCounts {
  const counts = emptyCounts();
  for (const uri of uris) {
    for (const diag of vscode.languages.getDiagnostics(uri)) {
      const category = classify(diag.message, diag.severity);
      if (category) {
        counts[category] += 1;
      }
    }
  }
  return counts;
}

/**
 * Collects the URIs of diagnostics that belong to LaTeX-ish source files.
 * Falls back to every file that currently has diagnostics when nothing looks
 * LaTeX-specific, so non-LaTeX languages (the generalized use case) still work.
 */
export function latexDiagnosticUris(): vscode.Uri[] {
  const all = vscode.languages.getDiagnostics();
  const latexLike = all
    .filter(([uri]) => /\.(tex|ltx|bib|sty|cls|dtx|ins)$/i.test(uri.fsPath))
    .map(([uri]) => uri);
  if (latexLike.length > 0) {
    return latexLike;
  }
  return all.filter(([, diags]) => diags.length > 0).map(([uri]) => uri);
}
