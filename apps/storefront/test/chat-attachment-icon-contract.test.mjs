import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('storefront attachment plus is centered geometrically instead of by font metrics', () => {
  const css = source('../src/messages-media.css');

  assert.ok(css.includes('.chat-attachment-picker::before,'));
  assert.ok(css.includes('.chat-attachment-picker::after,'));
  assert.ok(css.includes('top: 50%;'));
  assert.ok(css.includes('left: 50%;'));
  assert.ok(css.includes('transform: translate(-50%, -50%);'));
  assert.ok(css.includes('font-size: 0;'));
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