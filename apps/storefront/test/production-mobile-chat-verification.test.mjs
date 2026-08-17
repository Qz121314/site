import assert from 'node:assert/strict';
import test from 'node:test';

const BASE_URL = 'https://service-catalog-site.fcqz121314.workers.dev';
const VERIFY_TIMEOUT_MS = 180_000;
const RETRY_INTERVAL_MS = 5_000;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function productionHasFix() {
  const nonce = Date.now();
  const requestOptions = {
    cache: 'no-store',
    headers: { 'cache-control': 'no-cache' },
  };
  const healthResponse = await fetch(
    `${BASE_URL}/api/health?verify=${nonce}`,
    requestOptions,
  );
  if (!healthResponse.ok) return false;

  const health = await healthResponse.json();
  if (health?.ok !== true || health?.environment !== 'production') return false;

  const htmlResponse = await fetch(`${BASE_URL}/?verify=${nonce}`, requestOptions);
  if (!htmlResponse.ok) return false;

  const html = await htmlResponse.text();
  const cssPaths = [...new Set(html.match(/\/assets\/[^"'\s>]+\.css/g) ?? [])];
  if (cssPaths.length === 0) return false;

  const responses = await Promise.all(
    cssPaths.map((path) =>
      fetch(`${BASE_URL}${path}?verify=${nonce}`, requestOptions),
    ),
  );
  if (responses.some((response) => !response.ok)) return false;

  const cssParts = await Promise.all(
    responses.map((response) => response.text()),
  );
  const normalizedCss = cssParts.join('\n').replace(/\s+/g, '');

  return (
    normalizedCss.includes(
      'padding-bottom:calc(18px+env(safe-area-inset-bottom))',
    ) &&
    normalizedCss.includes(
      'border:2pxsolidcolor-mix(insrgb,var(--brand)54%,var(--line))',
    ) &&
    normalizedCss.includes('.chat-send-button:disabled{opacity:.68')
  );
}

test(
  'production storefront contains the deployed mobile chat composer fix',
  { timeout: VERIFY_TIMEOUT_MS + 30_000 },
  async () => {
    const deadline = Date.now() + VERIFY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        if (await productionHasFix()) return;
      } catch {
        // Production can still be propagating.
      }
      await sleep(RETRY_INTERVAL_MS);
    }

    assert.fail('Production CSS did not expose the mobile chat composer fix.');
  },
);
