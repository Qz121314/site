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
const realtimeSource = await readFile(
  new URL('../src/support-realtime.ts', import.meta.url),
  'utf8',
);
const identitySource = await readFile(
  new URL('../src/support-identity.ts', import.meta.url),
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
const messagesPageSource = await readFile(
  new URL('../src/MessagesPage.tsx', import.meta.url),
  'utf8',
);
const integrationDoc = await readFile(
  new URL('../../../docs/customer-service-integration.md', import.meta.url),
  'utf8',
);

test('Messages UI uses direct customer-service REST and realtime gateways', () => {
  assert.match(contractSource, /export interface SupportGateway/u);
  assert.match(contractSource, /listConversations/u);
  assert.match(contractSource, /getConversation/u);
  assert.match(contractSource, /startConversation/u);
  assert.match(contractSource, /sendMessage/u);
  assert.match(contractSource, /markConversationRead/u);
  assert.match(gatewaySource, /\/api\/public\/storefront\/support\/connections/u);
  assert.match(gatewaySource, /connection\.clientApiUrl/u);
  assert.match(gatewaySource, /['"]\/conversations['"]/u);
  assert.match(realtimeSource, /new WebSocket/u);
  assert.match(realtimeSource, /buildSupportWebSocketUrl/u);
  assert.match(rootSource, /lazy\(\(\) =>[\s\S]*?import\('\.\/MessagesPage'\)/u);
  assert.match(messagesPageSource, /subscribeSupportRealtime/u);
  assert.match(`${supportSource}\n${messagesPageSource}`, /message-compose/u);
  assert.match(supportSource, /nextMessageCursor/u);
});

test('Storefront receives public connection metadata but never management credentials', () => {
  const browserBoundary = `${contractSource}\n${gatewaySource}\n${realtimeSource}\n${identitySource}\n${supportSource}\n${rootSource}\n${messagesPageSource}`;
  assert.match(browserBoundary, /clientApiUrl/u);
  assert.match(browserBoundary, /realtimeUrl/u);
  assert.match(browserBoundary, /protocolVersion/u);
  assert.doesNotMatch(
    browserBoundary,
    /apiToken|managementToken|Authorization:\s*Bearer/u,
  );
  assert.doesNotMatch(gatewaySource, /\/api\/messages\/v1/u);
});

test('visitor identity is a local 24-hour six-character English alphanumeric ID', () => {
  assert.match(identitySource, /24 \* 60 \* 60 \* 1000/u);
  assert.match(identitySource, /ABCDEFGHIJKLMNOPQRSTUVWXYZ/u);
  assert.match(identitySource, /0123456789/u);
  assert.match(identitySource, /localStorage/u);
  assert.doesNotMatch(identitySource, /Guest|游客/u);
});

test('integration contract fixes direct Storefront to customer-service ownership', () => {
  assert.match(integrationDoc, /Storefront 直接连接客服系统/u);
  assert.match(integrationDoc, /Site Worker 不代理聊天流量/u);
  assert.match(integrationDoc, /24 小时/u);
  assert.match(integrationDoc, /3 个 A-Z 字母 \+ 3 个数字/u);
  assert.match(integrationDoc, /WebSocket/u);
  assert.match(integrationDoc, /managementToken.*绝不返回 Storefront/u);
  assert.doesNotMatch(integrationDoc, /MESSAGES_SESSION_SECRET/u);
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
