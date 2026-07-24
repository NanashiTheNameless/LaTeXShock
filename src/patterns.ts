import { IssueCategory } from './config';

/**
 * A tally of how many issues fell into each scalable category.
 *
 * This module is deliberately free of any `vscode` import so it can be reused
 * by the log parser and exercised by plain-Node unit tests.
 */
export type IssueCounts = Record<IssueCategory, number>;

export function emptyCounts(): IssueCounts {
  return {
    undefinedReferences: 0,
    overfullHbox: 0,
    underfullHbox: 0,
    packageWarnings: 0,
    fontWarnings: 0,
  };
}

export const PATTERNS: Array<{ category: IssueCategory; re: RegExp }> = [
  // Order matters: the first matching pattern wins, so specific buckets
  // (font, hbox, references) are tested before the generic warning bucket.
  { category: 'fontWarnings', re: /font\s+(warning|shape|substitut)/i },
  { category: 'overfullHbox', re: /overfull\s+\\?hbox/i },
  { category: 'underfullHbox', re: /underfull\s+\\?hbox/i },
  {
    category: 'undefinedReferences',
    re: /(undefined|unresolved|missing)\s+(reference|citation)|(reference|citation)[^.]*undefined|there were undefined references|label\(s\) may have changed/i,
  },
  { category: 'packageWarnings', re: /package\s+\S+\s+warning/i },
];

/**
 * Maps a message to a scalable issue category by pattern alone, or `null` when
 * no specific pattern matches. Severity-based fallbacks are the caller's job.
 */
export function matchCategory(message: string): IssueCategory | null {
  for (const { category, re } of PATTERNS) {
    if (re.test(message)) {
      return category;
    }
  }
  return null;
}

export function totalIssues(counts: IssueCounts): number {
  return (
    counts.undefinedReferences +
    counts.overfullHbox +
    counts.underfullHbox +
    counts.packageWarnings +
    counts.fontWarnings
  );
}
