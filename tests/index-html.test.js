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
