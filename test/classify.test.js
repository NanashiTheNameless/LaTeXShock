'use strict';

// Must be required before anything that imports `vscode`.
const vscode = require('./vscode-stub');

const test = require('node:test');
const assert = require('node:assert/strict');

const { classify, latexDiagnosticUris } = require('../out/classify.js');

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

test('classify ignores Information and Hint severities', () => {
  // Spell-checkers and style linters emit these in bulk; counting them turned
  // a clean document into a high-intensity shock.
  assert.equal(classify('"foo": Unknown word.', vscode.DiagnosticSeverity.Hint), null);
  assert.equal(classify('some informational note', vscode.DiagnosticSeverity.Information), null);
});

test('classify still matches a known pattern at Hint severity', () => {
  assert.equal(
    classify('Overfull \\hbox (10pt too wide)', vscode.DiagnosticSeverity.Hint),
    'overfullHbox',
  );
});

test('latexDiagnosticUris only returns LaTeX sources by default', () => {
  const original = vscode.languages.getDiagnostics;
  vscode.languages.getDiagnostics = () => [
    [{ fsPath: '/w/paper.tex' }, [{}]],
    [{ fsPath: '/w/README.md' }, [{}, {}]],
    [{ fsPath: '/w/refs.bib' }, [{}]],
    [{ fsPath: '/w/empty.tex' }, []],
  ];
  try {
    assert.deepEqual(
      latexDiagnosticUris().map((u) => u.fsPath),
      ['/w/paper.tex', '/w/refs.bib'],
    );
    assert.deepEqual(
      latexDiagnosticUris(true).map((u) => u.fsPath),
      ['/w/paper.tex', '/w/README.md', '/w/refs.bib'],
    );
  } finally {
    vscode.languages.getDiagnostics = original;
  }
});

test('latexDiagnosticUris does not fall back to non-LaTeX files when none match', () => {
  const original = vscode.languages.getDiagnostics;
  vscode.languages.getDiagnostics = () => [[{ fsPath: '/w/README.md' }, [{}]]];
  try {
    assert.deepEqual(latexDiagnosticUris(), []);
  } finally {
    vscode.languages.getDiagnostics = original;
  }
});
