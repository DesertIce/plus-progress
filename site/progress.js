export const CACHE_SCHEMA_VERSION = 1;

export class ProgressDataError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProgressDataError';
    this.code = code;
  }
}

export function normalizeChannel(value) {
  if (typeof value !== 'string') return '';

  let channel = value.trim();
  if (channel.startsWith('@')) channel = channel.slice(1).trim();
  return channel.toLowerCase();
}

function requireFiniteNumber(value, field, { positive = false, nonNegative = false } = {}) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    (positive && value <= 0) ||
    (nonNegative && value < 0)
  ) {
    throw new ProgressDataError('invalid_plus_data', `Twitch returned an invalid ${field}.`);
  }
  return value;
}

export function selectCurrentMonthPoints(subPoints, now = new Date()) {
  if (!Array.isArray(subPoints) || Number.isNaN(now.getTime())) {
    throw new ProgressDataError('invalid_plus_data', 'Twitch returned incomplete Plus Program progress.');
  }

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const current = subPoints.find((entry) => entry?.year === year && entry?.month === month);
  if (!current) return 0;

  return requireFiniteNumber(current.count, 'Plus Points count', { nonNegative: true });
}

export function selectTarget(program) {
  let threshold;
  let goalLevel;

  if (program?.widgetSetting === 'LEVEL_1') {
    threshold = program.l1Threshold;
    goalLevel = 'L1';
  } else if (program?.widgetSetting === 'LEVEL_2') {
    threshold = program.l2Threshold;
    goalLevel = 'L2';
  } else {
    throw new ProgressDataError(
      'unsupported_widget_setting',
      'This channel uses a Plus Program goal setting the overlay does not support.',
    );
  }

  return {
    target: requireFiniteNumber(threshold, `${goalLevel} target`, { positive: true }),
    goalLevel,
  };
}

export function calculateProgress(points, target) {
  requireFiniteNumber(points, 'Plus Points count');
  requireFiniteNumber(target, 'Plus Program target', { positive: true });

  const percentage = (points / target) * 100;
  return {
    percentage,
    visualPercentage: Math.min(100, Math.max(0, percentage)),
  };
}

export function createProgressResult({ channel, program, now = new Date() }) {
  if (!program || typeof program !== 'object' || Number.isNaN(now.getTime())) {
    throw new ProgressDataError('invalid_plus_data', 'Twitch returned incomplete Plus Program progress.');
  }

  const points = selectCurrentMonthPoints(program.subPoints, now);
  const { target, goalLevel } = selectTarget(program);
  const { percentage, visualPercentage } = calculateProgress(points, target);

  return {
    channel,
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    points,
    target,
    percentage,
    visualPercentage,
    goalLevel,
    qualificationLevel: typeof program.level === 'string' ? program.level : null,
    fetchedAt: now.toISOString(),
  };
}

export function cacheKeyForChannel(channel) {
  return `twitch-plus-overlay:v${CACHE_SCHEMA_VERSION}:${channel}`;
}

function isValidProgressResult(data, channel) {
  if (!data || typeof data !== 'object' || data.channel !== channel) return false;
  if (!Number.isInteger(data.year) || !Number.isInteger(data.month) || data.month < 1 || data.month > 12) return false;
  if (typeof data.points !== 'number' || !Number.isFinite(data.points) || data.points < 0) return false;
  if (typeof data.target !== 'number' || !Number.isFinite(data.target) || data.target <= 0) return false;
  if (typeof data.percentage !== 'number' || !Number.isFinite(data.percentage)) return false;
  if (
    typeof data.visualPercentage !== 'number' ||
    !Number.isFinite(data.visualPercentage) ||
    data.visualPercentage < 0 ||
    data.visualPercentage > 100
  ) return false;
  if (data.goalLevel !== 'L1' && data.goalLevel !== 'L2') return false;
  if (data.qualificationLevel !== null && typeof data.qualificationLevel !== 'string') return false;
  if (typeof data.fetchedAt !== 'string' || Number.isNaN(Date.parse(data.fetchedAt))) return false;

  const expectedPercentage = (data.points / data.target) * 100;
  const expectedVisualPercentage = Math.min(100, Math.max(0, expectedPercentage));
  if (Math.abs(data.percentage - expectedPercentage) > 1e-9) return false;
  if (Math.abs(data.visualPercentage - expectedVisualPercentage) > 1e-9) return false;

  return true;
}

export function serializeCache(channel, data) {
  if (!isValidProgressResult(data, channel)) {
    throw new ProgressDataError('invalid_cache_data', 'Progress could not be saved.');
  }

  return JSON.stringify({
    version: CACHE_SCHEMA_VERSION,
    channel,
    data,
  });
}

export function parseCache(serialized, expectedChannel) {
  if (typeof serialized !== 'string' || !serialized) return null;

  try {
    const parsed = JSON.parse(serialized);
    if (
      parsed?.version !== CACHE_SCHEMA_VERSION ||
      parsed.channel !== expectedChannel ||
      !isValidProgressResult(parsed.data, expectedChannel)
    ) return null;

    return parsed.data;
  } catch {
    return null;
  }
}
