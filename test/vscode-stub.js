'use strict';

// Minimal `vscode` module stub so modules that `require('vscode')` (e.g. the
// diagnostics classifier and the controller) can be exercised under plain Node
// in unit tests. Requiring this file patches the module loader; it must be
// required before any module that imports `vscode`.

const Module = require('module');
const originalLoad = Module._load;

// Config values tests can override via `__setConfig`, keyed by the full dotted
// path (e.g. 'latexShock.safety.hardMaxPower'). Anything unset falls through to
// the default the caller passes to `get(key, default)`.
let configOverrides = {};

const vscodeStub = {
  DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
  languages: {
    getDiagnostics: () => [],
  },
  window: {
    showInformationMessage: () => undefined,
    showWarningMessage: () => undefined,
    showErrorMessage: () => undefined,
  },
  workspace: {
    getConfiguration: (section) => ({
      get: (key, def) => {
        const full = section ? `${section}.${key}` : key;
        return Object.prototype.hasOwnProperty.call(configOverrides, full)
          ? configOverrides[full]
          : def;
      },
    }),
  },
  /** Replace the config overrides used by `getConfiguration().get`. */
  __setConfig: (overrides) => {
    configOverrides = overrides || {};
  },
};

Module._load = function (request, parent, isMain) {
  if (request === 'vscode') {
    return vscodeStub;
  }
  return originalLoad.apply(this, arguments);
};

module.exports = vscodeStub;
