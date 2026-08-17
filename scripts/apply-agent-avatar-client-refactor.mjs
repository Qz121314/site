import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, mutate) {
  const before = readFileSync(path, 'utf8');
  const after = mutate(before);
  if (after === before) throw new Error(`No changes applied to ${path}`);
  writeFileSync(path, after);
}

function replaceOnce(source, from, to, label) {
  const index = source.indexOf(from);
  if (index < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(from, index + from.length) >= 0) {
    throw new Error(`Expected one ${label}`);
  }
  return source.slice(0, index) + to + source.slice(index + from.length);
}

patch('apps/storefront/src/support-gateway.ts', (source) => {
  source = replaceOnce(
    source,
    "function remoteUrl(connection: PublicSupportConnection, path: string): string {\n  return `${connection.clientApiUrl}${path}`;\n}\n",
    "function remoteUrl(connection: PublicSupportConnection, path: string): string {\n  return `${connection.clientApiUrl}${path}`;\n}\n\nexport function resolveSupportAssetUrl(\n  connection: PublicSupportConnection,\n  value: string | null,\n): string | null {\n  if (!value) return null;\n  try {\n    return new URL(\n      value,\n      `${connection.clientApiUrl.replace(/\\/$/u, '')}/`,\n    ).toString();\n  } catch {\n    return null;\n  }\n}\n",
    'asset URL helper anchor',
  );
  source = replaceOnce(
    source,
    '    agentAvatarUrl: remote.agentAvatarUrl,\n',
    '    agentAvatarUrl: resolveSupportAssetUrl(connection, remote.agentAvatarUrl),\n',
    'summary avatar normalization',
  );
  return source;
});

patch('apps/storefront/src/support-realtime.ts', (source) => {
  source = replaceOnce(
    source,
    '  loadPublicSupportConnections,\n  wrapSupportConversationRef,\n',
    '  loadPublicSupportConnections,\n  resolveSupportAssetUrl,\n  wrapSupportConversationRef,\n',
    'realtime asset resolver import',
  );
  source = replaceOnce(
    source,
    'function parseConversation(\n  connectionId: string,\n  value: unknown,\n): SupportConversationSummary | null {\n',
    'function parseConversation(\n  connection: PublicSupportConnection,\n  value: unknown,\n): SupportConversationSummary | null {\n',
    'parseConversation signature',
  );
  source = replaceOnce(
    source,
    '    id: wrapSupportConversationRef(connectionId, item.id),\n    agentName: item.agentName,\n    agentAvatarUrl: item.agentAvatarUrl,\n',
    '    id: wrapSupportConversationRef(connection.id, item.id),\n    agentName: item.agentName,\n    agentAvatarUrl: resolveSupportAssetUrl(connection, item.agentAvatarUrl),\n',
    'realtime avatar normalization',
  );
  source = replaceOnce(
    source,
    '  const conversation = parseConversation(state.connection.id, raw.conversation);\n',
    '  const conversation = parseConversation(state.connection, raw.conversation);\n',
    'realtime parse call',
  );
  return source;
});

patch('apps/storefront/src/support-ui.tsx', (source) =>
  replaceOnce(
    source,
    '  const avatarUrl = conversation.productCoverUrl || conversation.agentAvatarUrl;\n',
    '  const avatarUrl = conversation.agentAvatarUrl || conversation.productCoverUrl;\n',
    'conversation avatar priority',
  ),
);
