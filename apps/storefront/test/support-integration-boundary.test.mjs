import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const contractSource = await readFile(
  new URL('../src/support-contract.ts', import.meta.url),
  'utf8',
);
const gatewaySource = await readFile(
  new URL('../src/support-gateway.ts', import.meta.url),
  'utf8',
);
const supportSource = await readFile(
  new URL('../src/support-ui.tsx', import.meta.url),
  'utf8',
);
const rootSource = await readFile(
  new URL('../src/StorefrontRoot.tsx', import.meta.url),
  'utf8',
);
const integrationDoc = await readFile(
  new URL('../../../docs/customer-service-integration.md', import.meta.url),
  'utf8',
);

test('Messages UI consumes the provider-neutral same-origin SupportGateway', () => {
  assert.match(contractSource, /export interface SupportGateway/u);
  assert.match(contractSource, /listConversations/u);
  assert.match(contractSource, /getConversation/u);
  assert.match(contractSource, /startConversation/u);
  assert.match(contractSource, /sendMessage/u);
  assert.match(contractSource, /markConversationRead/u);
  assert.match(gatewaySource, /\/api\/messages\/v1\/conversations/u);
  assert.match(rootSource, /siteSupportGateway/u);
  assert.match(rootSource, /message-compose/u);
  assert.match(supportSource, /nextMessageCursor/u);
});

test('Storefront keeps provider credentials and provider URLs outside the browser boundary', () => {
  const browserBoundary = `${contractSource}\n${gatewaySource}\n${supportSource}\n${rootSource}`;
  assert.doesNotMatch(browserBoundary, /apiToken|Authorization:\s*Bearer|X-Project-Id|X-Site-Visitor-Id/u);
  assert.doesNotMatch(browserBoundary, /https?:\/\/[^'"`\s]+/u);
  assert.doesNotMatch(browserBoundary, /localStorage|sessionStorage|indexedDB/u);
});

test('integration contract fixes Site-owned chat UI and external conversation ownership', () => {
  assert.match(integrationDoc, /Site Storefront.*用户聊天 UI/u);
  assert.match(integrationDoc, /独立 Git 仓库/u);
  assert.match(integrationDoc, /独立 Cloudflare Worker/u);
  assert.match(integrationDoc, /同源 `?\/api\/messages\/v1/u);
  assert.match(integrationDoc, /唯一数据源/u);
  assert.match(integrationDoc, /Cache-Control: no-store, private/u);
  assert.match(integrationDoc, /MESSAGES_SESSION_SECRET/u);
});

test('Site D1 migrations do not create local conversation or message storage', async () => {
  const migrationsDirectory = new URL('../../../migrations/', import.meta.url);
  const migrationFiles = (await readdir(migrationsDirectory)).filter((name) =>
    name.endsWith('.sql'),
  );
  const migrations = (
    await Promise.all(
      migrationFiles.map((name) => readFile(new URL(name, migrationsDirectory), 'utf8')),
    )
  ).join('\n');

  assert.doesNotMatch(migrations, /CREATE TABLE\s+(?:support_)?conversations\b/iu);
  assert.doesNotMatch(migrations, /CREATE TABLE\s+(?:support_)?messages\b/iu);
});
