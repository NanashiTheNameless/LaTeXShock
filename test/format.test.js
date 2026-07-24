'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const fmt = require('../out/format.js');
const { emptyCounts } = require('../out/patterns.js');

test('event pads the tag into a fixed left column', () => {
  assert.equal(fmt.event('shock', 'sent'), '[shock]    sent');
  assert.equal(fmt.event('cooldown', 'dropped'), '[cooldown] dropped');
});

test('counts lists only the categories that fired', () => {
  const counts = { ...emptyCounts(), packageWarnings: 14 };
  assert.equal(fmt.counts(counts), '14 package warnings');

  counts.undefinedReferences = 2;
  assert.equal(fmt.counts(counts), '2 undefined refs · 14 package warnings');
});

test('counts says so when nothing fired, rather than printing zeroes', () => {
  assert.equal(fmt.counts(emptyCounts()), 'no scorable issues');
});

test('duration switches to seconds past 1000ms', () => {
  assert.equal(fmt.duration(300), '300ms');
  assert.equal(fmt.duration(999), '999ms');
  assert.equal(fmt.duration(3000), '3s');
  assert.equal(fmt.duration(4511), '4.5s');
});

test('output renders the two numbers that describe an activation', () => {
  assert.equal(fmt.output(59, 500), 'power 59 · 500ms');
  assert.equal(fmt.output(100, 3000), 'power 100 · 3s');
});
