import test from 'node:test';
import assert from 'node:assert/strict';

import { createDomRenderer, createOverlayController, formatUpdatedAt, formatUtcMonth } from '../site/app.js';
import { cacheKeyForChannel, createProgressResult, serializeCache } from '../site/progress.js';
import { TwitchApiError } from '../site/twitch-api.js';

const NOW = new Date('2026-07-22T12:34:56Z');

function program(overrides = {}) {
  return {
    l1Threshold: 100,
    l2Threshold: 300,
    level: 'LEVEL_1',
    canShowWidget: true,
    subPoints: [{ year: 2026, month: 7, count: 52, updatedAt: null }],
    widgetSetting: 'LEVEL_1',
    ...overrides,
  };
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
    values,
  };
}

function controller(overrides = {}) {
  const states = [];
  const scheduled = [];
  const api = overrides.api ?? {
    resolveChannel: async () => ({ id: '1234', login: 'somechannel', displayName: 'SomeChannel' }),
    fetchPlusProgram: async () => ({ partnerPlusProgram: program() }),
  };
  const instance = createOverlayController({
    channel: '  @SomeChannel ',
    api,
    storage: memoryStorage(),
    now: () => new Date(NOW),
    render: (state) => states.push(state),
    schedule: (callback, delay) => {
      scheduled.push({ callback, delay });
      return scheduled.length;
    },
    cancelSchedule: () => {},
    ...overrides,
  });
  return { instance, states, scheduled, api };
}

test('start loads immediately, caches success, and resolves the channel only once', async () => {
  let resolveCalls = 0;
  let plusCalls = 0;
  const storage = memoryStorage();
  const { instance, states, scheduled } = controller({
    storage,
    api: {
      resolveChannel: async () => {
        resolveCalls += 1;
        return { id: '1234', login: 'somechannel', displayName: 'SomeChannel' };
      },
      fetchPlusProgram: async () => {
        plusCalls += 1;
        return { partnerPlusProgram: program() };
      },
    },
  });

  await instance.start();
  await instance.refresh();

  assert.equal(states[0].kind, 'loading');
  assert.equal(states.at(-1).kind, 'success');
  assert.equal(states.at(-1).data.points, 52);
  assert.equal(resolveCalls, 1);
  assert.equal(plusCalls, 2);
  assert.equal(scheduled[0].delay, 600_000);
  assert.ok(storage.getItem(cacheKeyForChannel('somechannel')));
});

test('missing channel renders a deliberate state without calling Twitch', async () => {
  let called = false;
  const { instance, states } = controller({
    channel: '  @  ',
    api: {
      resolveChannel: async () => { called = true; },
      fetchPlusProgram: async () => { called = true; },
    },
  });

  await instance.start();

  assert.equal(called, false);
  assert.deepEqual(states, [{ kind: 'missing_channel' }]);
});

test('unknown channel renders channel-not-found', async () => {
  const { instance, states } = controller({
    api: { resolveChannel: async () => null, fetchPlusProgram: async () => assert.fail('must not fetch') },
  });

  await instance.start();

  assert.deepEqual(states.at(-1), { kind: 'channel_not_found', channel: 'somechannel' });
});

test('null status, unavailable widget, and unknown setting have distinct states', async (t) => {
  const cases = [
    { status: null, expected: 'plus_status_null' },
    { status: { partnerPlusProgram: null }, expected: 'widget_unavailable' },
    { status: { partnerPlusProgram: program({ canShowWidget: false }) }, expected: 'widget_unavailable' },
    { status: { partnerPlusProgram: program({ widgetSetting: 'UNKNOWN' }) }, expected: 'unknown_widget_setting' },
  ];

  for (const { status, expected } of cases) {
    await t.test(expected, async () => {
      const { instance, states } = controller({
        api: {
          resolveChannel: async () => ({ id: '1234' }),
          fetchPlusProgram: async () => status,
        },
      });
      await instance.start();
      assert.equal(states.at(-1).kind, expected);
    });
  }
});

test('transient failure displays valid cached data as stale and keeps it intact', async () => {
  const cached = createProgressResult({ channel: 'somechannel', program: program(), now: NOW });
  const serialized = serializeCache('somechannel', cached);
  const storage = memoryStorage({ [cacheKeyForChannel('somechannel')]: serialized });
  const { instance, states } = controller({
    storage,
    api: {
      resolveChannel: async () => ({ id: '1234' }),
      fetchPlusProgram: async () => {
        throw new TwitchApiError('network_error', 'Could not reach Twitch. Check the connection and try again.');
      },
    },
  });

  await instance.start();

  assert.equal(states.at(-1).kind, 'stale');
  assert.deepEqual(states.at(-1).data, cached);
  assert.equal(storage.getItem(cacheKeyForChannel('somechannel')), serialized);
});

test('failure without valid cache renders a safe manual-refresh error', async () => {
  const { instance, states } = controller({
    api: {
      resolveChannel: async () => { throw new Error('raw socket and request details'); },
      fetchPlusProgram: async () => assert.fail('must not fetch'),
    },
  });

  await instance.start();

  assert.equal(states.at(-1).kind, 'error');
  assert.equal(states.at(-1).canRefresh, true);
  assert.doesNotMatch(states.at(-1).message, /raw socket|request details/);
});

