'use strict';

// A full LatexShockConfig object with the same defaults as src/config.ts, for
// use in unit tests. `overrides` is shallow-merged per top-level group.
function defaultConfig(overrides = {}) {
  const base = {
    enabled: true,
    dryRun: false,
    mode: 'scaled',
    connection: { apiBaseUrl: 'https://api.openshock.app', shockerId: 'test' },
    build: { taskFilter: 'latex' },
    diagnostics: { source: 'diagnostics', logPath: '' },
    triggers: {
      compileFailure: true,
      undefinedReferences: true,
      overfullHbox: true,
      underfullHbox: true,
      packageWarnings: true,
      fontWarnings: true,
    },
    weights: {
      compileFailure: 100,
      undefinedReference: 15,
      overfullHbox: 3,
      underfullHbox: 2,
      packageWarning: 5,
      fontWarning: 2,
    },
    power: { min: 10, max: 80, failureOverride: 100 },
    duration: { minMs: 500, maxMs: 5000, failureMs: 3000 },
    scaling: { curve: 'linear', target: 'power', referenceScore: 100, stepThresholds: [1, 3, 6, 10] },
    pulses: { intensity: 20, durationMs: 300, maxCount: 5, spacingMs: 5000 },
    safety: { hardMaxPower: 100, cooldownMs: 5000 },
  };
  const merged = { ...base };
  for (const key of Object.keys(overrides)) {
    merged[key] =
      typeof overrides[key] === 'object' && !Array.isArray(overrides[key])
        ? { ...base[key], ...overrides[key] }
        : overrides[key];
  }
  return merged;
}

function counts(overrides = {}) {
  return {
    undefinedReferences: 0,
    overfullHbox: 0,
    underfullHbox: 0,
    packageWarnings: 0,
    fontWarnings: 0,
    ...overrides,
  };
}

module.exports = { defaultConfig, counts };
