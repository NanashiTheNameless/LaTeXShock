'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseLatexLog, logIndicatesFailure } = require('../out/logparse.js');

const SAMPLE_LOG = [
  'This is pdfTeX, Version 3.14159265',
  'Overfull \\hbox (15.0pt too wide) in paragraph at lines 10--12',
  'Underfull \\hbox (badness 10000) in paragraph at lines 20--21',
  "LaTeX Warning: Reference `sec:intro' on page 1 undefined on input line 5.",
  "LaTeX Warning: Citation `knuth1984' on page 2 undefined on input line 30.",
  'Package hyperref Warning: Rerun to get outlines right.',
  "LaTeX Font Warning: Font shape `OT1/cmr/m/n' undefined.",
  'LaTeX Warning: There were undefined references.',
  'Output written on main.pdf (3 pages).',
].join('\n');

test('parseLatexLog tallies each warning category from a sample log', () => {
  const c = parseLatexLog(SAMPLE_LOG);
  assert.equal(c.overfullHbox, 1);
  assert.equal(c.underfullHbox, 1);
  // Reference + Citation + "There were undefined references."
  assert.equal(c.undefinedReferences, 3);
  assert.equal(c.fontWarnings, 1);
  assert.equal(c.packageWarnings, 1);
});

test('parseLatexLog counts a generic warning as a package warning', () => {
  const c = parseLatexLog('LaTeX Warning: Something generic happened.');
  assert.equal(c.packageWarnings, 1);
});

test('parseLatexLog returns all-zero counts for a clean log', () => {
  const c = parseLatexLog('This is pdfTeX.\nOutput written on main.pdf (1 page).');
  assert.equal(c.overfullHbox + c.underfullHbox + c.undefinedReferences + c.packageWarnings + c.fontWarnings, 0);
});

test('logIndicatesFailure detects error and emergency-stop markers', () => {
  assert.equal(logIndicatesFailure('! Undefined control sequence.\nl.5 \\foo'), true);
  assert.equal(logIndicatesFailure('Something\n! Emergency stop.\n'), true);
  assert.equal(logIndicatesFailure('Output written on main.pdf (1 page).'), false);
});
