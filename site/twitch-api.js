export const TWITCH_GQL_ENDPOINT = 'https://gql.twitch.tv/gql';
export const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

const CHANNEL_ID_QUERY = `
  query ChannelId($login: String!) {
    user(login: $login) {
      id
      login
      displayName
    }
  }
`;

const PARTNER_PLUS_QUERY = `
  query PartnerPlusPublicQuery($channelID: ID!) {
    plusStatus(channelID: $channelID) {
      partnerPlusProgram {
        l1Threshold
        l2Threshold
        level
        canShowWidget
        subPoints {
          year
          month
          count
          updatedAt
        }
        widgetSetting
      }
    }
  }
`;

const GENERIC_API_MESSAGE = 'Twitch is temporarily unavailable. Try again shortly.';
const PLUS_API_MESSAGE =
  'Twitch could not load this goal. The broadcaster may need to enable and publicly share their Plus Program goal.';

export class TwitchApiError extends Error {
  constructor(code, message, { transient = true } = {}) {
    super(message);
    this.name = 'TwitchApiError';
    this.code = code;
    this.transient = transient;
  }
}

async function requestGraphQL({
  operationName,
  query,
  variables,
  fetchImpl = globalThis.fetch,
  timeoutMs = 10_000,
  publicMessage = GENERIC_API_MESSAGE,
}) {
  if (typeof fetchImpl !== 'function') {
    throw new TwitchApiError('network_error', 'Could not reach Twitch. Check the connection and try again.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(TWITCH_GQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ operationName, query, variables }),
      signal: controller.signal,
    });

    if (!response?.ok) {
      throw new TwitchApiError('http_error', publicMessage);
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') {
        throw new TwitchApiError('timeout', 'Twitch took too long to respond. Try again.');
      }
      throw new TwitchApiError('invalid_response', publicMessage);
    }

    if (!payload || typeof payload !== 'object') {
      throw new TwitchApiError('invalid_response', publicMessage);
    }
    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
      throw new TwitchApiError('graphql_error', publicMessage);
    }
    if (!payload.data || typeof payload.data !== 'object') {
      throw new TwitchApiError('invalid_response', publicMessage);
    }

    return payload.data;
  } catch (error) {
    if (error instanceof TwitchApiError) throw error;
    if (controller.signal.aborted || error?.name === 'AbortError') {
      throw new TwitchApiError('timeout', 'Twitch took too long to respond. Try again.');
    }
    throw new TwitchApiError('network_error', 'Could not reach Twitch. Check the connection and try again.');
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function resolveChannel(login, options = {}) {
  const data = await requestGraphQL({
    operationName: 'ChannelId',
    query: CHANNEL_ID_QUERY,
    variables: { login },
    ...options,
  });

  if (data.user === null) return null;
  if (
    !data.user ||
    typeof data.user !== 'object' ||
    typeof data.user.id !== 'string' ||
    typeof data.user.login !== 'string' ||
    typeof data.user.displayName !== 'string'
  ) {
    throw new TwitchApiError('invalid_response', GENERIC_API_MESSAGE);
  }

  return {
    id: data.user.id,
    login: data.user.login,
    displayName: data.user.displayName,
  };
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateProgram(program) {
  if (program === null) return;
  if (!program || typeof program !== 'object' || typeof program.canShowWidget !== 'boolean') {
    throw new TwitchApiError('invalid_response', PLUS_API_MESSAGE);
  }
  if (!program.canShowWidget) return;
  if (
    !isFiniteNumber(program.l1Threshold) ||
    !isFiniteNumber(program.l2Threshold) ||
    (program.level !== null && typeof program.level !== 'string') ||
    !Array.isArray(program.subPoints) ||
    (program.widgetSetting !== null && typeof program.widgetSetting !== 'string')
  ) {
    throw new TwitchApiError('invalid_response', PLUS_API_MESSAGE);
  }

  for (const entry of program.subPoints) {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !Number.isInteger(entry.year) ||
      !Number.isInteger(entry.month) ||
      !isFiniteNumber(entry.count) ||
      (entry.updatedAt !== null && typeof entry.updatedAt !== 'string')
    ) {
      throw new TwitchApiError('invalid_response', PLUS_API_MESSAGE);
    }
  }
}

export async function fetchPlusProgram(channelID, options = {}) {
  const data = await requestGraphQL({
    operationName: 'PartnerPlusPublicQuery',
    query: PARTNER_PLUS_QUERY,
    variables: { channelID },
    publicMessage: PLUS_API_MESSAGE,
    ...options,
  });

  if (data.plusStatus === null) return null;
  if (!data.plusStatus || typeof data.plusStatus !== 'object') {
    throw new TwitchApiError('invalid_response', PLUS_API_MESSAGE);
  }

  validateProgram(data.plusStatus.partnerPlusProgram);
  return data.plusStatus;
}
