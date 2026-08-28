import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('GA4 queues page views immediately and loads the async tag during browser idle', async () => {
  const source = await readFile(
    new URL('../src/HomepageAnalytics.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /const GOOGLE_TAG_IDLE_TIMEOUT_MS = 1000/u);
  assert.match(source, /dataLayer\(\)\.push\(arguments\)/u);
  assert.match(source, /script\.async = true/u);
  assert.match(source, /script\.fetchPriority = 'low'/u);
  assert.match(source, /requestIdleCallback\([\s\S]{0,180}GOOGLE_TAG_IDLE_TIMEOUT_MS/u);
  assert.match(source, /window\.setTimeout\([\s\S]{0,140}GOOGLE_TAG_IDLE_TIMEOUT_MS/u);
  assert.match(source, /gtag\('config', measurementId, \{ send_page_view: false \}\)/u);
  assert.match(source, /gtag\('event', 'page_view'/u);
  assert.match(source, /scheduleGoogleTagScript\(measurementId\)/u);
  assert.doesNotMatch(source, /GOOGLE_TAG_LOAD_DELAY_MS/u);
  assert.doesNotMatch(source, /window\.addEventListener\('load'/u);

  const loaderStart = source.indexOf('function loadGoogleTagScript');
  const loaderEnd = source.indexOf('function scheduleGoogleTagScript');
  const loader = source.slice(loaderStart, loaderEnd);
  assert.match(loader, /document\.head\.append\(script\)/u);

  const schedulerStart = source.indexOf('function scheduleGoogleTagScript');
  const schedulerEnd = source.indexOf('function ensureGoogleTag');
  const scheduler = source.slice(schedulerStart, schedulerEnd);
  assert.match(scheduler, /requestIdleCallback/u);
  assert.match(scheduler, /window\.setTimeout/u);

  const trackerStart = source.indexOf('function trackPageView');
  const trackerEnd = source.indexOf('export function HomepageAnalytics');
  const tracker = source.slice(trackerStart, trackerEnd);
  assert.doesNotMatch(tracker, /document\.head\.append\(script\)/u);
});
