import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOnce(path, before, after) {
  const source = read(path);
  if (!source.includes(before)) {
    throw new Error(`Expected source not found in ${path}: ${before.slice(0, 120)}`);
  }
  write(path, source.replace(before, after));
}

replaceOnce(
  'apps/storefront/src/system-ui.ts',
  `  clear: 'Clear',\n`,
  `  chatDeletesIn: 'Chat deletes in',\n  chatExpired: 'Chat expired',\n  clear: 'Clear',\n`,
);

replaceOnce(
  'apps/storefront/src/MessagesPage.tsx',
  `          expiresAt: composeOptimisticMessage.sentAt,\n`,
  `          expiresAt: new Date(\n            Date.parse(composeOptimisticMessage.sentAt) + 86_400_000,\n          ).toISOString(),\n`,
);
replaceOnce(
  'apps/storefront/src/MessagesPage.tsx',
  `  const showNotificationToggle =\n    Boolean(activeConversationRef) && notificationState !== 'unsupported';\n`,
  `  useEffect(() => {\n    if (!activeConversationRef || !activeConversation?.expiresAt) return;\n    const expiresAt = Date.parse(activeConversation.expiresAt);\n    if (!Number.isFinite(expiresAt)) return;\n\n    const expire = () => {\n      void Promise.all([\n        queryClient.invalidateQueries({ queryKey: ['support-conversations'] }),\n        queryClient.invalidateQueries({\n          queryKey: ['support-conversation', activeConversationRef],\n        }),\n      ]).finally(() => {\n        window.history.replaceState(null, '', '/messages/');\n        window.dispatchEvent(new Event(NAVIGATION_EVENT));\n      });\n    };\n\n    const remaining = expiresAt - Date.now();\n    if (remaining <= 0) {\n      expire();\n      return;\n    }\n    const timer = window.setTimeout(expire, remaining + 100);\n    return () => window.clearTimeout(timer);\n  }, [activeConversation?.expiresAt, activeConversationRef, queryClient]);\n\n  const showNotificationToggle =\n    Boolean(activeConversationRef) && notificationState !== 'unsupported';\n`,
);

