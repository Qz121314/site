import assert from 'node:assert/strict';
import test from 'node:test';

const BASE_URL = 'https://service-catalog-site.fcqz121314.workers.dev';
const VERIFY_TIMEOUT_MS = 180_000;
const RETRY_INTERVAL_MS = 5_000;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchText(path) {
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`${BASE_URL}${path}${separator}verify=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'cache-control': 'no-cache' },
  });
  assert.equal(response.ok, true, `${path} returned HTTP ${response.status}`);
  return response.text();
}

async function deployedStylesContainFix() {
  const healthResponse = await fetch(`${BASE_URL}/api/health?verify=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'cache-control': 'no-cache' },
  });
  if (!healthResponse.ok) return false;
  const health = await healthResponse.json();
  if (health?.ok !== true || health?.environment !== 'production') return false;

  const html = await fetchText('/');
  const cssPaths = [...new Set(html.match(/\/assets\/[^"'\s>]+\.css/g) ?? [])];
  if (cssPaths.length === 0) return false;

  const css = (await Promise.all(cssPaths.map((path) => fetchText(path)))).join('\n');
  const focusedClearance =
    css.includes('padding-bottom:calc(18px + env(safe-area-inset-bottom))') ||
    css.includes('padding-bottom: calc(18px + env(safe-area-inset-bottom))');
  const strongInputBorder =
    css.includes('border:2px solid color-mix(in srgb,var(--brand) 54%,var(--line))') ||
    css.includes('border: 2px solid color-mix(in srgb, var(--brand) 54%, var(--line))');
  const visibleDisabledSend =
    css.includes('.chat-send-button:disabled{opacity:.68') ||
    css.includes('.chat-send-button:disabled {\n      opacity: 0.68');

  return focusedClearance && strongInputBorder && visibleDisabledSend;
}

test(
  'production storefront contains the deployed mobile chat keyboard clearance and emphasis rules',
  { timeout: VERIFY_TIMEOUT_MS + 30_000 },
  async () => {
    const deadline = Date.now() + VERIFY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        if (await deployedStylesContainFix()) return;
      } catch {
        // Deployment can still be propagating; retry until the verification deadline.
      }
      await sleep(RETRY_INTERVAL_MS);
    }

    assert.fail('Production CSS did not expose the mobile chat composer fix before the deadline.');
  },
);
