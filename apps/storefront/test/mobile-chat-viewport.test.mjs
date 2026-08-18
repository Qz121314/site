import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('mobile visitor chat uses the same single CSS viewport model as the agent app', () => {
  const html = source('../index.html');
  const main = source('../src/main.tsx');
  const fixedSurfaces = source('../src/mobile-fixed-surfaces.css');

  assert.ok(html.includes('viewport-fit=cover'));
  assert.equal(html.includes('interactive-widget='), false);
  assert.equal(main.includes('mobile-chat-viewport'), false);
  assert.equal(main.includes('installMobileChatViewportRuntime'), false);

  assert.match(
    fixedSurfaces,
    /\.app-shell:has\(\.messages-workspace\.is-thread-open\) \{[\s\S]*?height: 100dvh;[\s\S]*?min-height: 0;[\s\S]*?overflow: hidden;/,
  );
  assert.match(
    fixedSurfaces,
    /> main \{[\s\S]*?position: absolute;[\s\S]*?inset: 0;[\s\S]*?height: auto;[\s\S]*?min-height: 0;[\s\S]*?overflow: hidden;/,
  );
  assert.match(
    fixedSurfaces,
    /\.chat-page \{[\s\S]*?display: flex;[\s\S]*?height: 100%;[\s\S]*?flex-direction: column;[\s\S]*?overflow: hidden;/,
  );
  assert.match(
    fixedSurfaces,
    /\.chat-timeline \{[\s\S]*?min-height: 0;[\s\S]*?flex: 1 1 auto;/,
  );
  assert.match(fixedSurfaces, /\.chat-composer \{[\s\S]*?flex: 0 0 auto;/);
});
