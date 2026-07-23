import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [css, html] = await Promise.all([
  readFile(new URL('../site/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../site/index.html', import.meta.url), 'utf8'),
]);

const [readme, guide, app] = await Promise.all([
  readFile(new URL('../README.md', import.meta.url), 'utf8'),
  readFile(new URL('../docs/customizing-with-obs-css.md', import.meta.url), 'utf8'),
  readFile(new URL('../site/app.js', import.meta.url), 'utf8'),
]);

export const PUBLIC_CUSTOM_PROPERTIES = [
  '--plus-font-family',
  '--plus-heading-font-family',
  '--plus-color-text',
  '--plus-color-muted',
  '--plus-color-accent',
  '--plus-color-accent-bright',
  '--plus-color-success',
  '--plus-color-warning',
  '--plus-overlay-padding',
  '--plus-card-width',
  '--plus-card-height',
  '--plus-card-min-height',
  '--plus-card-padding',
  '--plus-card-border',
  '--plus-card-radius',
  '--plus-card-background',
  '--plus-card-texture',
  '--plus-card-shadow',
  '--plus-progress-height',
  '--plus-progress-track-border',
  '--plus-progress-track-background',
  '--plus-progress-fill-background',
  '--plus-progress-fill-completed-background',
  '--plus-progress-fill-shadow',
  '--plus-progress-ticks',
  '--plus-progress-transition',
];

export const PUBLIC_CLASSES = [
  'overlay',
  'overlay-card',
  'header-row',
  'brand-lockup',
  'plus-mark',
  'overlay-title',
  'month-label',
  'state-badge',
  'progress-view',
  'score-row',
  'score',
  'score-divider',
  'score-unit',
  'goal-level',
  'rail-wrap',
  'progress-rail',
  'progress-fill',
  'rail-ticks',
  'target-bracket',
  'message-view',
  'message-title',
  'message-body',
  'footer-row',
  'status-text',
  'updated-text',
  'refresh-button',
];

const PUBLIC_STATES = [
  'loading',
  'success',
  'completed',
  'stale',
  'error',
  'missing_channel',
  'channel_not_found',
  'widget_unavailable',
  'plus_status_null',
  'unknown_widget_setting',
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('public custom properties are declared and consumed', () => {
  for (const property of PUBLIC_CUSTOM_PROPERTIES) {
    const escaped = escapeRegex(property);
    assert.match(css, new RegExp(`${escaped}\\s*:`), `${property} must be declared`);
    assert.match(css, new RegExp(`var\\(\\s*${escaped}\\s*\\)`), `${property} must be consumed`);
  }
});

test('public classes exist in the overlay markup', () => {
  const classValues = [...html.matchAll(/class="([^"]+)"/g)]
    .flatMap((match) => match[1].split(/\s+/));

  for (const className of PUBLIC_CLASSES) {
    assert.ok(classValues.includes(className), `.${className} must exist in index.html`);
  }
});

test('progress remains an internal runtime property', () => {
  assert.match(css, /--progress:\s*0%/);
  assert.doesNotMatch(css, /--plus-progress-value/);
});

test('README links to the OBS CSS customization guide', () => {
  assert.match(readme, /\[Customize the overlay with OBS CSS\]\(docs\/customizing-with-obs-css\.md\)/);
});

test('guide documents every public property, class, and render state', () => {
  for (const property of PUBLIC_CUSTOM_PROPERTIES) {
    assert.match(guide, new RegExp(escapeRegex(`\`${property}\``)));
  }
  for (const className of PUBLIC_CLASSES) {
    assert.match(guide, new RegExp(escapeRegex(`\`.${className}\``)));
  }
  for (const state of PUBLIC_STATES) {
    assert.match(app, new RegExp(`(?:\\b${escapeRegex(state)}\\s*:|['"]${escapeRegex(state)}['"])`));
    assert.match(guide, new RegExp(escapeRegex(`\`${state}\``)));
  }
});

test('guide keeps the runtime progress property internal', () => {
  assert.doesNotMatch(guide, /`--progress`/);
});
