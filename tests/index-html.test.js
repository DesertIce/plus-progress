import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');

test('page includes the privacy-first Simple Analytics snippet', () => {
  assert.match(html, /<script async src="https:\/\/scripts\.simpleanalyticscdn\.com\/latest\.js"><\/script>/);
  assert.match(
    html,
    /<noscript><img src="https:\/\/queue\.simpleanalyticscdn\.com\/noscript\.gif" alt="" referrerpolicy="no-referrer-when-downgrade"\/><\/noscript>/,
  );
});

test('widget markup keeps only the responsive progress composition', () => {
  for (const retiredClass of [
    'plus-mark',
    'overlay-title',
    'state-badge',
    'score-unit',
    'goal-level',
  ]) {
    assert.doesNotMatch(html, new RegExp(`class="[^"]*\\b${retiredClass}\\b`));
  }

  assert.match(
    html,
    /<div class="score-row">[\s\S]*?<span id="status-text" class="status-text"><\/span>\s*<\/div>\s*<div class="rail-wrap">/,
  );
  assert.match(html, /<p class="score">/);
  assert.doesNotMatch(html, /<p class="score"[^>]*aria-hidden/);
});
