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
  '--plus-card-compact-height',
  '--plus-card-compact-min-height',
  '--plus-card-compact-padding-inline',
  '--plus-square-card-padding',
  '--plus-portrait-card-padding',
  '--plus-card-border',
  '--plus-card-radius',
  '--plus-card-background',
  '--plus-card-texture',
  '--plus-card-shadow',
  '--plus-progress-height',
  '--plus-portrait-progress-width',
  '--plus-progress-track-border',
  '--plus-progress-track-background',
  '--plus-progress-fill-background',
  '--plus-progress-fill-completed-background',
  '--plus-progress-fill-shadow',
  '--plus-progress-ticks',
  '--plus-progress-transition',
  '--plus-constrained-progress-background',
  '--plus-constrained-progress-completed-background',
  '--plus-constrained-progress-shadow',
];

export const PUBLIC_CLASSES = [
  'overlay',
  'overlay-card',
  'header-row',
  'month-label',
  'progress-view',
  'score-row',
  'score',
  'score-divider',
  'score-target',
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

function cssSection(startMarker, endMarker) {
  const start = css.indexOf(startMarker);
  const end = css.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${startMarker} must exist`);
  assert.notEqual(end, -1, `${endMarker} must exist after ${startMarker}`);
  return css.slice(start, end);
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
  assert.match(css, /\.overlay\s*\{[^}]*--progress:\s*0%/s);
  assert.doesNotMatch(css, /--plus-progress-value/);
});

test('stylesheet defines automatic primary modes for all three aspect ratios', () => {
  assert.match(css, /@media \(min-aspect-ratio: 4 \/ 3\)/);
  assert.match(
    css,
    /@media \(min-aspect-ratio: 751 \/ 1000\) and \(max-aspect-ratio: 1332 \/ 1000\)/,
  );
  assert.match(css, /@media \(max-aspect-ratio: 3 \/ 4\)/);
});

test('square modes omit both the rail and spatial progress fill', () => {
  const square = cssSection('/* Square layouts */', '/* Portrait layouts */');
  assert.match(square, /\.rail-wrap\s*\{\s*display:\s*none;/);
  assert.doesNotMatch(square, /\.overlay-card::after/);
});

test('constrained modes preserve each ratio-specific progress treatment', () => {
  const horizontal = cssSection('/* Constrained horizontal */', '/* Constrained square */');
  const square = cssSection('/* Constrained square */', '/* Constrained portrait */');
  const portrait = cssSection('/* Constrained portrait */', '/* Reduced motion */');

  assert.match(
    horizontal,
    /@media \(min-aspect-ratio: 4 \/ 3\) and \(max-height: 95px\)/,
  );
  assert.match(horizontal, /\.overlay-card::after\s*\{[^}]*width:\s*var\(--progress\)/s);
  assert.match(square, /\(max-width: 139px\)/);
  assert.match(square, /\(max-height: 139px\)/);
  assert.doesNotMatch(square, /\.overlay-card::after/);
  for (const section of [horizontal, square, portrait]) {
    assert.match(section, /\.updated-text\s*\{\s*display:\s*none;/);
    assert.match(section, /\.footer-row\s*\{\s*min-height:\s*0;/);
  }
  assert.match(
    portrait,
    /@media \(max-aspect-ratio: 3 \/ 4\) and \(max-width: 110px\)/,
  );
  assert.match(portrait, /\.overlay-card::after\s*\{[^}]*height:\s*var\(--progress\)/s);
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

test('guide documents all six responsive modes and their constrained thresholds', () => {
  for (const text of ['Horizontal', 'Square', 'Portrait']) {
    assert.match(guide, new RegExp(escapeRegex(text)));
  }

  for (const [mode, threshold] of [
    ['Constrained horizontal', '95px'],
    ['Constrained square', '139px'],
    ['Constrained portrait', '110px'],
  ]) {
    assert.match(
      guide,
      new RegExp(`${escapeRegex(mode)}[\\s\\S]{0,100}${escapeRegex(threshold)}`),
    );
  }
});

test('README recommends source presets for each primary ratio', () => {
  for (const preset of ['800 × 140', '300 × 300', '300 × 600']) {
    assert.match(readme, new RegExp(escapeRegex(preset)));
  }
});

test('completed status text uses the success color', () => {
  assert.match(
    css,
    /\.overlay\[data-state="completed"\] \.status-text\s*\{[^}]*color:\s*var\(--plus-color-success\)/s,
  );
});
