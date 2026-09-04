import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('storefront chat actions use semantic icon buttons without native tap highlight', () => {
  const ui = source('../src/support-ui.tsx');
  const main = source('../src/main.tsx');
  const iconButton = source('../../../packages/storefront-ui/src/icon-button.tsx');
  const iconButtonCss = source('../../../packages/storefront-ui/src/icon-button.css');

  assert.ok(ui.includes("import { StorefrontIconButton } from '@site/storefront-ui/icon-button';"));
  assert.match(ui, /\bPlus\b/u);
  assert.match(ui, /\bSendHorizontal\b/u);
  assert.ok(ui.includes('attachmentInputRef.current?.click()'));
  assert.ok(ui.includes('className="chat-attachment-input"'));
  assert.doesNotMatch(ui, /[＋➤]/u);

  assert.ok(iconButton.includes('<button'));
  assert.ok(iconButton.includes("data-variant={variant}"));
  assert.ok(iconButtonCss.includes('-webkit-tap-highlight-color: transparent;'));
  assert.ok(iconButtonCss.includes('touch-action: manipulation;'));
  assert.ok(iconButtonCss.includes('.storefront-icon-button:focus-visible'));
  assert.ok(iconButtonCss.includes('border-radius: 999px;'));
  assert.ok(iconButtonCss.includes('transform: scale(0.94);'));
  assert.ok(main.includes("@site/storefront-ui/icon-button.css"));
});

test('canonical contact cards share one clickable visitor contract', () => {
  const ui = source('../src/support-ui.tsx');
  const safety = source('../src/support-attachment-safety.ts');
  const css = source('../src/messages-media.css');

  assert.ok(ui.includes('buildSupportContactCardHref'));
  assert.ok(ui.includes("attachment.kind === 'sms'"));
  assert.ok(ui.includes("attachment.kind === 'whatsapp'"));
  assert.ok(ui.includes("attachment.kind === 'telegram'"));
  assert.ok(ui.includes('/icons/contact-card-imessage.svg'));
  assert.ok(ui.includes('/icons/contact-card-whatsapp.svg'));
  assert.ok(ui.includes('/icons/contact-card-telegram.svg'));
  assert.ok(ui.includes('className="chat-contact-card"'));
  assert.ok(css.includes('.chat-contact-card'));

  assert.ok(safety.includes('`sms:${value}'));
  assert.ok(safety.includes('https://wa.me/'));
  assert.ok(safety.includes('https://t.me/'));
  assert.doesNotMatch(ui, /`tel:\$\{attachment\.value\}`/u);
});
