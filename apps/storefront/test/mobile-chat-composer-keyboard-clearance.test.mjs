import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test(
  'mobile visitor composer separates focused controls from the keyboard and keeps controls prominent',
  () => {
    const css = source('../src/mobile-fixed-surfaces.css');

    assert.ok(css.includes('.chat-composer:focus-within'));
    assert.ok(
      css.includes('padding-bottom: calc(18px + env(safe-area-inset-bottom));'),
    );
    assert.ok(
      css.includes(
        'border: 2px solid color-mix(in srgb, var(--brand) 54%, var(--line));',
      ),
    );
    assert.ok(css.includes('.chat-attachment-picker,'));
    assert.ok(css.includes('color: var(--brand-strong);'));
    assert.ok(
      css.includes(
        'background: color-mix(in srgb, var(--brand) 12%, var(--surface));',
      ),
    );
    assert.ok(css.includes('.chat-send-button:disabled'));
    assert.ok(css.includes('opacity: 0.68;'));
  },
);
