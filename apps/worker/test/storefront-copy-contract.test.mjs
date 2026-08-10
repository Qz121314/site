import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const settingsSource = await readFile(new URL('../src/settings/site-settings.ts', import.meta.url), 'utf8');
const copySource = await readFile(new URL('../src/settings/storefront-copy.ts', import.meta.url), 'utf8');
const routeSource = await readFile(new URL('../src/routes/public-storefront-copy.ts', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
const migrationSource = await readFile(new URL('../../../migrations/0017_storefront_copy.sql', import.meta.url), 'utf8');
const backLabelMigrationSource = await readFile(
  new URL('../../../migrations/0021_section_back_label.sql', import.meta.url),
  'utf8',
);
const searchPlaceholderMigrationSource = await readFile(
  new URL('../../../migrations/0022_human_search_placeholder.sql', import.meta.url),
  'utf8',
);

test('site settings persist storefront copy as one bounded JSON field', () => {
  assert.match(migrationSource, /ADD COLUMN storefront_copy_json TEXT NOT NULL DEFAULT '\{\}'/u);
  assert.match(settingsSource, /storefrontCopy:\s*StorefrontCopy/u);
  assert.match(settingsSource, /storefront_copy_json = \?/u);
  assert.match(settingsSource, /serializeStorefrontCopy\(input\.storefrontCopy\)/u);
});

test('backend supplies normalized English defaults and validates admin updates', () => {
  assert.match(copySource, /DEFAULT_STOREFRONT_COPY/u);
  assert.match(copySource, /home:\s*'Home'/u);
  assert.match(copySource, /browse:\s*'Browse'/u);
  assert.match(copySource, /messages:\s*'Messages'/u);
  assert.match(copySource, /faq:\s*'FAQ'/u);
  assert.match(copySource, /section:\s*\{[\s\S]*backLabel:\s*'Back'/u);
  assert.equal(copySource.match(/searchPlaceholder:\s*'Search'/gu)?.length, 2);
  assert.doesNotMatch(copySource, /Search sections, products, or tags|Name, type or tag/u);
  assert.match(copySource, /validateStorefrontCopyInput/u);
  assert.match(copySource, /240/u);
});

test('legacy structural search prompts migrate without replacing custom copy', () => {
  assert.match(searchPlaceholderMigrationSource, /\$\.browse\.searchPlaceholder/u);
  assert.match(searchPlaceholderMigrationSource, /Search sections, products, or tags/u);
  assert.match(searchPlaceholderMigrationSource, /\$\.section\.searchPlaceholder/u);
  assert.match(searchPlaceholderMigrationSource, /Name, type or tag/u);
  assert.equal(searchPlaceholderMigrationSource.match(/'Search'/gu)?.length, 2);
});

test('legacy Section Browse return copy is migrated to Back without resetting other copy', () => {
  assert.match(backLabelMigrationSource, /json_set/u);
  assert.match(backLabelMigrationSource, /\$\.section\.backLabel/u);
  assert.match(backLabelMigrationSource, /= 'Browse'/u);
  assert.match(backLabelMigrationSource, /'Back'/u);
});

test('public storefront copy route exposes only normalized copy with short cache', () => {
  assert.match(routeSource, /getSiteSettings/u);
  assert.match(routeSource, /max-age=30/u);
  assert.match(routeSource, /context\.json\(\{ copy: settings\.storefrontCopy \}\)/u);
  assert.match(indexSource, /\/api\/public\/storefront-copy/u);
});
