import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const storefrontMain = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
const adminMain = await readFile(new URL('../../admin/src/main.tsx', import.meta.url), 'utf8');
const contract = await readFile(
  new URL('../../../packages/storefront-ui/src/primary-pages-theme-contract.css', import.meta.url),
  'utf8',
);
const sharedPackage = JSON.parse(
  await readFile(new URL('../../../packages/storefront-ui/package.json', import.meta.url), 'utf8'),
);

test('Storefront and Admin load the shared primary-pages Theme Center contract', () => {
  assert.match(storefrontMain, /@site\/storefront-ui\/primary-pages-theme-contract\.css/u);
  assert.match(adminMain, /@site\/storefront-ui\/primary-pages-theme-contract\.css/u);
  assert.equal(
    sharedPackage.exports['./primary-pages-theme-contract.css'],
    './src/primary-pages-theme-contract.css',
  );
});

test('primary app header removes passive language chrome and stays theme-driven', () => {
  assert.match(contract, /\.site-language\s*\{\s*display:\s*none;/u);
  assert.match(contract, /--theme-primary-header-border/u);
  assert.match(contract, /--theme-primary-header-shadow/u);
  assert.match(contract, /\.brand-logo\s*\{[\s\S]*?--theme-primary-logo-radius/u);
});

test('FAQ is an app accordion with a themed open state', () => {
  assert.match(contract, /\.faq-list details\s*\{[\s\S]*?--theme-primary-faq-background/u);
  assert.match(contract, /\.faq-list details\[open\]/u);
  assert.match(contract, /summary::after/u);
  assert.match(contract, /summary::-webkit-details-marker/u);
  assert.match(contract, /min-height:\s*var\(--theme-control-height\)/u);
});

test('Messages and chat surfaces are controlled by Theme Center recipes', () => {
  assert.match(contract, /--theme-primary-message-background/u);
  assert.match(contract, /--theme-primary-message-avatar-background/u);
  assert.match(contract, /--theme-primary-chat-customer-bubble/u);
  assert.match(contract, /\.conversation-row:active/u);
  assert.match(contract, /\.chat-message-row\.is-customer \.chat-message-bubble/u);
  assert.match(contract, /\.chat-composer/u);
});

test('all official themes keep distinct primary-page recipes', () => {
  for (const key of ['marketplace', 'noir', 'live', 'saas', 'travel', 'tech']) {
    assert.match(contract, new RegExp(`data-theme='${key}'`, 'u'));
  }
});

test('mobile message list uses edge-to-edge app list treatment without changing routes', () => {
  assert.match(contract, /@media \(max-width: 767px\)[\s\S]*?html \.conversation-list/u);
  assert.match(contract, /border-right:\s*0/u);
  assert.match(contract, /border-left:\s*0/u);
});
