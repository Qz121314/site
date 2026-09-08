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
    pwaIconAssetId: null,
    heroSlides: [],
    bottomNavigation: [],
    homeLayout: {
      shortcutSectionIds: [],
      recommendationSectionIds: [],
    },
    updatedAt: '2026-09-07T00:00:00.000Z',
  },
};

const themeCenter = {
  theme: {
    key: 'marketplace',
    label: 'Marketplace',
    description: 'Default theme',
    colorScheme: 'light',
    density: 'standard',
    productMediaRatio: '1:1',
    recipe: {
      version: 2,
      fontPack: 'modern',
      buttonStyle: 'refined',
      mediaStyle: 'precise',
      motionStyle: 'restrained',
      navigationStyle: 'quiet',
    },
    installPrompt: {
      enabled: false,
      delaySeconds: 30,
      title: '',
      description: '',
      iosDescription: '',
      installLabel: '',
      dismissLabel: '',
    },
    tokens: {
      brand: '#e3486d',
      brandStrong: '#c9365c',
      text: '#1c2534',
      muted: '#667085',
      surface: '#ffffff',
      surfaceSoft: '#f5f7fa',
      line: '#dce1e8',
      pageBg: '#f7f8fa',
      heroStart: '#fde9ef',
      heroEnd: '#f3f5f9',
      heroGlow: '#e3486d',
      shadow: '0 1px 2px rgb(0 0 0 / 8%)',
    },
    overrides: {},
  },
  presets: [],
};
themeCenter.presets = [
  themeCenter.theme,
  {
    ...themeCenter.theme,
    key: 'noir',
    label: 'Noir',
    colorScheme: 'dark',
    tokens: {
      ...themeCenter.theme.tokens,
      brand: '#d89b4b',
      text: '#f5f0e8',
      surface: '#20242b',
      surfaceSoft: '#2c313a',
      line: '#4d5663',
      pageBg: '#14171c',
      heroStart: '#28231d',
      heroEnd: '#15181e',
      heroGlow: '#d89b4b',
    },
  },
];

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
  await page.route('**/api/admin/theme/', async (route) => {
    if (route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON() as {
        themeKey: string;
        overrides: { accent?: string; textColor?: string };
      };
      const preset =
        themeCenter.presets.find((item) => item.key === payload.themeKey) ??
        themeCenter.theme;
      themeCenter.theme = { ...preset, overrides: payload.overrides };
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ...themeCenter, theme: themeCenter.theme }),
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

test('narrow viewport uses the accessible drawer without horizontal overflow', async ({
  page,
}) => {
  await installAdminFixture(page);
  await page.setViewportSize({ width: 820, height: 900 });
  await page.goto('/admin/#dashboard');

  await expect(page.locator('.admin-desktop-primary')).toBeHidden();
  await expect(page.locator('.admin-desktop-secondary')).toBeHidden();
  await expect(page.getByRole('button', { name: '打开后台导航' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    )
    .toBe(true);

  await page.getByRole('button', { name: '打开后台导航' }).click();
  const drawer = page.getByRole('dialog', { name: '后台导航' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('navigation', { name: '管理业务域' })).toBeVisible();

  await drawer.getByRole('button', { name: '站点' }).click();
  await drawer
    .getByRole('navigation', { name: '站点二级导航' })
    .getByRole('button', { name: '首页' })
    .click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/#home$/u);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    )
    .toBe(true);
});

test('long settings forms stay reachable inside the workspace scroll owner', async ({
  page,
}) => {
  await installAdminFixture(page);
  await page.setViewportSize({ width: 820, height: 500 });
  await page.goto('/admin/#pwa');

  await expect(page.getByRole('heading', { name: '应用安装' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '安装提示' })).toBeVisible();

  const scrollState = await page.evaluate(() => {
    const workspace = document.querySelector<HTMLElement>('.admin-workspace-content');
    if (!workspace) return null;
    const workspaceOwnsScroll = workspace.scrollHeight > workspace.clientHeight;
    if (workspaceOwnsScroll) workspace.scrollTop = workspace.scrollHeight;
    else window.scrollTo(0, document.documentElement.scrollHeight);
    return {
      scrolls:
        workspaceOwnsScroll || document.documentElement.scrollHeight > window.innerHeight,
      reachedEnd: workspaceOwnsScroll
        ? workspace.scrollTop + workspace.clientHeight >= workspace.scrollHeight
        : window.scrollY + window.innerHeight >= document.documentElement.scrollHeight,
      pageHasNoHorizontalOverflow:
        document.documentElement.scrollWidth <= window.innerWidth,
    };
  });

  expect(scrollState).toEqual({
    scrolls: true,
    reachedEnd: true,
    pageHasNoHorizontalOverflow: true,
  });
  await expect(page.getByRole('button', { name: '保存 PWA 设置' })).toBeVisible();
});

test('Theme Studio keeps theme changes in a draft preview until explicitly saved', async ({
  page,
}) => {
  await installAdminFixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/#theme');

  await expect(page.getByRole('heading', { name: 'Theme Studio' })).toBeVisible();
  await expect(page.getByText('当前主题').locator('..')).toContainText('Marketplace');
  await page.getByRole('button', { name: /Noir/ }).click();
  await expect(page.getByText('未保存', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '保存并应用' })).toBeEnabled();
  await page.getByLabel('选择品牌强调色').fill('#123456');
  await expect(page.locator('.theme-preview-device')).toHaveAttribute(
    'data-theme',
    'noir',
  );
  await page.getByRole('button', { name: '恢复当前设置' }).click();
  await expect(page.getByText('已保存', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Noir/ }).click();
  await page.getByRole('button', { name: '保存并应用' }).click();
  await expect(page.getByText('主题已保存并应用。')).toBeVisible();

  await page.getByRole('button', { name: 'Mobile' }).click();
  await expect(page.locator('.theme-preview-shell')).toHaveAttribute(
    'data-viewport',
    'mobile',
  );
  await expect(page.locator('.theme-preview-device .bottom-nav')).toBeVisible();

  for (const width of [820, 1366, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 820) await page.getByRole('button', { name: '检查器' }).click();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      )
      .toBe(true);
  }
});

test('unsaved navigation keeps the active workspace until discard is confirmed', async ({
  page,
}) => {
  await installAdminFixture(page);
  await page.goto('/admin/#settings');
  await expect(page.getByRole('heading', { name: '基本设置' })).toBeVisible();

  await page.getByLabel('站点名称').fill('Unsaved Admin Shell');
  await expect(page.getByText('未保存更改')).toBeVisible();
  await page
    .getByRole('navigation', { name: '管理业务域' })
    .getByRole('button', { name: '站点' })
    .click();

  const discardDialog = page.getByRole('alertdialog', { name: '放弃当前修改？' });
  await expect(discardDialog).toBeVisible();
  await expect(page).toHaveURL(/#system-general$/u);
  await discardDialog.getByRole('button', { name: '继续编辑' }).click();
  await expect(discardDialog).toBeHidden();
  await expect(page).toHaveURL(/#system-general$/u);

  await page
    .getByRole('navigation', { name: '管理业务域' })
    .getByRole('button', { name: '站点' })
    .click();
  await discardDialog.getByRole('button', { name: '放弃修改并切换' }).click();
  await expect(discardDialog).toBeHidden();
  await expect(page).toHaveURL(/#home$/u);
});
