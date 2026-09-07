import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ADMIN_DOMAINS,
  ADMIN_VIEW_STORAGE_KEY,
  SETTINGS_ADMIN_VIEWS,
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

test('primary domains consolidate content into visible asset domain', () => {
  assert.deepEqual(
    ADMIN_DOMAINS.map(({ id, label }) => [id, label]),
    [
      ['dashboard', '仪表盘'],
      ['catalog', '商品'],
      ['experience', '体验'],
      ['operations', '运营'],
      ['media', '素材'],
      ['integrations', '集成'],
      ['system', '系统'],
    ],
  );
  assert.equal(
    ADMIN_DOMAINS.some((domain) => domain.id === 'content'),
    false,
  );
});

test('fixed settings views resolve to intended domains', () => {
  const expected = new Map([
    ['dashboard', 'dashboard'],
    ['home', 'experience'],
    ['navigation', 'experience'],
    ['messages', 'experience'],
    ['theme', 'experience'],
    ['pwa', 'experience'],
    ['system-general', 'system'],
    ['system-infrastructure', 'system'],
    ['system-advanced', 'system'],
    ['assets', 'media'],
    ['customer-service', 'integrations'],
    ['faq', 'media'],
    ['sections', 'catalog'],
  ]);

  assert.deepEqual(
    [...SETTINGS_ADMIN_VIEWS],
    [
      'home',
      'navigation',
      'messages',
      'pwa',
      'system-general',
      'system-infrastructure',
      'system-advanced',
    ],
  );
  for (const [view, domain] of expected) {
    assert.equal(getAdminDomainForView(view), domain);
  }
});

test('dynamic views preserve domain ownership', () => {
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

test('new hashes parse and legacy settings aliases normalize deterministically', () => {
  const canonical = [
    'home',
    'navigation',
    'messages',
    'theme',
    'pwa',
    'system-general',
    'system-infrastructure',
    'system-advanced',
    'assets',
    'customer-service',
    'faq',
    'sections',
    'products:alpha',
    'categories:alpha',
    'tags:alpha',
    'conversion-pool:alpha',
  ];

  for (const view of canonical) {
    assert.equal(parseAdminView(`#${encodeURIComponent(view)}`), view);
    assert.equal(parseAdminView(view), view);
  }
  assert.equal(parseAdminView('#settings'), 'system-general');
  assert.equal(parseAdminView('settings'), 'system-general');
  assert.equal(parseAdminView('#system'), 'system-general');
  assert.equal(parseAdminView('system'), 'system-general');
  assert.equal(parseAdminView('#faq'), 'faq');
  assert.equal(parseAdminView('#assets'), 'assets');
  assert.equal(parseAdminView('#products%3A'), null);
  assert.equal(parseAdminView('#unknown%3Aalpha'), null);
  assert.equal(parseAdminView('#%E0%A4%A'), null);
});

test('experience and system secondary navigation match Phase B IA exactly', () => {
  assert.deepEqual(
    getAdminSecondaryItems('experience', sections).map(({ view, label }) => [
      view,
      label,
    ]),
    [
      ['home', '首页'],
      ['navigation', '导航'],
      ['messages', 'Messages'],
      ['theme', '主题'],
      ['pwa', 'PWA'],
    ],
  );
  assert.deepEqual(
    getAdminSecondaryItems('system', sections).map(({ view, label }) => [view, label]),
    [
      ['system-general', '常规'],
      ['system-infrastructure', '基础设施'],
      ['system-advanced', '高级'],
    ],
  );
});

test('asset secondary navigation owns media and FAQ assets in fixed order', () => {
  assert.deepEqual(
    getAdminSecondaryItems('media', sections).map(({ view, label }) => [view, label]),
    [
      ['assets', '素材库'],
      ['faq', 'FAQ 管理'],
    ],
  );
  assert.equal(getAdminDefaultViewForDomain('media', sections), 'assets');
});

test('secondary items are unique and legacy placeholders are retired', () => {
  const allViews = ADMIN_DOMAINS.flatMap((domain) =>
    getAdminSecondaryItems(domain.id, sections).map((item) => item.view),
  );
  assert.equal(new Set(allViews).size, allViews.length);
  assert.equal(allViews.includes('settings'), false);
  assert.equal(allViews.includes('system'), false);

  const catalog = getAdminSecondaryItems('catalog', sections);
  assert.deepEqual(
    catalog.map((item) => item.view),
    ['sections', 'products:alpha', 'products:beta'],
  );
  assert.deepEqual(
    getAdminSecondaryItems('operations', sections).map((item) => item.view),
    ['conversion-pool:alpha', 'conversion-pool:beta'],
  );
});

test('domain defaults use the decomposed workspaces', () => {
  assert.equal(getAdminDefaultViewForDomain('experience', sections), 'home');
  assert.equal(getAdminDefaultViewForDomain('system', sections), 'system-general');
  assert.equal(getAdminDefaultViewForDomain('catalog', sections), 'sections');
  assert.equal(getAdminDefaultViewForDomain('media', sections), 'assets');
  assert.equal(
    getAdminDefaultViewForDomain('operations', sections),
    'conversion-pool:alpha',
  );
  assert.equal(getAdminDefaultViewForDomain('operations', []), null);
});

test('legacy localStorage settings value normalizes to system general', () => {
  const previousWindow = globalThis.window;
  const storage = new Map([[ADMIN_VIEW_STORAGE_KEY, 'settings']]);
  globalThis.window = {
    location: { hash: '', pathname: '/admin', search: '' },
    localStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
    },
    history: { pushState() {}, replaceState() {} },
  };

  try {
    assert.equal(readInitialAdminView(), 'system-general');
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('dynamic catalog localStorage lastView values remain compatible', () => {
  const previousWindow = globalThis.window;
  const storage = new Map([[ADMIN_VIEW_STORAGE_KEY, 'products:alpha']]);
  globalThis.window = {
    location: { hash: '', pathname: '/admin', search: '' },
    localStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
    },
    history: { pushState() {}, replaceState() {} },
  };

  try {
    for (const view of ['products:alpha', 'categories:alpha', 'tags:alpha']) {
      storage.set(ADMIN_VIEW_STORAGE_KEY, view);
      assert.equal(readInitialAdminView(), view);
    }
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('last-view and history remain compatible for FAQ and assets', () => {
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
    storage.set(ADMIN_VIEW_STORAGE_KEY, 'assets');
    assert.equal(readInitialAdminView(), 'assets');
    assert.equal(adminViewHash('products:alpha'), '#products%3Aalpha');
    writeAdminViewLocation('theme', 'push');
    assert.equal(storage.get(ADMIN_VIEW_STORAGE_KEY), 'theme');
    assert.deepEqual(historyCalls, [['push', '/admin?from=test#theme']]);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
