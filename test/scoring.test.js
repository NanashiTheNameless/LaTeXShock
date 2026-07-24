'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  weightedScore,
  normalize,
  planDirty,
  planFailure,
  enabledIssueCount,
  pulseCount,
} = require('../out/scoring.js');
const { defaultConfig, counts } = require('./helpers');

test('weightedScore sums enabled categories times their weights', () => {
  const cfg = defaultConfig();
  const c = counts({ undefinedReferences: 2, overfullHbox: 3 });
  // 2*15 + 3*3 = 39
  assert.equal(weightedScore(c, cfg), 39);
});

test('weightedScore ignores disabled trigger categories', () => {
  const cfg = defaultConfig({ triggers: { overfullHbox: false } });
  const c = counts({ undefinedReferences: 1, overfullHbox: 10 });
  // overfull disabled -> only 1*15
  assert.equal(weightedScore(c, cfg), 15);
});

test('normalize linear is proportional to referenceScore', () => {
  const cfg = defaultConfig({ scaling: { curve: 'linear', referenceScore: 100 } });
  assert.equal(normalize(0, cfg), 0);
  assert.equal(normalize(50, cfg), 0.5);
  assert.equal(normalize(100, cfg), 1);
  assert.equal(normalize(200, cfg), 1); // clamped
});

test('normalize logarithmic gives diminishing returns and saturates at ref', () => {
  const cfg = defaultConfig({ scaling: { curve: 'logarithmic', referenceScore: 100 } });
  const half = normalize(50, cfg);
  assert.ok(half > 0.5, `log(50) fraction ${half} should exceed the linear 0.5`);
  assert.equal(normalize(100, cfg), 1);
});

test('normalize exponential punishes piling up (below linear until ref)', () => {
  const cfg = defaultConfig({ scaling: { curve: 'exponential', referenceScore: 100 } });
  assert.equal(normalize(50, cfg), 0.25); // (0.5)^2
  assert.equal(normalize(100, cfg), 1);
});

test('normalize stepped advances one tier per crossed threshold', () => {
  const cfg = defaultConfig({ scaling: { curve: 'stepped', stepThresholds: [1, 3, 6, 10] } });
  assert.equal(normalize(0, cfg), 0);
  assert.equal(normalize(1, cfg), 0.25); // 1 of 4 crossed
  assert.equal(normalize(4, cfg), 0.5); // 1 and 3 crossed
  assert.equal(normalize(100, cfg), 1); // all crossed
});

test('planDirty returns null when there is nothing scorable', () => {
  assert.equal(planDirty(counts(), defaultConfig()), null);
});

test('planDirty scales power by default and holds duration at its minimum', () => {
  const cfg = defaultConfig({
    scaling: { curve: 'linear', target: 'power', referenceScore: 100 },
    power: { min: 10, max: 80 },
    duration: { minMs: 500, maxMs: 5000 },
  });
  // score 50 -> t=0.5 -> power = 10 + 0.5*(80-10) = 45
  const plan = planDirty(counts({ undefinedReferences: 0, packageWarnings: 10 }), cfg);
  // 10 package warnings * weight 5 = 50
  assert.equal(plan.score, 50);
  assert.equal(plan.power, 45);
  assert.equal(plan.durationMs, 500); // duration not scaled -> min
});

test('planDirty with target=duration holds power at its minimum', () => {
  const cfg = defaultConfig({
    scaling: { curve: 'linear', target: 'duration', referenceScore: 100 },
  });
  const plan = planDirty(counts({ packageWarnings: 10 }), cfg); // score 50, t=0.5
  assert.equal(plan.power, 10); // power not scaled -> min
  assert.equal(plan.durationMs, 500 + 0.5 * (5000 - 500));
});

test('planFailure uses the failure overrides, not the curve', () => {
  const cfg = defaultConfig();
  const plan = planFailure(cfg);
  assert.equal(plan.power, 100);
  assert.equal(plan.durationMs, 3000);
});

test('safety.hardMaxPower clamps computed power', () => {
  const cfg = defaultConfig({ safety: { hardMaxPower: 40 }, power: { failureOverride: 100 } });
  assert.equal(planFailure(cfg).power, 40);
});

test('duration is clamped to the OpenShock-safe range', () => {
  const cfg = defaultConfig({ duration: { failureMs: 99999 } });
  assert.equal(planFailure(cfg).durationMs, 30000);
});

test('enabledIssueCount and pulseCount respect triggers and the cap', () => {
  const cfg = defaultConfig({
    triggers: { fontWarnings: false },
    pulses: { maxCount: 3 },
  });
  const c = counts({ undefinedReferences: 2, packageWarnings: 4, fontWarnings: 9 });
  assert.equal(enabledIssueCount(c, cfg), 6); // font disabled -> 2 + 4
  assert.equal(pulseCount(c, cfg), 3); // capped at maxCount
});
