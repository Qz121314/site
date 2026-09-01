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

test('phone and link attachments share one clickable contact-card contract', () => {
  const ui = source('../src/support-ui.tsx');
  const css = source('../src/messages-media.css');

  assert.ok(ui.includes("from 'lucide-react'"));
  assert.ok(ui.includes("attachment.kind === 'phone' ? Phone : Link"));
  assert.ok(ui.includes("attachment.kind === 'phone'"));
  assert.ok(ui.includes('`tel:${attachment.value}`'));
  assert.ok(ui.includes('className="chat-contact-card"'));
  assert.ok(css.includes('.chat-contact-card'));
  assert.doesNotMatch(ui, /sms:/u);
});
