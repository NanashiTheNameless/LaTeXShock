import * as vscode from 'vscode';
import { IssueCounts, emptyCounts, matchCategory } from './patterns';
import { IssueCategory } from './config';

export { IssueCounts, emptyCounts } from './patterns';

/**
 * Maps a single diagnostic message to a scalable issue category, or `null`
 * when it doesn't correspond to one we score.
 *
 * An unmatched message counts as a generic package/LaTeX warning only at
 * `Warning` severity. `Information` and `Hint` are deliberately excluded:
 * spell-checkers and style linters emit hints in bulk, and treating them as
 * LaTeX warnings turns a tidy document into a high-intensity shock.
 */
export function classify(
  message: string,
  severity: vscode.DiagnosticSeverity,
): IssueCategory | null {
  const matched = matchCategory(message);
  if (matched) {
    return matched;
  }
  if (severity === vscode.DiagnosticSeverity.Warning) {
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

const LATEX_FILE_RE = /\.(tex|ltx|bib|sty|cls|dtx|ins)$/i;

/**
 * Collects the URIs whose diagnostics should be scored.
 *
 * By default only LaTeX-ish source files count. Set `includeNonLatexFiles` to
 * score every file that has diagnostics instead - that enables the generalized
 * "any language whose tooling populates the Problems panel" use case, at the
 * cost of letting an unrelated linter in the workspace drive the shock.
 */
export function latexDiagnosticUris(includeNonLatexFiles = false): vscode.Uri[] {
  const withDiagnostics = vscode.languages.getDiagnostics().filter(([, diags]) => diags.length > 0);
  if (includeNonLatexFiles) {
    return withDiagnostics.map(([uri]) => uri);
  }
  return withDiagnostics.filter(([uri]) => LATEX_FILE_RE.test(uri.fsPath)).map(([uri]) => uri);
}
