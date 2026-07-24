'use strict';

// Must be required before anything that imports `vscode`.
const vscode = require('./vscode-stub');

const test = require('node:test');
const assert = require('node:assert/strict');

const { classify } = require('../out/classify.js');

test('classify maps a known pattern regardless of severity', () => {
  assert.equal(
    classify('Overfull \\hbox (10pt too wide)', vscode.DiagnosticSeverity.Error),
    'overfullHbox',
  );
});

test('classify buckets an unmatched non-error message as a package warning', () => {
  assert.equal(
    classify('some unrecognized warning text', vscode.DiagnosticSeverity.Warning),
    'packageWarnings',
  );
});

test('classify returns null for an unmatched error (not a scored warning)', () => {
  assert.equal(classify('some unrecognized error text', vscode.DiagnosticSeverity.Error), null);
});
