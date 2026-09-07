import { expect, test, type Page } from '@playwright/test';

const useAdminFixture = process.env.E2E_ADMIN_LOCAL_SERVER === '1';

test.skip(
  !useAdminFixture,
  'Admin Shell acceptance uses the deterministic local Admin fixture.',
);

const sections = ['Alpha', 'Beta'].map((name, index) => ({
  id: name.toLowerCase(),
  slug: name.toLowerCase(),
  name,
  iconType: 'icon',
  iconValue: null,
  iconAssetId: null,
  sortOrder: index,
  isEnabled: true,
  createdAt: '2026-09-07T00:00:00.000Z',
  updatedAt: '2026-09-07T00:00:00.000Z',
  deletedAt: null,
  productCount: 0,
  conversionMethodCount: 0,
}));

const publishStatus = {
  status: {
    pointerVersion: null,
    publishedAt: null,
    isCurrent: true,
    dirtyCount: 0,
    bootstrapRequired: false,
    legacyPointerDetected: false,
    mediaBaseUrl: null,
    modules: [],
  },
};

const siteSettings = {
  settings: {
    siteName: 'Admin shell test',
    locationLabel: '',
    mediaBaseUrl: null,
    logoAssetId: null,
    ga4MeasurementId: null,
    homeSectionLimit: 5,
    showHot: true,
    showLatest: true,
    showMore: true,
    showFaq: true,
    installPrompt: {
      enabled: false,
      delaySeconds: 30,
      title: '',
      description: '',
      iosDescription: '',
      installLabel: '',
      dismissLabel: '',
    },
    updatedAt: '2026-09-07T00:00:00.000Z',
  },
};

async function installAdminFixture(page: Page) {
  await page.route('**/api/admin/**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/admin/auth/session', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: true, expiresAt: null }),
    });
  });
  await page.route('**/api/admin/sections/?scope=active', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ sections }),
    });
  });
  await page.route('**/api/admin/publish/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(publishStatus),
    });
  });
  await page.route('**/api/admin/settings/', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(siteSettings),
    });
  });
}

async function expectShellGeometry(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  const geometry = await page.evaluate(() => {
    const primary = document.querySelector<HTMLElement>('.admin-desktop-primary');
    const secondary = document.querySelector<HTMLElement>('.admin-desktop-secondary');
    const topBar = document.querySelector<HTMLElement>('.admin-top-bar');
    const workspace = document.querySelector<HTMLElement>('.admin-workspace-content');
    if (!primary || !secondary || !topBar || !workspace) return null;
    const primaryRect = primary.getBoundingClientRect();
    const secondaryRect = secondary.getBoundingClientRect();
    const topBarRect = topBar.getBoundingClientRect();
    return {
      primaryVisible: primaryRect.width > 0,
      secondaryVisible: secondaryRect.width > 0,
      topBarAtViewportTop: Math.abs(topBarRect.top) < 1,
      workspaceScrollsIndependently: getComputedStyle(workspace).overflowY === 'auto',
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    };
  });
  expect(geometry).toEqual({
    primaryVisible: true,
    secondaryVisible: true,
    topBarAtViewportTop: true,
    workspaceScrollsIndependently: true,
    noHorizontalOverflow: true,
  });
}

test('Admin shell exposes final IA, route compatibility, and desktop geometry', async ({
  page,
}) => {
  await installAdminFixture(page);
  await page.goto('/admin/#settings');

  await expect(page.getByRole('navigation', { name: '管理业务域' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '基本设置' })).toBeVisible();

  const primary = page.getByRole('navigation', { name: '管理业务域' });
  await expect(primary.getByRole('button')).toHaveText([
    '仪表盘',
    '商品',
    '站点',
    '内容',
    '运营',
    '客户互动',
    '系统',
  ]);

  await primary.getByRole('button', { name: '商品' }).click();
  await expect(page).toHaveURL(/#sections$/u);
  const catalog = page.getByRole('navigation', { name: '商品二级导航' });
  await expect(catalog.getByRole('button')).toHaveText([
    '分区管理',
    '商品',
    '分类',
    '标签',
    '商品',
    '分类',
    '标签',
  ]);

  await catalog.getByRole('button', { name: '分类' }).first().click();
  await expect(page).toHaveURL(/#categories%3Aalpha$/u);
  await expect(catalog.getByRole('button', { name: '分类' }).first()).toHaveAttribute(
    'aria-current',
    'page',
  );

  for (const [domain, secondaryItems] of [
    ['站点', ['首页', '导航', '主题']],
    ['内容', ['文章中心', '素材库']],
    ['客户互动', ['Messages', '客服接入']],
    ['系统', ['基本设置', '应用安装', '基础设施', '高级设置']],
  ] as const) {
    await primary.getByRole('button', { name: domain }).click();
    const navigation = page.getByRole('navigation', { name: `${domain}二级导航` });
    await expect(navigation.getByRole('button')).toHaveText(secondaryItems);
  }

  for (const width of [1366, 1440, 1920]) {
    await expectShellGeometry(page, width);
  }
});
