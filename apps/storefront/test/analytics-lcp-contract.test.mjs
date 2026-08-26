import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('GA4 queues page views immediately but defers its external script past initial paint', async () => {
  const source = await readFile(
    new URL('../src/HomepageAnalytics.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /const GOOGLE_TAG_LOAD_DELAY_MS = 2500/u);
  assert.match(source, /script\.fetchPriority = 'low'/u);
  assert.match(source, /window\.addEventListener\('load', scheduleAfterLoad, \{ once: true \}\)/u);
  assert.match(source, /window\.setTimeout\([\s\S]{0,120}GOOGLE_TAG_LOAD_DELAY_MS/u);
  assert.match(source, /gtag\('event', 'page_view'/u);
  assert.match(source, /scheduleGoogleTagScript\(measurementId\)/u);

  const loaderStart = source.indexOf('function loadGoogleTagScript');
  const loaderEnd = source.indexOf('function scheduleGoogleTagScript');
  const loader = source.slice(loaderStart, loaderEnd);
  assert.match(loader, /document\.head\.append\(script\)/u);

  const trackerStart = source.indexOf('function trackPageView');
  const trackerEnd = source.indexOf('export function HomepageAnalytics');
  const tracker = source.slice(trackerStart, trackerEnd);
  assert.doesNotMatch(tracker, /document\.head\.append\(script\)/u);
});
