'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { matchCategory, totalIssues, emptyCounts } = require('../out/patterns.js');

test('matchCategory recognizes LaTeX warning shapes', () => {
  assert.equal(matchCategory('Overfull \\hbox (12.3pt too wide) in paragraph'), 'overfullHbox');
  assert.equal(matchCategory('Underfull \\hbox (badness 10000) in paragraph'), 'underfullHbox');
  assert.equal(
    matchCategory("LaTeX Warning: Reference `fig:foo' on page 1 undefined on input line 42."),
    'undefinedReferences',
  );
  assert.equal(
    matchCategory("LaTeX Warning: Citation `bar' on page 1 undefined on input line 10."),
    'undefinedReferences',
  );
  assert.equal(matchCategory('LaTeX Font Warning: Font shape undefined'), 'fontWarnings');
  assert.equal(matchCategory('Package hyperref Warning: Token not allowed'), 'packageWarnings');
});

test('matchCategory returns null for unrelated text', () => {
  assert.equal(matchCategory('This is a perfectly fine line of output.'), null);
});

test('font is matched before the generic undefined-reference pattern', () => {
  // Contains both "Font" and "undefined"; font bucket must win by order.
  assert.equal(matchCategory('LaTeX Font Warning: Font shape undefined'), 'fontWarnings');
});

test('totalIssues sums all categories', () => {
  const c = { ...emptyCounts(), undefinedReferences: 2, packageWarnings: 3 };
  assert.equal(totalIssues(c), 5);
});