replaceOnce(
  'apps/storefront/src/support-ui.tsx',
  `function DeliveryMark({\n`,
  `function ConversationExpiryNotice({\n  expiresAt,\n  now,\n}: {\n  expiresAt: string;\n  now: number;\n}) {\n  const timestamp = Date.parse(expiresAt);\n  if (!Number.isFinite(timestamp)) return null;\n  const remaining = Math.max(0, timestamp - now);\n  const totalSeconds = Math.ceil(remaining / 1000);\n  const hours = Math.floor(totalSeconds / 3600);\n  const minutes = Math.floor((totalSeconds % 3600) / 60);\n  const seconds = totalSeconds % 60;\n  const clock = [hours, minutes, seconds]\n    .map((value) => String(value).padStart(2, '0'))\n    .join(':');\n  const urgency =\n    remaining <= 5 * 60 * 1000\n      ? ' is-urgent'\n      : remaining <= 60 * 60 * 1000\n        ? ' is-warning'\n        : '';\n\n  return (\n    <div className={\`chat-expiry-notice\${urgency}\`} aria-live="off">\n      <span aria-hidden="true">◷</span>\n      <strong>\n        {remaining > 0\n          ? \`${SYSTEM_UI.chatDeletesIn} \${clock}\`\n          : SYSTEM_UI.chatExpired}\n      </strong>\n    </div>\n  );\n}\n\nfunction DeliveryMark({\n`,
);
replaceOnce(
  'apps/storefront/src/support-ui.tsx',
  `  const [draft, setDraft] = useState('');\n  const timelineRef = useRef<HTMLDivElement | null>(null);\n`,
  `  const [draft, setDraft] = useState('');\n  const [expiryNow, setExpiryNow] = useState(() => Date.now());\n  const timelineRef = useRef<HTMLDivElement | null>(null);\n`,
);
replaceOnce(
  'apps/storefront/src/support-ui.tsx',
  `  useEffect(() => {\n    setDraft('');\n  }, [conversation?.id, pendingConversation?.productHref]);\n`,
  `  useEffect(() => {\n    setDraft('');\n  }, [conversation?.id, pendingConversation?.productHref]);\n\n  useEffect(() => {\n    if (!conversation?.expiresAt) return;\n    setExpiryNow(Date.now());\n    const timer = window.setInterval(() => setExpiryNow(Date.now()), 1000);\n    return () => window.clearInterval(timer);\n  }, [conversation?.expiresAt]);\n`,
);
replaceOnce(
  'apps/storefront/src/support-ui.tsx',
  `  }, [conversation?.id, lastMessageId]);\n`,
  `  }, [conversation?.id, imagePreviewUrl, lastMessageId]);\n`,
);
replaceOnce(
  'apps/storefront/src/support-ui.tsx',
  `  const canSend =\n    Boolean(onSendMessage) &&\n    (pendingConversation !== null || conversation?.status !== 'closed');\n  const canSendImage =\n    Boolean(onSendImage) && Boolean(conversation) && conversation?.status !== 'closed';\n`,
  `  const expiresAt = conversation?.expiresAt ? Date.parse(conversation.expiresAt) : Number.NaN;\n  const conversationExpired =\n    Number.isFinite(expiresAt) && expiresAt <= expiryNow;\n  const canSend =\n    Boolean(onSendMessage) &&\n    !conversationExpired &&\n    (pendingConversation !== null || conversation?.status !== 'closed');\n  const canSendImage =\n    Boolean(onSendImage) &&\n    Boolean(conversation) &&\n    !conversationExpired &&\n    conversation?.status !== 'closed';\n`,
);
replaceOnce(
  'apps/storefront/src/support-ui.tsx',
  `      </header>\n\n      <ProductContextCard context={productContext} LinkComponent={LinkComponent} />\n`,
  `      </header>\n\n      {conversation && conversation.id !== '__new__' ? (\n        <ConversationExpiryNotice expiresAt={conversation.expiresAt} now={expiryNow} />\n      ) : null}\n\n      <ProductContextCard context={productContext} LinkComponent={LinkComponent} />\n`,
);
replaceOnce(
  'apps/storefront/src/support-ui.tsx',
  `        })}\n      </div>\n\n      {sendError || imageError ? (\n`,
  `        })}\n        {imagePreviewUrl ? (\n          <div\n            className={\`chat-message-row is-customer is-group-start is-group-end is-local-image\${\n              imageFailed ? ' is-failed' : ''\n            }\`}\n          >\n            <div className="chat-message-bubble chat-image-upload-preview">\n              <div className="chat-image-upload-media">\n                <img src={imagePreviewUrl} alt="Uploading" />\n                <button\n                  type="button"\n                  className="chat-image-upload-status"\n                  aria-label={imageFailed ? SYSTEM_UI.retry : SYSTEM_UI.sending}\n                  title={imageFailed ? SYSTEM_UI.retry : SYSTEM_UI.sending}\n                  disabled={!imageFailed || !onRetryImage}\n                  onClick={() => void onRetryImage?.().catch(() => undefined)}\n                >\n                  {imageFailed ? (\n                    <span className="chat-upload-failed-mark" aria-hidden="true">\n                      !\n                    </span>\n                  ) : (\n                    <span\n                      className="chat-upload-ring"\n                      style={uploadRingStyle}\n                      aria-hidden="true"\n                    >\n                      <span>{uploadPercent}</span>\n                    </span>\n                  )}\n                </button>\n              </div>\n              <span className="chat-message-meta">\n                <span>{imageFailed ? SYSTEM_UI.messageFailed : SYSTEM_UI.sending}</span>\n              </span>\n            </div>\n          </div>\n        ) : null}\n      </div>\n\n      {sendError || imageError ? (\n`,
);
replaceOnce(
  'apps/storefront/src/support-ui.tsx',
  `      {imagePreviewUrl ? (\n        <div\n          className={\`chat-image-upload-preview\${imageFailed ? ' is-failed' : ''}\`}\n          aria-live="polite"\n        >\n          <img src={imagePreviewUrl} alt="Uploading" />\n          <button\n            type="button"\n            className="chat-image-upload-status"\n            aria-label={imageFailed ? SYSTEM_UI.retry : SYSTEM_UI.sending}\n            title={imageFailed ? SYSTEM_UI.retry : SYSTEM_UI.sending}\n            disabled={!imageFailed || !onRetryImage}\n            onClick={() => void onRetryImage?.().catch(() => undefined)}\n          >\n            {imageFailed ? (\n              <span className="chat-upload-failed-mark" aria-hidden="true">\n                !\n              </span>\n            ) : (\n              <span\n                className="chat-upload-ring"\n                style={uploadRingStyle}\n                aria-hidden="true"\n              >\n                <span>{uploadPercent}</span>\n              </span>\n            )}\n          </button>\n        </div>\n      ) : null}\n`,
  ``,
);

