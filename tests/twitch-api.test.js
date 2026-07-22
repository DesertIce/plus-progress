import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TWITCH_CLIENT_ID,
  TWITCH_GQL_ENDPOINT,
  TwitchApiError,
  fetchPlusProgram,
  resolveChannel,
} from '../site/twitch-api.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('resolveChannel sends the explicit ChannelId operation and returns the user', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return jsonResponse({ data: { user: { id: '1234', login: 'somechannel', displayName: 'SomeChannel' } } });
  };

  const channel = await resolveChannel('somechannel', { fetchImpl });

  assert.deepEqual(channel, { id: '1234', login: 'somechannel', displayName: 'SomeChannel' });
  assert.equal(request.url, TWITCH_GQL_ENDPOINT);
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['Client-ID'], TWITCH_CLIENT_ID);
  assert.equal(request.options.headers['Content-Type'], 'application/json');
  const body = JSON.parse(request.options.body);
  assert.equal(body.operationName, 'ChannelId');
  assert.deepEqual(body.variables, { login: 'somechannel' });
  assert.match(body.query, /query ChannelId\(\$login: String!\)/);
});

test('resolveChannel returns null when Twitch does not find the login', async () => {
  const channel = await resolveChannel('missingchannel', {
    fetchImpl: async () => jsonResponse({ data: { user: null } }),
  });

  assert.equal(channel, null);
});

test('fetchPlusProgram sends the public query and returns a validated status', async () => {
  let body;
  const status = {
    partnerPlusProgram: {
      l1Threshold: 100,
      l2Threshold: 300,
      level: 'LEVEL_1',
      canShowWidget: true,
      subPoints: [{ year: 2026, month: 7, count: 52, updatedAt: null }],
      widgetSetting: 'LEVEL_1',
    },
  };
  const result = await fetchPlusProgram('1234', {
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return jsonResponse({ data: { plusStatus: status } });
    },
  });

  assert.deepEqual(result, status);
  assert.equal(body.operationName, 'PartnerPlusPublicQuery');
  assert.deepEqual(body.variables, { channelID: '1234' });
  assert.match(body.query, /query PartnerPlusPublicQuery\(\$channelID: ID!\)/);
});

test('GraphQL top-level errors become a safe typed error', async () => {
  await assert.rejects(
    resolveChannel('somechannel', {
      fetchImpl: async () => jsonResponse({ errors: [{ message: 'internal request id abc123' }] }),
    }),
    (error) =>
      error instanceof TwitchApiError &&
      error.code === 'graphql_error' &&
      error.message === 'Twitch is temporarily unavailable. Try again shortly.',
  );
});

test('partial GraphQL failure of partnerPlusProgram is rejected safely', async () => {
  await assert.rejects(
    fetchPlusProgram('1234', {
      fetchImpl: async () => jsonResponse({
        data: { plusStatus: { partnerPlusProgram: null } },
        errors: [{ message: 'resolver failed', path: ['plusStatus', 'partnerPlusProgram'] }],
      }),
    }),
    (error) =>
      error instanceof TwitchApiError &&
      error.code === 'graphql_error' &&
      error.message.includes('enable and publicly share'),
  );
});

test('fetchPlusProgram preserves a valid plusStatus null response', async () => {
  const result = await fetchPlusProgram('1234', {
    fetchImpl: async () => jsonResponse({ data: { plusStatus: null } }),
  });

  assert.equal(result, null);
});

test('fetchPlusProgram preserves an unavailable widget even when progress fields are null', async () => {
  const status = {
    partnerPlusProgram: {
      l1Threshold: null,
      l2Threshold: null,
      level: null,
      canShowWidget: false,
      subPoints: null,
      widgetSetting: null,
    },
  };
  const result = await fetchPlusProgram('1234', {
    fetchImpl: async () => jsonResponse({ data: { plusStatus: status } }),
  });

  assert.deepEqual(result, status);
});

test('HTTP failures are normalized without exposing response details', async () => {
  await assert.rejects(
    fetchPlusProgram('1234', { fetchImpl: async () => new Response('request id secret-detail', { status: 503 }) }),
    (error) =>
      error instanceof TwitchApiError &&
      error.code === 'http_error' &&
      !error.message.includes('request id') &&
      error.transient,
  );
});

test('network failures are normalized as transient safe errors', async () => {
  await assert.rejects(
    resolveChannel('somechannel', { fetchImpl: async () => { throw new TypeError('socket details'); } }),
    (error) =>
      error instanceof TwitchApiError &&
      error.code === 'network_error' &&
      error.message === 'Could not reach Twitch. Check the connection and try again.' &&
      error.transient,
  );
});

test('invalid successful response shapes are rejected', async () => {
  await assert.rejects(
    resolveChannel('somechannel', {
      fetchImpl: async () => jsonResponse({ data: { user: { id: 42, login: 'somechannel' } } }),
    }),
    (error) => error instanceof TwitchApiError && error.code === 'invalid_response',
  );
});

test('request timeout remains active while the response body is being read', async () => {
  const fetchImpl = async (_url, options) => ({
    ok: true,
    json: () => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }),
  });

  const outcome = await Promise.race([
    resolveChannel('somechannel', { fetchImpl, timeoutMs: 5 }).then(
      () => ({ kind: 'resolved' }),
      (error) => ({ kind: 'rejected', error }),
    ),
    new Promise((resolve) => setTimeout(() => resolve({ kind: 'hung' }), 50)),
  ]);

  assert.equal(outcome.kind, 'rejected');
  assert.ok(outcome.error instanceof TwitchApiError);
  assert.equal(outcome.error.code, 'timeout');
});
