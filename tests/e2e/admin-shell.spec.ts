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

type AdminFixtureOptions = {
  expiresAt?: string | null;
};

async function installAdminFixture(page: Page, options: AdminFixtureOptions = {}) {
  await page.route('**/api/admin/**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: '{}' });
  });
  await page.route('**/api/admin/auth/session', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ authenticated: true, expiresAt: options.expiresAt ?? null }),
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
  await page.route('**/api/admin/assets/library/page?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ assets: [], nextCursor: null, total: 0 }),
    });
  });
  await page.route('**/api/admin/assets/folders', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ folders: [] }),
    });
  });
}

async function expectShellGeometry(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  const geometry = await page.evaluate(() => {
    const primary = document.querySelector<HTMLElement>('.admin-desktop-primary');
    const secondary = document.querySelector<HTMLElement>('.admin-desktop-secondary');
    const workspace = document.querySelector<HTMLElement>('.admin-workspace-content');
    if (!primary || !secondary || !workspace) return null;
    const primaryRect = primary.getBoundingClientRect();
    const secondaryRect = secondary.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
    return {
      primaryVisible: primaryRect.width > 0,
      secondaryVisible: secondaryRect.width > 0,
      globalTopBarRemoved: document.querySelector('.admin-top-bar') === null,
      visualPageHeaderRemoved: document.querySelector('.admin-page-header') === null,
      workspaceStartsAtTop: workspaceRect.top < 20,
      workspaceScrollsIndependently: getComputedStyle(workspace).overflowY === 'auto',
      noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    };
  });
  expect(geometry).toEqual({
    primaryVisible: true,
    secondaryVisible: true,
    globalTopBarRemoved: true,
    visualPageHeaderRemoved: true,
    workspaceStartsAtTop: true,
    workspaceScrollsIndependently: true,
    noHorizontalOverflow: true,
  });
}

async function expectVisuallyHiddenHeading(page: Page, text: string) {
  const heading = page.locator('h1.admin-visually-hidden');
  await expect(heading).toHaveText(text);
  await expect(heading).toHaveCSS('position', 'absolute');
  await expect(heading).toHaveCSS('width', '1px');
  await expect(heading).toHaveCSS('height', '1px');
  await expect(heading).toHaveCSS('overflow', 'hidden');
  await expect(heading).toHaveCSS('clip-path', 'inset(50%)');
}

test('Admin shell exposes final IA, route compatibility, and zero-chrome desktop geometry', async ({
  page,
}) => {
  await installAdminFixture(page);
  await page.goto('/admin/#settings');

  await expect(page.getByRole('navigation', { name: '管理业务域' })).toBeVisible();
  await expectVisuallyHiddenHeading(page, '系统设置');
  await expect(page.locator('.admin-top-bar')).toHaveCount(0);
  await expect(page.locator('.admin-page-header')).toHaveCount(0);

  const primary = page.getByRole('navigation', { name: '管理业务域' });
  await expect(primary.getByRole('button')).toHaveText([
    '仪表盘',
    '商品',
    '设计中心',
    '内容',
    '运营',
    '客户互动',
    '系统',
  ]);
  await expect(
    page.locator('.admin-desktop-primary').getByRole('button', { name: '退出登录' }),
  ).toBeVisible();

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
    ['设计中心', ['首页', '导航', '视觉系统']],
    ['内容', ['文章中心', '素材库']],
    ['客户互动', ['Messages', '客服接入']],
    ['系统', ['系统设置', '应用安装']],
  ] as const) {
    await primary.getByRole('button', { name: domain }).click();
    const navigation = page.getByRole('navigation', { name: `${domain}二级导航` });
    await expect(navigation.getByRole('button')).toHaveText(secondaryItems);
  }

  for (const width of [1024, 1366, 1440, 1920]) {
    await expectShellGeometry(page, width);
  }
});

test('publish status is local to publish-capable workspaces', async ({ page }) => {
  await installAdminFixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/#assets');

  await expect(page.locator('.publish-version-control')).toHaveCount(0);
  await expect(page.locator('.admin-workspace-toolbar')).toHaveCount(0);

  const contentNavigation = page.getByRole('navigation', { name: '内容二级导航' });
  await contentNavigation.getByRole('button', { name: '文章中心' }).click();
  await expect(page.locator('.publish-version-control')).toBeVisible();
  await expect(page.locator('.admin-workspace-toolbar')).toBeVisible();

  await page
    .getByRole('navigation', { name: '管理业务域' })
    .getByRole('button', { name: '系统' })
    .click();
  await page
    .getByRole('navigation', { name: '系统二级导航' })
    .getByRole('button', { name: '系统设置' })
    .click();
  await expect(page.locator('.publish-version-control')).toHaveCount(0);
});

test('session status stays absent until expiry is near', async ({ page }) => {
  await installAdminFixture(page, {
    expiresAt: new Date(Date.now() + 4 * 60 * 1000).toISOString(),
  });
  await page.goto('/admin/#dashboard');

  await expect(page.locator('.admin-session-warning')).toBeVisible();
  await expect(page.locator('.admin-top-bar')).toHaveCount(0);
  await expect(page.locator('.environment-badge')).toHaveCount(0);
});

