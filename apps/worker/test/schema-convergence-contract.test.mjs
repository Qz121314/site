import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const legacyCustomerServiceMigration = await readFile(
  new URL('../../../migrations/0006_customer_service_connections.sql', import.meta.url),
  'utf8',
);
const convergenceMigration = await readFile(
  new URL('../../../migrations/0023_current_schema_convergence.sql', import.meta.url),
  'utf8',
);
const siteSettingsSource = await readFile(
  new URL('../src/settings/site-settings.ts', import.meta.url),
  'utf8',
);
const bottomNavigationMigration = await readFile(
  new URL('../../../migrations/0018_bottom_navigation.sql', import.meta.url),
  'utf8',
);

test('legacy customer-service singleton is migrated and cleared before retirement', async () => {
  assert.match(
    legacyCustomerServiceMigration,
    /INSERT INTO customer_service_connections[\s\S]*FROM customer_service_settings/u,
  );
  assert.match(
    legacyCustomerServiceMigration,
    /UPDATE customer_service_settings[\s\S]*SET is_enabled = 0[\s\S]*endpoint_url = NULL/u,
  );
  assert.match(convergenceMigration, /DROP TABLE customer_service_settings/u);

  const settingsFiles = await readdir(new URL('../src/settings/', import.meta.url));
  assert.equal(settingsFiles.includes('customer-service-settings.ts'), false);
});

test('site settings schema contains only active configuration responsibilities', () => {
  for (const column of [
    'show_messages',
    'facebook_pixel_id',
    'affiliate_detection_enabled',
    'affiliate_platform',
    'affiliate_detection_config_json',
    'storefront_copy_json',
  ]) {
    assert.match(
      convergenceMigration,
      new RegExp(`ALTER TABLE site_settings DROP COLUMN ${column}`, 'u'),
    );
    assert.equal(siteSettingsSource.includes(column), false);
  }

  assert.match(bottomNavigationMigration, /'messages', 'Messages'/u);
});
