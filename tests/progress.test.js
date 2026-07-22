import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CACHE_SCHEMA_VERSION,
  ProgressDataError,
  cacheKeyForChannel,
  calculateProgress,
  createProgressResult,
  normalizeChannel,
  parseCache,
  selectCurrentMonthPoints,
  selectTarget,
  serializeCache,
} from '../site/progress.js';

test('normalizeChannel trims whitespace, removes a leading @, and lowercases', () => {
  assert.equal(normalizeChannel('  @SomeChannel  '), 'somechannel');
  assert.equal(normalizeChannel('MiXeD_CaSe'), 'mixed_case');
});

test('normalizeChannel returns an empty string for empty or non-string input', () => {
  assert.equal(normalizeChannel('   '), '');
  assert.equal(normalizeChannel('@'), '');
  assert.equal(normalizeChannel(null), '');
});

test('selectCurrentMonthPoints finds the UTC month without relying on order', () => {
  const rows = [
    { year: 2026, month: 8, count: 81 },
    { year: 2026, month: 6, count: 33 },
    { year: 2026, month: 7, count: 52 },
  ];

  assert.equal(selectCurrentMonthPoints(rows, new Date('2026-07-22T08:00:00Z')), 52);
});

test('selectCurrentMonthPoints returns zero when the UTC month is absent', () => {
  assert.equal(
    selectCurrentMonthPoints([{ year: 2026, month: 6, count: 33 }], new Date('2026-07-01T00:00:00Z')),
    0,
  );
});

test('selectTarget chooses the configured Level 1 threshold', () => {
  assert.deepEqual(
    selectTarget({ widgetSetting: 'LEVEL_1', l1Threshold: 100, l2Threshold: 300 }),
    { target: 100, goalLevel: 'L1' },
  );
});

test('selectTarget chooses the configured Level 2 threshold', () => {
  assert.deepEqual(
    selectTarget({ widgetSetting: 'LEVEL_2', l1Threshold: 100, l2Threshold: 300 }),
    { target: 300, goalLevel: 'L2' },
  );
});

test('selectTarget rejects an unknown widget setting', () => {
  assert.throws(
    () => selectTarget({ widgetSetting: 'LEVEL_3', l1Threshold: 100, l2Threshold: 300 }),
    (error) => error instanceof ProgressDataError && error.code === 'unsupported_widget_setting',
  );
});

test('calculateProgress preserves actual percentage and clamps visual percentage', () => {
  assert.deepEqual(calculateProgress(52, 100), { percentage: 52, visualPercentage: 52 });
  assert.deepEqual(calculateProgress(100, 100), { percentage: 100, visualPercentage: 100 });
  assert.deepEqual(calculateProgress(135, 100), { percentage: 135, visualPercentage: 100 });
  assert.deepEqual(calculateProgress(-5, 100), { percentage: -5, visualPercentage: 0 });
});

test('createProgressResult normalizes a complete successful result', () => {
  const result = createProgressResult({
    channel: 'somechannel',
    program: {
      l1Threshold: 100,
      l2Threshold: 300,
      level: 'LEVEL_1',
      canShowWidget: true,
      widgetSetting: 'LEVEL_1',
      subPoints: [{ year: 2026, month: 7, count: 52, updatedAt: null }],
    },
    now: new Date('2026-07-22T12:34:56Z'),
  });

  assert.deepEqual(result, {
    channel: 'somechannel',
    year: 2026,
    month: 7,
    points: 52,
    target: 100,
    percentage: 52,
    visualPercentage: 52,
    goalLevel: 'L1',
    qualificationLevel: 'LEVEL_1',
    fetchedAt: '2026-07-22T12:34:56.000Z',
  });
});

test('cache round-trips only for the matching schema and channel', () => {
  const result = {
    channel: 'somechannel',
    year: 2026,
    month: 7,
    points: 52,
    target: 100,
    percentage: 52,
    visualPercentage: 52,
    goalLevel: 'L1',
    qualificationLevel: 'LEVEL_1',
    fetchedAt: '2026-07-22T12:34:56.000Z',
  };
  const serialized = serializeCache('somechannel', result);

  assert.deepEqual(parseCache(serialized, 'somechannel'), result);
  assert.equal(parseCache(serialized, 'anotherchannel'), null);
  assert.equal(cacheKeyForChannel('somechannel'), `twitch-plus-overlay:v${CACHE_SCHEMA_VERSION}:somechannel`);
});

test('parseCache rejects malformed, partial, or wrong-schema data', () => {
  const validData = {
    channel: 'somechannel',
    year: 2026,
    month: 7,
    points: 52,
    target: 100,
    percentage: 52,
    visualPercentage: 52,
    goalLevel: 'L1',
    qualificationLevel: null,
    fetchedAt: '2026-07-22T12:34:56.000Z',
  };

  assert.equal(parseCache('{not-json', 'somechannel'), null);
  assert.equal(parseCache(JSON.stringify({ version: 999, channel: 'somechannel', data: validData }), 'somechannel'), null);
  assert.equal(
    parseCache(JSON.stringify({ version: CACHE_SCHEMA_VERSION, channel: 'somechannel', data: { ...validData, target: 0 } }), 'somechannel'),
    null,
  );
  assert.equal(
    parseCache(JSON.stringify({ version: CACHE_SCHEMA_VERSION, channel: 'somechannel', data: { ...validData, fetchedAt: 'invalid' } }), 'somechannel'),
    null,
  );
  assert.equal(
    parseCache(JSON.stringify({ version: CACHE_SCHEMA_VERSION, channel: 'somechannel', data: { ...validData, percentage: 99 } }), 'somechannel'),
    null,
  );
  assert.equal(
    parseCache(JSON.stringify({ version: CACHE_SCHEMA_VERSION, channel: 'somechannel', data: { ...validData, visualPercentage: 99 } }), 'somechannel'),
    null,
  );
});
