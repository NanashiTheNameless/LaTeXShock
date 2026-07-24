/**
 * The issue categories that contribute to a scaled "compiled but dirty" score,
 * and the single source of truth describing each one.
 *
 * This module is deliberately free of any `vscode` import so it can be reused
 * by the log parser and exercised by plain-Node unit tests. Everything that
 * needs to enumerate categories - scoring, formatting, tallying - iterates
 * `CATEGORIES` rather than repeating the list, so adding a category is a single
 * new entry here.
 */
export type IssueCategory =
  | 'undefinedReferences'
  | 'overfullHbox'
  | 'underfullHbox'
  | 'packageWarnings'
  | 'fontWarnings';

/** Config keys that select and weight a category, plus its display label. */
export interface CategoryMeta {
  /** Key into `IssueCounts` and `LatexShockConfig.triggers`. */
  readonly category: IssueCategory;
  /** Key into `LatexShockConfig.weights` (weights use singular-ish names). */
  readonly weightKey:
    | 'undefinedReference'
    | 'overfullHbox'
    | 'underfullHbox'
    | 'packageWarning'
    | 'fontWarning';
  /** Human-readable label used in the log. */
  readonly label: string;
}

export const CATEGORIES: readonly CategoryMeta[] = [
  { category: 'undefinedReferences', weightKey: 'undefinedReference', label: 'undefined refs' },
  { category: 'overfullHbox', weightKey: 'overfullHbox', label: 'overfull hbox' },
  { category: 'underfullHbox', weightKey: 'underfullHbox', label: 'underfull hbox' },
  { category: 'packageWarnings', weightKey: 'packageWarning', label: 'package warnings' },
  { category: 'fontWarnings', weightKey: 'fontWarning', label: 'font warnings' },
];

/**
 * A tally of how many issues fell into each scalable category.
 */
export type IssueCounts = Record<IssueCategory, number>;

export function emptyCounts(): IssueCounts {
  const counts = {} as IssueCounts;
  for (const { category } of CATEGORIES) {
    counts[category] = 0;
  }
  return counts;
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
  let total = 0;
  for (const { category } of CATEGORIES) {
    total += counts[category];
  }
  return total;
}
