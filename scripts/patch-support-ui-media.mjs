import fs from 'node:fs';

const path = 'apps/storefront/src/support-ui.tsx';
let source = fs.readFileSync(path, 'utf8');

source = source.replace(
  "  onSendMessage,\n  sending = false,\n  sendError = null,\n",
  "  onSendMessage,\n  sending = false,\n  sendError = null,\n  onSendImage,\n  imageSending = false,\n  imageProgress = null,\n  imagePreviewUrl = null,\n  imageError = null,\n",
);
source = source.replace(
  "  onSendMessage?: ((body: string) => Promise<void>) | undefined;\n  sending?: boolean;\n  sendError?: string | null;\n",
  "  onSendMessage?: ((body: string) => Promise<void>) | undefined;\n  sending?: boolean;\n  sendError?: string | null;\n  onSendImage?: ((file: File) => Promise<void>) | undefined;\n  imageSending?: boolean;\n  imageProgress?: number | null;\n  imagePreviewUrl?: string | null;\n  imageError?: string | null;\n",
);
source = source.replace(
  "  const headerTitle = conversation\n",
  "  const canSendImage = Boolean(onSendImage) && Boolean(conversation) && conversation?.status !== 'closed';\n  const headerTitle = conversation\n",
);
source = source.replace(
  `                <div className="chat-message-bubble">\n                  <p>{message.body}</p>\n                  <span className="chat-message-meta">`,
  `                <div className="chat-message-bubble">\n                  {message.attachments.length > 0 ? (\n                    <div className="chat-message-media">\n                      {message.attachments.map((attachment) => (\n                        <a\n                          className="chat-message-image-link"\n                          href={attachment.url}\n                          target="_blank"\n                          rel="noreferrer"\n                          key={attachment.id}\n                        >\n                          <img\n                            className="chat-message-image"\n                            src={attachment.url}\n                            alt={attachment.originalName || 'Chat image'}\n                            loading="lazy"\n                          />\n                        </a>\n                      ))}\n                    </div>\n                  ) : null}\n                  {message.body && message.attachments.length === 0 ? <p>{message.body}</p> : null}\n                  <span className="chat-message-meta">`,
);
source = source.replace(
  `      {sendError ? (\n        <p className="inline-error chat-send-error" role="alert">\n          {sendError}\n        </p>\n      ) : null}\n      <form`,
  `      {sendError || imageError ? (\n        <p className="inline-error chat-send-error" role="alert">\n          {imageError || sendError}\n        </p>\n      ) : null}\n      {imagePreviewUrl ? (\n        <div className="chat-image-upload-preview" aria-live="polite">\n          <img src={imagePreviewUrl} alt="Uploading" />\n          <span>Uploading image {Math.round((imageProgress ?? 0) * 100)}%</span>\n        </div>\n      ) : null}\n      <form`,
);
source = source.replace(
  `        <button type="button" disabled aria-label={SYSTEM_UI.attachment}>\n          ＋\n        </button>\n        <textarea`,
  `        {canSendImage ? (\n          <label className="chat-attachment-picker" aria-label={SYSTEM_UI.attachment}>\n            ＋\n            <input\n              type="file"\n              accept="image/jpeg,image/png,image/webp,image/gif"\n              disabled={imageSending}\n              onChange={(event) => {\n                const file = event.target.files?.[0];\n                event.currentTarget.value = '';\n                if (file && onSendImage) void onSendImage(file);\n              }}\n            />\n          </label>\n        ) : (\n          <button type="button" disabled aria-label={SYSTEM_UI.attachment}>\n            ＋\n          </button>\n        )}\n        <textarea`,
);

source = source.replace(
  "  onSendMessage,\n  sending = false,\n  sendError = null,\n  onLoadEarlier,\n",
  "  onSendMessage,\n  sending = false,\n  sendError = null,\n  onSendImage,\n  imageSending = false,\n  imageProgress = null,\n  imagePreviewUrl = null,\n  imageError = null,\n  onLoadEarlier,\n",
);
source = source.replace(
  "  onSendMessage?: ((body: string) => Promise<void>) | undefined;\n  sending?: boolean;\n  sendError?: string | null;\n  onLoadEarlier?: (() => Promise<void>) | undefined;\n",
  "  onSendMessage?: ((body: string) => Promise<void>) | undefined;\n  sending?: boolean;\n  sendError?: string | null;\n  onSendImage?: ((file: File) => Promise<void>) | undefined;\n  imageSending?: boolean;\n  imageProgress?: number | null;\n  imagePreviewUrl?: string | null;\n  imageError?: string | null;\n  onLoadEarlier?: (() => Promise<void>) | undefined;\n",
);
source = source.replace(
  `            sendError={sendError}\n            onLoadEarlier={onLoadEarlier}`,
  `            sendError={sendError}\n            onSendImage={onSendImage}\n            imageSending={imageSending}\n            imageProgress={imageProgress}\n            imagePreviewUrl={imagePreviewUrl}\n            imageError={imageError}\n            onLoadEarlier={onLoadEarlier}`,
);

fs.writeFileSync(path, source);