test('completed goals retain points above the target', async () => {
  const { instance, states } = controller({
    api: {
      resolveChannel: async () => ({ id: '1234' }),
      fetchPlusProgram: async () => ({ partnerPlusProgram: program({
        subPoints: [{ year: 2026, month: 7, count: 135, updatedAt: null }],
      }) }),
    },
  });

  await instance.start();

  assert.equal(states.at(-1).kind, 'completed');
  assert.equal(states.at(-1).data.points, 135);
  assert.equal(states.at(-1).data.visualPercentage, 100);
});

test('refresh returns the in-flight promise instead of overlapping requests', async () => {
  let release;
  let plusCalls = 0;
  const pending = new Promise((resolve) => { release = resolve; });
  const { instance } = controller({
    api: {
      resolveChannel: async () => ({ id: '1234' }),
      fetchPlusProgram: async () => {
        plusCalls += 1;
        return pending;
      },
    },
  });

  const first = instance.refresh();
  const second = instance.refresh();
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(plusCalls, 1);

  release({ partnerPlusProgram: program() });
  await first;
});

test('display labels omit the goal timezone and show relative update seconds', () => {
  assert.equal(formatUtcMonth(2026, 7), 'July 2026');
  assert.equal(
    formatUpdatedAt('2026-07-22T12:34:56Z', new Date('2026-07-22T12:35:04Z')),
    'Updated 8 seconds ago',
  );
});

test('DOM renderer exposes accessible progress and switches to error states safely', () => {
  const ids = [
    'overlay', 'progress-view', 'message-view', 'month-label', 'points-current', 'points-target',
    'goal-level', 'progress-rail', 'state-badge', 'status-text', 'updated-text', 'message-title',
    'message-body', 'refresh-button',
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, {
    id,
    hidden: false,
    textContent: '',
    dataset: {},
    attributes: {},
    style: { values: {}, setProperty(name, value) { this.values[name] = value; } },
    setAttribute(name, value) { this.attributes[name] = String(value); },
  }]));
  let displayedNow = new Date(NOW);
  const relativeUpdates = [];
  const cancelledRelativeUpdates = [];
  const render = createDomRenderer(
    { getElementById: (id) => elements[id] },
    {
      now: () => displayedNow,
      scheduleRelativeUpdate: (callback, delay) => {
        relativeUpdates.push({ callback, delay });
        return relativeUpdates.length;
      },
      cancelRelativeUpdate: (timer) => cancelledRelativeUpdates.push(timer),
    },
  );

  render({
    kind: 'success',
    data: createProgressResult({ channel: 'somechannel', program: program(), now: NOW }),
  });

  assert.equal(elements.overlay.dataset.state, 'success');
  assert.equal(elements['progress-view'].hidden, false);
  assert.equal(elements['message-view'].hidden, true);
  assert.equal(elements['points-current'].textContent, '52');
  assert.equal(elements['progress-rail'].attributes['aria-valuenow'], '52');
  assert.equal(elements['progress-rail'].attributes['aria-valuetext'], '52 of 100 Plus Points');
  assert.equal(elements['status-text'].textContent, '48 points to L1');
  assert.equal(elements['month-label'].textContent, 'July 2026');
  assert.equal(elements['updated-text'].textContent, 'Updated 0 seconds ago');
  assert.equal(relativeUpdates[0].delay, 1_000);
  assert.equal(elements['refresh-button'].hidden, true);

  displayedNow = new Date('2026-07-22T12:35:04Z');
  relativeUpdates[0].callback();
  assert.equal(elements['updated-text'].textContent, 'Updated 8 seconds ago');

  const staleData = createProgressResult({ channel: 'somechannel', program: program(), now: NOW });
  render({ kind: 'stale', data: staleData, canRefresh: true });
  assert.equal(elements['status-text'].textContent, 'Cached · 48 points to L1');
  assert.equal(elements['refresh-button'].hidden, false);

  render({
    kind: 'stale',
    data: createProgressResult({
      channel: 'somechannel',
      program: program({ subPoints: [{ year: 2026, month: 7, count: 135, updatedAt: null }] }),
      now: NOW,
    }),
    canRefresh: true,
  });
  assert.equal(elements['status-text'].textContent, 'Cached · target reached');

  render({
    kind: 'success',
    data: createProgressResult({
      channel: 'somechannel',
      program: program({ subPoints: [{ year: 2026, month: 7, count: 99, updatedAt: null }] }),
      now: NOW,
    }),
  });
  assert.equal(elements['status-text'].textContent, '1 point to L1');

  render({ kind: 'error', message: '<unsafe details>', canRefresh: true });
  assert.equal(elements['progress-view'].hidden, true);
  assert.equal(elements['message-view'].hidden, false);
  assert.equal(elements['message-body'].textContent, '<unsafe details>');
  assert.equal(elements['refresh-button'].hidden, false);
  assert.deepEqual(cancelledRelativeUpdates, [1]);
});
