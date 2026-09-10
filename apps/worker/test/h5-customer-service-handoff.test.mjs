import assert from 'node:assert/strict';
import test from 'node:test';
import h5App from '../src/h5-index.ts';

const NOW = '2026-09-10T00:00:00.000Z';

function groupRow() {
  return {
    id: 'group-1',
    section_id: 'section-1',
    name: 'Support',
    mode: 'customer_service',
    button_label: 'Talk now',
    rotation_strategy: 'round_robin',
    sort_order: 0,
    is_enabled: 1,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    target_count: 0,
    active_target_count: 0,
    product_count: 1,
    customer_service_connection_id: 'connection-1',
    customer_service_connection_name: 'Primary support',
    remote_group_id: null,
    remote_group_name: null,
  };
}

function connectionRow() {
  return {
    id: 'connection-1',
    name: 'Primary support',
    provider: 'generic_v1',
    base_url: 'https://support.example.com',
    api_token: 'private-token',
    client_api_url: 'https://support.example.com/client/v1',
    realtime_url: 'wss://support.example.com/client/v1/realtime',
    verified_at: NOW,
    is_enabled: 1,
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    target_count: 1,
  };
}

function createDb() {
  return {
    prepare(sql) {
      return {
        bind() {
          return this;
        },
        async first() {
          if (sql.includes('h5_public_settings')) {
            return { public_origin: 'https://pages.example.com', updated_at: NOW };
          }
          if (sql.includes('FROM h5_page_ctas c') && sql.includes('page_name')) {
            return {
              section_id: 'section-1',
              conversion_group_id: 'group-1',
              cta_key: 'consult',
              page_slug: 'consultation',
              page_name: 'Consultation page',
              section_name: 'West',
            };
          }
          if (sql.trimStart().startsWith('SELECT\n  c.id')) return connectionRow();
          if (sql.includes('FROM conversion_groups g')) return groupRow();
          if (sql.includes('FROM h5_pages WHERE id = ?')) {
            return { published_version_id: 'version-1' };
          }
          throw new Error(`Unexpected first SQL: ${sql}`);
        },
        async all() {
          if (sql.includes('FROM h5_page_ctas c')) {
            return {
              results: [
                {
                  id: 'cta-1',
                  key: 'consult',
                  label: 'Talk now',
                  selector: '[data-site-cta="consult"]',
                  sectionId: 'section-1',
                  conversionGroupId: 'group-1',
                  mode: 'customer_service',
                },
              ],
            };
          }
          throw new Error(`Unexpected all SQL: ${sql}`);
        },
      };
    },
  };
}

function env() {
  return {
    DB: createDb(),
    ASSETS_BUCKET: {},
    ASSETS: {},
    ENVIRONMENT: 'test',
    APP_VERSION: 'test',
  };
}

test('published H5 runtime injects a customer-service chat bridge for bound CTA', async () => {
  const response = await h5App.request(
    'https://pages.example.com/pages/__runtime/page-1',
    undefined,
    env(),
  );

  assert.equal(response.status, 200);
  const source = await response.text();
  assert.match(source, /site-h5-support-visitor-v1/u);
  assert.match(source, /customer_service/u);
  assert.match(source, /site:h5-support:connected/u);
});

test('bound H5 customer-service CTA returns only public handoff data', async () => {
  const response = await h5App.request(
    'https://pages.example.com/pages/cta/page-1/cta-1',
    { headers: { Accept: 'application/json' } },
    env(),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.mode, 'customer_service');
  assert.match(body.handoffId, /^[0-9a-f-]{36}$/u);
  assert.deepEqual(body.connection, {
    id: 'connection-1',
    clientApiUrl: 'https://support.example.com/client/v1',
    realtimeUrl: 'wss://support.example.com/client/v1/realtime',
    protocolVersion: 'v1',
  });
  assert.deepEqual(body.product, {
    id: 'h5-page:page-1',
    title: 'Consultation page',
    href: '/pages/consultation/',
    coverUrl: null,
    sectionId: 'section-1',
    sectionName: 'West',
    categoryId: null,
    categoryName: null,
    isEnabled: true,
    sourceType: 'h5_page',
    pageId: 'page-1',
    pageSlug: 'consultation',
  });
  assert.deepEqual(body.source, {
    type: 'h5_page',
    pageId: 'page-1',
    pageName: 'Consultation page',
    pageSlug: 'consultation',
    ctaId: 'cta-1',
    ctaKey: 'consult',
  });
  assert.equal(JSON.stringify(body).includes('private-token'), false);
});
