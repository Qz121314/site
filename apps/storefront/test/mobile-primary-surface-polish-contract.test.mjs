import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('mobile Section, Product, Messages, and shell chrome keep native density and theme-owned depth', async () => {
  const [section, detailFlow, conversation, theme, chrome, shell] = await Promise.all([
    readFile(new URL('../src/section-ui.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/product-detail-content-flow.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/chat-conversation.css', import.meta.url), 'utf8'),
    readFile(
      new URL(
        '../../../packages/storefront-ui/src/primary-pages-theme-contract.css',
        import.meta.url,
      ),
      'utf8',
    ),
    readFile(new URL('../src/app-chrome.css', import.meta.url), 'utf8'),
    readFile(new URL('../src/app-shell.css', import.meta.url), 'utf8'),
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
    /@media \(max-width: 767px\)[\s\S]*\.detail-mobile-gallery \{[\s\S]*border-radius: var\(--theme-detail-media-radius, var\(--theme-radius-media, 14px\)\);/u,
  );
  assert.match(
    detailFlow,
    /@media \(max-width: 767px\)[\s\S]*\.detail-mobile-gallery \{[\s\S]*box-shadow: var\(--theme-primary-detail-media-shadow\);/u,
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
  assert.match(theme, /--theme-primary-chat-timeline-background:/u);
  assert.match(
    theme,
    /\.chat-timeline \{[\s\S]*var\(--theme-primary-chat-timeline-background\);/u,
  );
  assert.doesNotMatch(conversation, /\.chat-timeline \{[^}]*background:/u);
  assert.doesNotMatch(conversation, /radial-gradient\(/u);

  assert.match(theme, /--theme-primary-search-shadow: var\(--theme-control-shadow\);/u);
  assert.match(
    theme,
    /--theme-primary-search-focus-shadow: var\(--theme-button-focus-ring\);/u,
  );
  assert.match(theme, /--theme-primary-navigation-shadow: none;/u);
  assert.match(chrome, /box-shadow: var\(--theme-primary-search-shadow\);/u);
  assert.match(chrome, /box-shadow: var\(--theme-primary-search-focus-shadow\);/u);
  assert.match(chrome, /box-shadow: var\(--theme-primary-navigation-shadow\);/u);
  assert.match(shell, /box-shadow: var\(--theme-primary-navigation-shadow, none\);/u);
  assert.doesNotMatch(
    chrome,
    /:focus-within \{[\s\S]{0,260}box-shadow:[\s\S]{0,80},[\s\S]{0,80}0 8px 24px/u,
  );
});
