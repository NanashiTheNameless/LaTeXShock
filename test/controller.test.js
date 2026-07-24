'use strict';

// Must be required before anything that imports `vscode`.
const vscode = require('./vscode-stub');

const test = require('node:test');
const assert = require('node:assert/strict');

const { Controller } = require('../out/controller.js');

// A logger that discards everything - the tests assert on sends, not log text.
const nullLog = { info() {}, warn() {}, error() {}, debug() {} };

// SecretStorage fake that always yields a token.
const secretsWithToken = {
  get: async () => 'test-token',
  store: async () => {},
  delete: async () => {},
};

/**
 * Builds a controller with a fake clock and a capturing sender, plus the config
 * overrides for a run. Returns the controller and the array of sent requests.
 */
// Start the fake clock well past zero: `lastActivation` initializes to 0, so a
// clock starting at 0 would put the very first activation inside the cooldown
// window (real `Date.now()` is always large, so this never happens in prod).
function makeController(config, { start = 1_000_000 } = {}) {
  vscode.__setConfig({
    'latexShock.enabled': true,
    'latexShock.connection.shockerId': 'shocker-1',
    ...config,
  });
  const sent = [];
  let clock = start;
  const controller = new Controller(secretsWithToken, nullLog, {
    now: () => clock,
    send: async (req) => {
      sent.push(req);
    },
  });
  return { controller, sent, advance: (ms) => (clock += ms) };
}

test('hardMaxPower of 0 sends nothing (does not floor to intensity 1)', async () => {
  // Regression: the plan clamps power to 0, but the OpenShock client floors
  // intensity at 1, so without the dispatch guard this delivered a shock.
  const { controller, sent } = makeController({
    'latexShock.safety.hardMaxPower': 0,
  });
  await controller.onCompileFailure();
  assert.equal(sent.length, 0);
});

test('a test shock also respects a hardMaxPower of 0', async () => {
  const { controller, sent } = makeController({
    'latexShock.enabled': false, // test shock ignores this
    'latexShock.safety.hardMaxPower': 0,
  });
  await controller.onTestShock();
  assert.equal(sent.length, 0);
});

test('a compile failure sends one shock at the failure override', async () => {
  const { controller, sent } = makeController({
    'latexShock.power.failureOverride': 100,
    'latexShock.duration.failureMs': 3000,
  });
  await controller.onCompileFailure();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].intensity, 100);
  assert.equal(sent[0].durationMs, 3000);
  assert.equal(sent[0].shockerId, 'shocker-1');
});

test('the cooldown drops a second activation inside the window', async () => {
  const { controller, sent, advance } = makeController({
    'latexShock.safety.cooldownMs': 5000,
  });
  await controller.onCompileFailure();
  advance(4000); // still inside the 5s window
  await controller.onCompileFailure();
  assert.equal(sent.length, 1);

  advance(2000); // now past it (6s total)
  await controller.onCompileFailure();
  assert.equal(sent.length, 2);
});

test('an unchanged dirty result is not sent twice', async () => {
  const { controller, sent, advance } = makeController({
    'latexShock.safety.cooldownMs': 0, // isolate dedupe from the cooldown
    'latexShock.triggers.packageWarnings': true,
    'latexShock.weights.packageWarning': 5,
  });
  const counts = {
    undefinedReferences: 0,
    overfullHbox: 0,
    underfullHbox: 0,
    packageWarnings: 3,
    fontWarnings: 0,
  };
  await controller.onDirtyCompile(counts);
  advance(10);
  await controller.onDirtyCompile(counts); // identical -> skipped
  assert.equal(sent.length, 1);
});

test('a forced dirty result fires even when counts are unchanged', async () => {
  const { controller, sent, advance } = makeController({
    'latexShock.safety.cooldownMs': 0,
    'latexShock.triggers.packageWarnings': true,
    'latexShock.weights.packageWarning': 5,
  });
  const counts = {
    undefinedReferences: 0,
    overfullHbox: 0,
    underfullHbox: 0,
    packageWarnings: 3,
    fontWarnings: 0,
  };
  await controller.onDirtyCompile(counts);
  advance(10);
  await controller.onDirtyCompile(counts, { force: true });
  assert.equal(sent.length, 2);
});

test('nothing is sent while disabled', async () => {
  const { controller, sent } = makeController({ 'latexShock.enabled': false });
  await controller.onCompileFailure();
  assert.equal(sent.length, 0);
});
