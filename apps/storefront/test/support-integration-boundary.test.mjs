import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const contractSource = await readFile(
  new URL('../src/support-contract.ts', import.meta.url),
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

test('Messages UI consumes a provider-neutral SupportGateway contract', () => {
  assert.match(contractSource, /export interface SupportGateway/u);
  assert.match(contractSource, /listConversations/u);
  assert.match(contractSource, /getConversation/u);
  assert.match(contractSource, /startConversation/u);
  assert.match(contractSource, /sendMessage/u);
  assert.match(supportSource, /from '\.\/support-contract'/u);
  assert.match(rootSource, /from '\.\/support-contract'/u);
});

test('Storefront keeps provider credentials and provider URLs outside the browser boundary', () => {
  const browserBoundary = `${contractSource}\n${supportSource}\n${rootSource}`;
  assert.doesNotMatch(browserBoundary, /apiToken|Authorization:\s*Bearer|X-Project-Id/u);
  assert.doesNotMatch(browserBoundary, /https?:\/\/[^'"`\s]+/u);
  assert.doesNotMatch(browserBoundary, /localStorage|sessionStorage|indexedDB/u);
});

test('integration contract keeps messages same-origin and the customer-service system independent', () => {
  assert.match(integrationDoc, /独立 Git 仓库/u);
  assert.match(integrationDoc, /独立 Cloudflare Worker/u);
  assert.match(integrationDoc, /同源 \/api\/messages\/v1\/\*/u);
  assert.match(integrationDoc, /唯一数据源/u);
  assert.match(integrationDoc, /Cache-Control: no-store, private/u);
  assert.match(integrationDoc, /不应暴露伪实现或未鉴权写接口/u);
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
