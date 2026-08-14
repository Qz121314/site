import fs from 'node:fs';

const path = 'apps/storefront/src/support-gateway.ts';
let source = fs.readFileSync(path, 'utf8');

source = source.replace(
  '  SendSupportMessageInput,\n',
  '  SendSupportImageInput,\n  SendSupportMessageInput,\n',
);
source = source.replace(
  "import { getSupportVisitorIdentity } from './support-identity';\n",
  "import { getSupportVisitorIdentity } from './support-identity';\nimport { loadConversationMedia, sendConversationImage } from './support-media-gateway';\n",
);
source = source.replace(
  '  return item as SupportMessage;\n',
  '  return { ...(item as Omit<SupportMessage, \'attachments\'>), attachments: [] };\n',
);

source = source.replace(
  'async function connectionForConversationRef(\n',
  `function attachConversationMedia(\n  conversation: SupportConversationDetail,\n  media: Map<string, SupportMessage['attachments']>,\n): SupportConversationDetail {\n  return {\n    ...conversation,\n    messages: conversation.messages.map((message) => ({\n      ...message,\n      attachments: media.get(message.id) ?? [],\n    })),\n  };\n}\n\nasync function connectionForConversationRef(\n`,
);

const oldGet = `    try {\n      return conversationEnvelope(\n        connection,\n        await remoteRequestJson(\n          clientQueryUrl(\n            connection,\n            \`/conversations/\${encodeURIComponent(remoteConversationId)}\`,\n            { before, limit: '30' },\n          ),\n          undefined,\n          signal,\n        ),\n      );\n    } catch (error) {`;
const newGet = `    try {\n      const [value, media] = await Promise.all([\n        remoteRequestJson(\n          clientQueryUrl(\n            connection,\n            \`/conversations/\${encodeURIComponent(remoteConversationId)}\`,\n            { before, limit: '30' },\n          ),\n          undefined,\n          signal,\n        ),\n        loadConversationMedia(connection, remoteConversationId, signal),\n      ]);\n      return attachConversationMedia(conversationEnvelope(connection, value), media);\n    } catch (error) {`;
source = source.replace(oldGet, newGet);

source = source.replace(
  '  async markConversationRead(conversationRef, lastMessageId = null, signal) {\n',
  `  async sendImage(\n    conversationRef: string,\n    input: SendSupportImageInput,\n    onProgress,\n    signal,\n  ) {\n    const { connection, remoteConversationId } = await connectionForConversationRef(\n      conversationRef,\n      signal,\n    );\n    await sendConversationImage(\n      connection,\n      remoteConversationId,\n      input,\n      onProgress,\n      signal,\n    );\n  },\n\n  async markConversationRead(conversationRef, lastMessageId = null, signal) {\n`,
);

fs.writeFileSync(path, source);
