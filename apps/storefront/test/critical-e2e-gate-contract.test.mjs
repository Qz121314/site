import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('critical CTA browser acceptance runs before merge without production data', () => {
  const workflow = source('../../../.github/workflows/storefront-critical-e2e.yml');
  const playwright = source('../../../playwright.config.ts');
  const acceptance = source('../../../tests/e2e/customer-service-cta-navigation.spec.ts');
  const fixture = source('../../../tests/e2e/customer-service-cta-local-fixture.ts');

  assert.ok(workflow.includes('pull_request:'));
  assert.ok(workflow.includes("E2E_LOCAL_SERVER: '1'"));
  assert.ok(workflow.includes('customer-service-cta-navigation.spec.ts'));
  assert.ok(workflow.includes('--project=mobile-chromium'));

  assert.ok(playwright.includes("process.env.E2E_LOCAL_SERVER === '1'"));
  assert.ok(playwright.includes("command: 'pnpm --filter @site/storefront dev'"));

  assert.ok(acceptance.includes('installLocalCustomerServiceCtaFixture(page)'));
  assert.ok(acceptance.includes("toBe('fetch')"));
  assert.ok(acceptance.includes('conversionRequestCount).toBe(1)'));
  assert.equal(acceptance.includes("toBe('document')"), false);
  assert.equal(acceptance.includes('toHaveURL(/\\/go\\/'), false);

  assert.ok(fixture.includes("'**/api/public/storefront/bootstrap'"));
  assert.ok(fixture.includes("'**/api/public/storefront/support/connections'"));
  assert.equal(fixture.includes('CLOUDFLARE_'), false);
});
