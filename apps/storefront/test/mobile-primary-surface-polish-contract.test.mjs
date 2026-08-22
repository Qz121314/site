import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('mobile Section, Product, and Messages keep native density and safe-area ownership', async () => {
  const [section, detailFlow, conversation] = await Promise.all([
    readFile(new URL('../src/section-ui.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/product-detail-content-flow.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/chat-conversation.css', import.meta.url), 'utf8'),
  ]);

  assert.match(
    section,
    /@media \(max-width: 767px\)[\s\S]*\.section-catalog-header \{[\s\S]*min-height: calc\(52px \+ env\(safe-area-inset-top\)\);/u,
  );
  assert.match(
    section,
    /@media \(max-width: 767px\)[\s\S]*\.section-catalog-back-label \{[\s\S]*display: none;/u,
  );
  assert.match(
    section,
    /@media \(max-width: 767px\)[\s\S]*\.section-catalog-search input \{[\s\S]*font-size: 16px;/u,
  );

  assert.match(
    detailFlow,
    /@media \(max-width: 767px\)[\s\S]*\.detail-mobile-gallery \{[\s\S]*border-radius: 0;/u,
  );
  assert.match(
    detailFlow,
    /@media \(max-width: 767px\)[\s\S]*\.product-detail-summary h1 \{[\s\S]*font-size: clamp\(1\.46rem, 6\.4vw, 1\.82rem\);/u,
  );
  assert.match(
    detailFlow,
    /@media \(max-width: 767px\)[\s\S]*\.product-detail-route-action \{[\s\S]*padding-top: 12px;/u,
  );

  assert.match(
    conversation,
    /@media \(max-width: 767px\)[\s\S]*\.messages-push-toggle \{[\s\S]*top: calc\(10px \+ env\(safe-area-inset-top\)\);/u,
  );
  assert.match(
    conversation,
    /\.chat-timeline \{[\s\S]*background: color-mix\(in srgb, var\(--surface-soft\) 96%, var\(--surface\)\);/u,
  );
  assert.doesNotMatch(conversation, /radial-gradient\(/u);
});