test('navigation order saves locally, restores on reload, and can reset', async ({
  page,
}) => {
  await installAdminFixture(page);
  await page.goto('/admin/#system-navigation');
  await expect(page.locator('h1.admin-visually-hidden')).toHaveText('系统设置');

  await page.getByRole('button', { name: '下移仪表盘', exact: true }).click();
  const primary = page.getByRole('navigation', { name: '管理业务域' });
  await expect(primary.getByRole('button').first()).toHaveText('商品');
  await page.reload();
  await expect(primary.getByRole('button').first()).toHaveText('商品');
  await page.getByRole('button', { name: '恢复全部默认顺序' }).click();
  await expect(primary.getByRole('button').first()).toHaveText('仪表盘');
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
  await expect(page.locator('.admin-top-bar')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    )
    .toBe(true);

  await page.getByRole('button', { name: '打开后台导航' }).click();
  const drawer = page.getByRole('dialog', { name: '后台导航' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('navigation', { name: '管理业务域' })).toBeVisible();
  await expect(drawer.getByRole('button', { name: '退出登录' })).toBeVisible();

  await drawer.getByRole('button', { name: '设计中心' }).click();
  await drawer
    .getByRole('navigation', { name: '设计中心二级导航' })
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

test('drawer traps keyboard focus, closes with Escape, and restores the trigger', async ({
  page,
}) => {
  await installAdminFixture(page);
  await page.setViewportSize({ width: 820, height: 900 });
  await page.goto('/admin/#dashboard');

  const trigger = page.getByRole('button', { name: '打开后台导航' });
  await trigger.focus();
  await page.keyboard.press('Enter');

  const drawer = page.getByRole('dialog', { name: '后台导航' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: '关闭后台导航' })).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(drawer.locator('button').last()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(drawer.getByRole('button', { name: '关闭后台导航' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('long settings forms stay reachable inside the workspace scroll owner', async ({
  page,
}) => {
  await installAdminFixture(page);
  await page.setViewportSize({ width: 820, height: 500 });
  await page.goto('/admin/#pwa');

  await expect(page.locator('h1.admin-visually-hidden')).toHaveText('应用安装');
  await expect(page.getByText('提示标题', { exact: true })).toBeVisible();

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

test('视觉系统 keeps theme changes in a draft preview until explicitly saved', async ({
  page,
}) => {
  await installAdminFixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin/#theme');

  await expect(page.locator('.theme-center[aria-label="主题中心"]')).toBeVisible();
  await expect(page.getByText('当前使用', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Noir/ }).click();
  await expect(page.getByRole('button', { name: '保存主题' })).toBeEnabled();
  await page.getByLabel('选择品牌强调色').fill('#123456');
  await expect(page.locator('.theme-preview-device')).toHaveAttribute(
    'data-theme',
    'noir',
  );
  await page.getByRole('button', { name: '恢复修改' }).click();
  await page.getByRole('button', { name: /Noir/ }).click();
  await page.getByRole('button', { name: '保存主题' }).click();
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

test('Asset Library retains its empty state without adding a page overflow owner', async ({
  page,
}) => {
  await installAdminFixture(page);
  await page.setViewportSize({ width: 1024, height: 700 });
  await page.goto('/admin/#home');
  await page
    .getByRole('navigation', { name: '管理业务域' })
    .getByRole('button', { name: '内容' })
    .click();
  await page
    .getByRole('navigation', { name: '内容二级导航' })
    .getByRole('button', { name: '素材库' })
    .click();

  await expectVisuallyHiddenHeading(page, '素材库管理');
  await expect(page.getByText('没有匹配的素材')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        pageHasNoHorizontalOverflow:
          document.documentElement.scrollWidth <= window.innerWidth,
        workspaceOwnsOverflow:
          getComputedStyle(
            document.querySelector<HTMLElement>('.admin-workspace-content')!,
          ).overflowY === 'auto',
      })),
    )
    .toEqual({ pageHasNoHorizontalOverflow: true, workspaceOwnsOverflow: true });
});

test('unsaved navigation keeps the active workspace until discard is confirmed', async ({
  page,
}) => {
  await installAdminFixture(page);
  await page.goto('/admin/#settings');
  await expect(page.locator('h1.admin-visually-hidden')).toHaveText('系统设置');

  await page.getByLabel('站点名称').fill('Unsaved Admin Shell');
  await expect(page.getByText('未保存更改')).toBeVisible();
  await page
    .getByRole('navigation', { name: '管理业务域' })
    .getByRole('button', { name: '设计中心' })
    .click();

  const discardDialog = page.getByRole('alertdialog', { name: '放弃当前修改？' });
  await expect(discardDialog).toBeVisible();
  await expect(page).toHaveURL(/#system-general$/u);
  await discardDialog.getByRole('button', { name: '继续编辑' }).click();
  await expect(discardDialog).toBeHidden();
  await expect(page).toHaveURL(/#system-general$/u);

  await page
    .getByRole('navigation', { name: '管理业务域' })
    .getByRole('button', { name: '设计中心' })
    .click();
  await discardDialog.getByRole('button', { name: '放弃修改并切换' }).click();
  await expect(discardDialog).toBeHidden();
  await expect(page).toHaveURL(/#home$/u);
});
