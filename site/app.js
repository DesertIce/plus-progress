import { fetchPlusProgram, resolveChannel, TwitchApiError } from './twitch-api.js';
import {
  ProgressDataError,
  cacheKeyForChannel,
  createProgressResult,
  normalizeChannel,
  parseCache,
  serializeCache,
} from './progress.js';

const DEFAULT_REFRESH_INTERVAL = 60_000;
const SAFE_ERROR_MESSAGE = 'Progress is temporarily unavailable. Try again shortly.';

const MESSAGE_STATES = {
  loading: {
    badge: 'Connecting',
    title: 'Loading progress',
    body: 'Connecting to Twitch for the latest Plus Program total.',
    status: 'Loading',
  },
  missing_channel: {
    badge: 'Setup needed',
    title: 'Channel needed',
    body: 'Add ?channel=<twitch-login> to the Browser Source URL.',
    status: 'Missing channel',
  },
  channel_not_found: {
    badge: 'Not found',
    title: 'Channel not found',
    body: 'Check the Twitch login in the Browser Source URL.',
    status: 'Check channel',
  },
  widget_unavailable: {
    badge: 'Not shared',
    title: 'Goal not publicly shared',
    body: 'The broadcaster may need to enable and publicly share their Plus Program goal.',
    status: 'Widget unavailable',
  },
  plus_status_null: {
    badge: 'Not shared',
    title: 'Plus Program goal unavailable',
    body: 'The broadcaster may need to enable and publicly share their Plus Program goal.',
    status: 'No public goal',
  },
  unknown_widget_setting: {
    badge: 'Unsupported',
    title: 'Goal setting unsupported',
    body: 'This channel uses a Plus Program goal setting this overlay does not recognize.',
    status: 'Update needed',
  },
  error: {
    badge: 'Offline',
    title: 'Progress unavailable',
    body: SAFE_ERROR_MESSAGE,
    status: 'Connection issue',
  },
};

export function formatUtcMonth(year, month) {
  const label = new Intl.DateTimeFormat('en', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return `${label} · UTC`;
}

export function formatUpdatedAt(value) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).format(date);
  return `Updated ${parts} UTC`;
}

function formatPoints(value) {
  return new Intl.NumberFormat('en').format(value);
}

export function createDomRenderer(documentRoot = document) {
  const element = (id) => documentRoot.getElementById(id);
  const elements = {
    overlay: element('overlay'),
    progressView: element('progress-view'),
    messageView: element('message-view'),
    monthLabel: element('month-label'),
    pointsCurrent: element('points-current'),
    pointsTarget: element('points-target'),
    goalLevel: element('goal-level'),
    progressRail: element('progress-rail'),
    stateBadge: element('state-badge'),
    statusText: element('status-text'),
    updatedText: element('updated-text'),
    messageTitle: element('message-title'),
    messageBody: element('message-body'),
    refreshButton: element('refresh-button'),
  };

  return function render(state) {
    const hasProgress = ['success', 'completed', 'stale'].includes(state.kind);
    elements.overlay.dataset.state = state.kind;
    elements.progressView.hidden = !hasProgress;
    elements.messageView.hidden = hasProgress;
    elements.refreshButton.hidden = !state.canRefresh;

    if (hasProgress) {
      const { data } = state;
      const displayedNow = Math.min(data.points, data.target);
      elements.monthLabel.textContent = formatUtcMonth(data.year, data.month);
      elements.pointsCurrent.textContent = formatPoints(data.points);
      elements.pointsTarget.textContent = formatPoints(data.target);
      elements.goalLevel.textContent = data.goalLevel;
      elements.progressRail.style.setProperty('--progress', `${data.visualPercentage}%`);
      elements.progressRail.setAttribute('aria-valuemin', '0');
      elements.progressRail.setAttribute('aria-valuemax', data.target);
      elements.progressRail.setAttribute('aria-valuenow', displayedNow);
      elements.progressRail.setAttribute(
        'aria-valuetext',
        `${formatPoints(data.points)} of ${formatPoints(data.target)} Plus Points`,
      );
      elements.updatedText.textContent = formatUpdatedAt(data.fetchedAt);

      if (state.kind === 'completed') {
        elements.stateBadge.textContent = 'Goal complete';
        elements.statusText.textContent = 'Target reached';
      } else if (state.kind === 'stale') {
        elements.stateBadge.textContent = 'Stale';
        elements.statusText.textContent = 'Cached value · Twitch unavailable';
      } else {
        elements.stateBadge.textContent = 'Live';
        elements.statusText.textContent = 'Public Plus goal';
      }
      return;
    }

    const copy = MESSAGE_STATES[state.kind] ?? MESSAGE_STATES.error;
    elements.stateBadge.textContent = copy.badge;
    elements.messageTitle.textContent = copy.title;
    elements.messageBody.textContent = state.message || copy.body;
    elements.statusText.textContent = copy.status;
    elements.updatedText.textContent = '';
  };
}

