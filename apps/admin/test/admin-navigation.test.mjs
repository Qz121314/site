import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_DOMAINS,
  ADMIN_VIEW_STORAGE_KEY,
  LEGACY_FIXED_ADMIN_VIEWS,
  adminViewHash,
  getAdminDefaultViewForDomain,
  getAdminDomainForView,
  getAdminSecondaryItems,
  parseAdminView,
  parseDynamicView,
  readInitialAdminView,
  writeAdminViewLocation,
} from '../src/admin-navigation.ts';

const sections = [
  { id: 'alpha', name: 'Alpha' },
  { id: 'beta', name: 'Beta' },
];

test('every fixed Admin view resolves to exactly one intended domain', () => {
  const expected = new Map([
    ['dashboard', 'dashboard'],
    ['settings', 'experience'],
    ['theme', 'experience'],
    ['assets', 'media'],
    ['customer-service', 'integrations'],
    ['faq', 'content'],
    ['sections', 'catalog'],
    ['system', 'system'],
  ]);

  assert.deepEqual([...LEGACY_FIXED_ADMIN_VIEWS], [
    'settings',
    'theme',
    'assets',
    'customer-service',
    'faq',
    'sections',
  ]);
  for (const [view, domain] of expected) {
    assert.equal(getAdminDomainForView(view), domain);
  }
});

test('dynamic section views preserve catalog and operations ownership', () => {
  assert.deepEqual(parseDynamicView('products:alpha'), {
    kind: 'products',
    sectionId: 'alpha',
  });
  assert.equal(getAdminDomainForView('products:alpha'), 'catalog');
  assert.equal(getAdminDomainForView('categories:alpha'), 'catalog');
  assert.equal(getAdminDomainForView('tags:alpha'), 'catalog');
  assert.equal(getAdminDomainForView('conversion-pool:alpha'), 'operations');
  assert.equal(parseDynamicView('products:'), null);
  assert.equal(parseDynamicView('unknown:alpha'), null);
});

test('legacy hashes remain valid and invalid dynamic hashes are rejected', () => {
  const legacy = [
    'settings',
    'theme',
    'assets',
    'customer-service',
    'faq',
    'sections',
    'products:alpha',
    'categories:alpha',
    'tags:alpha',
    'conversion-pool:alpha',
  ];

  for (const view of legacy) {
    assert.equal(parseAdminView(`#${encodeURIComponent(view)}`), view);
    assert.equal(parseAdminView(view), view);
  }
  assert.equal(parseAdminView('#products%3A'), null);
  assert.equal(parseAdminView('#unknown%3Aalpha'), null);
  assert.equal(parseAdminView('#%E0%A4%A'), null);
});

test('secondary navigation has no duplicate production view ownership', () => {
  const allViews = ADMIN_DOMAINS.flatMap((domain) =>
    getAdminSecondaryItems(domain.id, sections).map((item) => item.view),
  );
  assert.equal(new Set(allViews).size, allViews.length);

  const catalog = getAdminSecondaryItems('catalog', sections);
  assert.deepEqual(
    catalog.map((item) => item.view),
    [
      'sections',
      'products:alpha',
      'categories:alpha',
      'tags:alpha',
      'products:beta',
      'categories:beta',
      'tags:beta',
    ],
  );
  assert.deepEqual(
    getAdminSecondaryItems('operations', sections).map((item) => item.view),
    ['conversion-pool:alpha', 'conversion-pool:beta'],
  );
});

test('domain defaults remain static and operations does not invent a section', () => {
  assert.equal(getAdminDefaultViewForDomain('experience', sections), 'settings');
  assert.equal(getAdminDefaultViewForDomain('catalog', sections), 'sections');
  assert.equal(
    getAdminDefaultViewForDomain('operations', sections),
    'conversion-pool:alpha',
  );
  assert.equal(getAdminDefaultViewForDomain('operations', []), null);
});

test('last-view storage and hash/history contract remain compatible', () => {
  const previousWindow = globalThis.window;
  const storage = new Map([[ADMIN_VIEW_STORAGE_KEY, 'faq']]);
  const historyCalls = [];
  globalThis.window = {
    location: { hash: '', pathname: '/admin', search: '?from=test' },
    localStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
    },
    history: {
      pushState(_state, _title, url) {
        historyCalls.push(['push', url]);
      },
      replaceState(_state, _title, url) {
        historyCalls.push(['replace', url]);
      },
    },
  };

  try {
    assert.equal(readInitialAdminView(), 'faq');
    assert.equal(adminViewHash('products:alpha'), '#products%3Aalpha');
    writeAdminViewLocation('theme', 'push');
    assert.equal(storage.get(ADMIN_VIEW_STORAGE_KEY), 'theme');
    assert.deepEqual(historyCalls, [['push', '/admin?from=test#theme']]);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