write(
  'apps/storefront/src/messages-media.css',
  read('apps/storefront/src/messages-media.css')
    .replace(
      `.chat-image-upload-preview {\n  position: relative;\n  width: min(78%, 330px);\n  justify-self: end;\n  overflow: hidden;\n  margin: 7px 10px 0 auto;\n  border: 1px solid color-mix(in srgb, var(--brand) 12%, transparent);\n  border-radius: var(--theme-radius-control, 4px);\n  background: color-mix(in srgb, var(--brand) 11%, var(--surface));\n  box-shadow: 0 2px 7px color-mix(in srgb, var(--text) 5%, transparent);\n  animation: chat-upload-preview-in 140ms ease-out both;\n}\n\n.chat-image-upload-preview img {\n  display: block;\n  width: 100%;\n  max-height: min(320px, 44vh);\n  object-fit: contain;\n  background: color-mix(in srgb, var(--text) 5%, var(--surface));\n}\n`,
      `.chat-message-row.is-local-image .chat-message-bubble {\n  width: min(78%, 330px);\n  padding: 4px;\n  overflow: hidden;\n  animation: chat-upload-preview-in 140ms ease-out both;\n}\n\n.chat-image-upload-preview {\n  position: relative;\n}\n\n.chat-image-upload-media {\n  position: relative;\n  overflow: hidden;\n  border-radius: 12px;\n}\n\n.chat-image-upload-preview img {\n  display: block;\n  width: 100%;\n  max-height: min(320px, 44vh);\n  object-fit: contain;\n  background: color-mix(in srgb, var(--text) 5%, var(--surface));\n}\n`,
    )
    .replace(
      `  .chat-image-upload-preview {\n    width: min(76%, 300px);\n  }\n`,
      `  .chat-message-row.is-local-image .chat-message-bubble {\n    width: min(76%, 300px);\n  }\n`,
    ) +
    `\n.chat-expiry-notice {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  gap: 6px;\n  width: fit-content;\n  max-width: calc(100% - 24px);\n  margin: 7px auto 0;\n  padding: 5px 9px;\n  border: 1px solid color-mix(in srgb, var(--line) 70%, transparent);\n  border-radius: 999px;\n  background: color-mix(in srgb, var(--surface) 92%, var(--brand) 8%);\n  color: var(--muted);\n  font-size: 0.69rem;\n  line-height: 1.2;\n}\n\n.chat-expiry-notice strong {\n  font-weight: 720;\n}\n\n.chat-expiry-notice.is-warning {\n  color: #8a5a00;\n}\n\n.chat-expiry-notice.is-urgent {\n  color: #b43131;\n}\n`,
);