function readMatchingCache(storage, channel, now) {
  if (!storage) return null;
  try {
    const data = parseCache(storage.getItem(cacheKeyForChannel(channel)), channel);
    if (!data) return null;
    if (data.year !== now.getUTCFullYear() || data.month !== now.getUTCMonth() + 1) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(storage, channel, data) {
  if (!storage) return;
  try {
    storage.setItem(cacheKeyForChannel(channel), serializeCache(channel, data));
  } catch {
    // Storage can be disabled in OBS; live progress should still render.
  }
}

export function createOverlayController({
  channel,
  api = { resolveChannel, fetchPlusProgram },
  storage = null,
  now = () => new Date(),
  render = () => {},
  schedule = globalThis.setTimeout,
  cancelSchedule = globalThis.clearTimeout,
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
}) {
  const normalizedChannel = normalizeChannel(channel);
  let resolvedChannel;
  let inFlight = null;
  let timer = null;
  let stopped = false;

  async function loadProgress() {
    try {
      if (resolvedChannel === undefined) {
        resolvedChannel = await api.resolveChannel(normalizedChannel);
      }

      if (resolvedChannel === null) {
        render({ kind: 'channel_not_found', channel: normalizedChannel });
        return;
      }

      const plusStatus = await api.fetchPlusProgram(resolvedChannel.id);
      if (plusStatus === null) {
        render({ kind: 'plus_status_null', channel: normalizedChannel });
        return;
      }

      const program = plusStatus.partnerPlusProgram;
      if (program === null || program?.canShowWidget !== true) {
        render({ kind: 'widget_unavailable', channel: normalizedChannel });
        return;
      }

      const fetchedAt = now();
      const data = createProgressResult({ channel: normalizedChannel, program, now: fetchedAt });
      writeCache(storage, normalizedChannel, data);
      render({ kind: data.points >= data.target ? 'completed' : 'success', data });
    } catch (error) {
      if (error instanceof ProgressDataError && error.code === 'unsupported_widget_setting') {
        render({ kind: 'unknown_widget_setting', channel: normalizedChannel });
        return;
      }

      const currentTime = now();
      const cached = readMatchingCache(storage, normalizedChannel, currentTime);
      if (cached) {
        render({
          kind: 'stale',
          data: cached,
          message: error instanceof TwitchApiError ? error.message : SAFE_ERROR_MESSAGE,
          canRefresh: true,
        });
        return;
      }

      render({
        kind: 'error',
        message: error instanceof TwitchApiError ? error.message : SAFE_ERROR_MESSAGE,
        canRefresh: true,
      });
    }
  }

  function refresh() {
    if (!normalizedChannel) {
      render({ kind: 'missing_channel' });
      return Promise.resolve();
    }
    if (inFlight) return inFlight;

    inFlight = loadProgress().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  function scheduleNext() {
    if (stopped || timer !== null) return;
    timer = schedule(async () => {
      timer = null;
      await refresh();
      scheduleNext();
    }, refreshInterval);
  }

  async function start() {
    stopped = false;
    if (!normalizedChannel) {
      render({ kind: 'missing_channel' });
      return;
    }

    render({ kind: 'loading', channel: normalizedChannel });
    await refresh();
    scheduleNext();
  }

  function stop() {
    stopped = true;
    if (timer !== null) {
      cancelSchedule(timer);
      timer = null;
    }
  }

  return { start, refresh, stop };
}

export function bootstrapOverlay(windowRoot = window, documentRoot = document) {
  const render = createDomRenderer(documentRoot);
  let storage = null;
  try {
    storage = windowRoot.localStorage;
  } catch {
    // A restrictive Browser Source can disable storage without blocking live data.
  }

  const controller = createOverlayController({
    channel: new URLSearchParams(windowRoot.location.search).get('channel') ?? '',
    storage,
    render,
  });

  documentRoot.getElementById('refresh-button').addEventListener('click', () => {
    void controller.refresh();
  });
  windowRoot.addEventListener('pagehide', controller.stop, { once: true });
  void controller.start();
  return controller;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  bootstrapOverlay();
}
