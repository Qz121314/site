import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test(
  'Storefront fallback, FAQ, Messages, and touch surfaces stay app-native',
  async () => {
    const [
      rootSource,
      faqSource,
      faqStyles,
      messagesStyles,
      globalStyles,
      accessibilityStyles,
      edgeNavigationSource,
    ] = await Promise.all([
      readFile(new URL('../src/StorefrontRoot.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/FaqPage.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/faq-ui.css', import.meta.url), 'utf8'),
      readFile(new URL('../src/messages-ui.css', import.meta.url), 'utf8'),
      readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
      readFile(new URL('../src/ui-accessibility.css', import.meta.url), 'utf8'),
      readFile(new URL('../src/MobileEdgeNavigation.tsx', import.meta.url), 'utf8'),
    ]);

    assert.doesNotMatch(rootSource, /site-footer/u);
    assert.match(faqSource, /faq-empty-state/u);
    assert.match(faqStyles, /\.faq-empty-state/u);
    assert.match(faqStyles, /\.faq-article-body/u);
    assert.match(messagesStyles, /\.conversation-list/u);
    assert.match(messagesStyles, /\.chat-message-bubble/u);
    assert.match(messagesStyles, /\.chat-composer/u);
    assert.match(globalStyles, /\.state-mark svg/u);

    assert.match(accessibilityStyles, /overflow-x: clip/u);
    assert.match(accessibilityStyles, /touch-action: manipulation/u);
    assert.match(edgeNavigationSource, /\.home-shortcuts/u);
    assert.match(edgeNavigationSource, /\.section-catalog-filters/u);
    assert.match(
      edgeNavigationSource,
      /tracking && event\.touches\.length !== 1[\s\S]{0,100}clearGesture\(\)/u,
    );
    assert.match(
      edgeNavigationSource,
      /if \(!tracking\) return;[\s\S]{0,100}event\.touches\.length !== 1[\s\S]{0,100}clearGesture\(\)/u,
    );
  },
);
