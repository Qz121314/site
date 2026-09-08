import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

test('feature implementations stay lazy and request-neutral', async () => {
  const dashboard = await source('../src/Dashboard.tsx');
  const navigation = await source('../src/admin-navigation.ts');
  const features = [
    'SiteSettingsWorkspace',
    'ThemeCenterView',
    'AssetLibraryView',
    'CustomerServiceView',
    'SectionManagementView',
    'FaqManagementView',
    'ProductManagementView',
    'CategoryManagementView',
    'TagManagementView',
    'ConversionPoolView',
  ];

  for (const feature of features) {
    assert.match(dashboard, new RegExp(`const ${feature} = lazy\\(\\(\\) =>`));
  }

  assert.doesNotMatch(dashboard, /const SiteSettingsView = lazy/);
  assert.equal((dashboard.match(/fetchSections\('active'\)/g) ?? []).length, 1);
  assert.equal((dashboard.match(/fetchPublishStatus\(\)/g) ?? []).length, 1);
  assert.doesNotMatch(navigation, /fetchSections|fetchPublishStatus|fetch\(/);
});

test('unsaved and history guards stay wired', async () => {
  const dashboard = await source('../src/Dashboard.tsx');

  assert.match(dashboard, /function requestView\(nextView: AdminView\)/);
  assert.match(dashboard, /if \(unsaved\.isDirty\)/);
  assert.match(
    dashboard,
    /setPendingDiscardAction\(\{ kind: 'navigate', view: nextView \}\)/,
  );
  assert.match(dashboard, /function requestLogout\(\)/);
  assert.match(dashboard, /setPendingDiscardAction\(\{ kind: 'logout' \}\)/);
  assert.match(dashboard, /window\.addEventListener\('beforeunload'/);
  assert.match(dashboard, /window\.addEventListener\('hashchange'/);
  assert.match(dashboard, /window\.addEventListener\('popstate'/);
  assert.match(dashboard, /commitView\('sections', 'replace'\)/);
});

test('two-level shell exposes zero-chrome navigation', async () => {
  const shell = await source('../src/shell/AdminShell.tsx');
  const primary = await source('../src/shell/AdminPrimarySidebar.tsx');
  const secondary = await source('../src/shell/AdminSecondarySidebar.tsx');
  const workspace = await source('../src/shell/AdminWorkspace.tsx');
  const dashboard = await source('../src/Dashboard.tsx');

  assert.match(shell, /AdminPrimarySidebar/);
  assert.match(shell, /AdminSecondarySidebar/);
  assert.match(shell, /AdminWorkspace/);
  assert.match(shell, /<AdminWorkspace width=\{workspaceWidth\}>/);
  assert.match(shell, /<h1 className="admin-visually-hidden">\{context\.title\}<\/h1>/);
  assert.doesNotMatch(shell, /AdminTopBar|AdminPageHeader/);
  assert.match(dashboard, /workspaceWidthForView/);
  assert.match(primary, /aria-label="后台一级导航"/);
  assert.match(primary, /aria-current=\{active \? 'location' : undefined\}/);
  assert.match(primary, /admin-primary-account/);
  assert.match(primary, /退出登录/);
  assert.match(secondary, /aria-label="后台二级导航"/);
  assert.match(secondary, /aria-current=\{active \? 'page' : undefined\}/);
  assert.doesNotMatch(secondary, /admin-secondary-heading|Workspace/);
  assert.match(workspace, /admin-workspace--\$\{width\}/);
});

test('mobile drawer stays accessible without a global header', async () => {
  const shell = await source('../src/shell/AdminShell.tsx');

  assert.match(shell, /FOCUSABLE_SELECTOR/);
  assert.match(shell, /event\.key === 'Escape'/);
  assert.match(shell, /event\.key !== 'Tab'/);
  assert.match(shell, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(shell, /drawerTriggerRef\.current\?\.focus\(\)/);
  assert.match(shell, /aria-modal="true"/);
  assert.match(shell, /aria-label="后台导航"/);
  assert.match(shell, /className="admin-mobile-nav-trigger"/);
  assert.doesNotMatch(shell, /<header/);
});

test('responsive shell avoids clipping and page chrome', async () => {
  const shellCss = await source('../src/admin-shell.css');
  const workspaceCss = await source('../src/admin-workspace.css');
  const scrollCss = await source('../src/admin-scroll-ownership.css');
  const workspace = await source('../src/shell/AdminWorkspace.tsx');
  const combined = `${shellCss}\n${workspaceCss}\n${scrollCss}`;

  assert.match(shellCss, /grid-template-columns:[\s\S]*minmax\(0, 1fr\)/);
  assert.match(shellCss, /admin-mobile-drawer-backdrop/);
  assert.match(workspace, /'split-pane'/);
  assert.match(scrollCss, /\.admin-workspace-content[\s\S]*overflow-y: auto/);
  assert.match(workspaceCss, /\.admin-visually-hidden/);
  assert.match(workspaceCss, /\.admin-workspace-toolbar/);
  assert.doesNotMatch(workspaceCss, /\.admin-top-bar|\.admin-page-header/);
  assert.doesNotMatch(scrollCss, /max-height: calc\(100dvh/);
  assert.doesNotMatch(combined, /!important/);
});

test('P8A owns one blue Admin palette and compact desktop geometry', async () => {
  const adminManifest = await source('../src/admin.css');
  const foundationCss = await source('../src/admin-foundation.css');
  const uiSystemCss = await source('../src/admin-ui-system.css');
  const stylesCss = await source('../src/styles.css');
  const shellCss = await source('../src/admin-shell.css');
  const sidebarCss = await source('../src/admin-sidebar.css');
  const workspaceCss = await source('../src/admin-workspace.css');
  const settingsWorkspaceCss = await source('../src/settings/settings-workspace.css');
  const themeCss = await source('../src/theme-center.css');

  assert.match(foundationCss, /--brand:\s*#2563eb/);
  assert.match(foundationCss, /--brand-dark:\s*#1d4ed8/);
  assert.match(foundationCss, /--brand-soft:\s*#eff6ff/);
  assert.match(foundationCss, /--success:/);
  assert.match(foundationCss, /--warning:/);
  assert.match(foundationCss, /--danger:/);
  assert.match(foundationCss, /--info:/);

  const localCssImports = [...adminManifest.matchAll(/@import '(\.[^']+\.css)'/g)].map(
    (match) => match[1],
  );
  const manifestUrl = new URL('../src/admin.css', import.meta.url);
  const localCss = await Promise.all(
    localCssImports.map((relativePath) =>
      readFile(new URL(relativePath, manifestUrl), 'utf8'),
    ),
  );
  const legacyOrange = /#ff5a1f|#e84b12|#ff9a76|rgb\(255\s+90\s+31\s*\//i;
  assert.doesNotMatch(localCss.join('\n'), legacyOrange);

  assert.match(shellCss, /grid-template-columns:\s*172px 180px minmax\(0, 1fr\)/);
  assert.match(shellCss, /grid-template-columns:\s*68px 180px minmax\(0, 1fr\)/);
  assert.match(sidebarCss, /\.admin-primary-link\.ui-button[\s\S]*min-height:\s*36px/);
  assert.match(sidebarCss, /\.admin-secondary-link\.ui-button[\s\S]*min-height:\s*34px/);
  assert.match(uiSystemCss, /--admin-control-h:\s*34px/);
  assert.match(uiSystemCss, /--admin-command-h:\s*40px/);
  assert.match(uiSystemCss, /--admin-row-h:\s*42px/);

  assert.match(
    workspaceCss,
    /\.admin-workspace--wide \.admin-workspace-content,[\s\S]*\.admin-workspace--split-pane \.admin-workspace-content[\s\S]*max-width:\s*none/,
  );
  assert.doesNotMatch(settingsWorkspaceCss, /max-width:/);
  assert.doesNotMatch(themeCss, /100dvh\s*-\s*148px/);
  assert.match(themeCss, /\.theme-studio[\s\S]*height:\s*100%/);

  assert.doesNotMatch(stylesCss, /\.admin-header|\.environment-badge|\.admin-main/);
  assert.doesNotMatch(foundationCss, /\.admin-header|\.admin-main/);
  assert.doesNotMatch(uiSystemCss, /!important/);
});

test('publish, logout, and session state use local ownership', async () => {
  const dashboard = await source('../src/Dashboard.tsx');
  const shell = await source('../src/shell/AdminShell.tsx');
  const primary = await source('../src/shell/AdminPrimarySidebar.tsx');
  const publishing = await source('../src/shell/AdminPublishingControls.tsx');

  assert.match(
    dashboard,
    /function publishKeyForView\(view: AdminView\): string \| null/,
  );
  assert.match(dashboard, /return dynamic \? `section:\$\{dynamic\.sectionId\}` : null/);
  assert.match(dashboard, /const workspaceActions = contextPublishKey \?/);
  assert.doesNotMatch(dashboard, /topBarActions|environment-badge|会话至/);
  assert.match(dashboard, /onLogout=\{requestLogout\}/);
  assert.match(dashboard, /sessionExpiresAt=\{expiresAt\}/);
  assert.match(shell, /SESSION_WARNING_MS/);
  assert.match(shell, /admin-session-warning/);
  assert.match(primary, /onClick=\{onLogout\}/);
  assert.match(publishing, /发布全部待更新/);
  assert.match(publishing, /onRequestRollback/);
  assert.match(publishing, /publish-version-popover/);
});
