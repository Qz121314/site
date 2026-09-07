import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('analytics keeps page-view emission separate from deferred tag loading', async () => {
  const source = await readFile(
    new URL('../src/HomepageAnalytics.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /gtag\('event', 'page_view'/u);
  assert.match(source, /scheduleGoogleTagScript\(measurementId\)/u);
  assert.match(source, /requestIdleCallback/u);
  assert.match(source, /window\.setTimeout/u);
  assert.match(source, /script\.async = true/u);
  assert.match(source, /script\.fetchPriority = 'low'/u);
  assert.doesNotMatch(source, /window\.addEventListener\('load'/u);
});
