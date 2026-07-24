'use strict';

// Minimal `vscode` module stub so modules that `require('vscode')` (e.g. the
// diagnostics classifier) can be exercised under plain Node in unit tests.
// Requiring this file patches the module loader; it must be required before
// any module that imports `vscode`.

const Module = require('module');
const originalLoad = Module._load;

const vscodeStub = {
  DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
  languages: {
    getDiagnostics: () => [],
  },
  window: {},
  workspace: {
    getConfiguration: () => ({ get: (_key, def) => def }),
  },
};

Module._load = function (request, parent, isMain) {
  if (request === 'vscode') {
    return vscodeStub;
  }
  return originalLoad.apply(this, arguments);
};

module.exports = vscodeStub;
