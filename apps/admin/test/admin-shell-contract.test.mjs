import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

test('Dashboard keeps feature implementations lazy and shell navigation request-neutral', async () => {
  const dashboard = await source('../src/Dashboard.tsx');
  const navigation = await source('../src/admin-navigation.ts');

  for (const feature of [
    'SiteSettingsView',
    'ThemeCenterView',
    'AssetLibraryView',
    'CustomerServiceView',
    'SectionManagementView',
    'FaqManagementView',
    'ProductManagementView',
    'CategoryManagementView',
    'TagManagementView',
    'ConversionPoolView',
  ]) {
    assert.match(dashboard, new RegExp(`const ${feature} = lazy\\(\\(\\) =>`));
  }

  assert.equal((dashboard.match(/fetchSections\('active'\)/g) ?? []).length, 1);
  assert.equal((dashboard.match(/fetchPublishStatus\(\)/g) ?? []).length, 1);
  assert.doesNotMatch(navigation, /fetchSections|fetchPublishStatus|fetch\(/);
});

test('shell preserves unsaved navigation, logout and history guards', async () => {
  const dashboard = await source('../src/Dashboard.tsx');

  assert.match(dashboard, /function requestView\(nextView: AdminView\)/);
  assert.match(dashboard, /if \(unsaved\.isDirty\)/);
  assert.match(dashboard, /setPendingDiscardAction\(\{ kind: 'navigate', view: nextView \}\)/);
  assert.match(dashboard, /function requestLogout\(\)/);
  assert.match(dashboard, /setPendingDiscardAction\(\{ kind: 'logout' \}\)/);
  assert.match(dashboard, /window\.addEventListener\('beforeunload'/);
  assert.match(dashboard, /window\.addEventListener\('hashchange'/);
  assert.match(dashboard, /window\.addEventListener\('popstate'/);
  assert.match(dashboard, /commitView\('sections', 'replace'\)/);
});

test('two-level shell exposes semantic navigation, page header and workspace', async () => {
  const shell = await source('../src/shell/AdminShell.tsx');
  const primary = await source('../src/shell/AdminPrimarySidebar.tsx');
  const secondary = await source('../src/shell/AdminSecondarySidebar.tsx');
  const pageHeader = await source('../src/shell/AdminPageHeader.tsx');
  const workspace = await source('../src/shell/AdminWorkspace.tsx');

  assert.match(shell, /AdminPrimarySidebar/);
  assert.match(shell, /AdminSecondarySidebar/);
  assert.match(shell, /AdminPageHeader/);
  assert.match(shell, /AdminWorkspace/);
  assert.match(primary, /aria-label="后台一级导航"/);
  assert.match(primary, /aria-current=\{active \? 'location' : undefined\}/);
  assert.match(secondary, /aria-label="后台二级导航"/);
  assert.match(secondary, /aria-current=\{active \? 'page' : undefined\}/);
  assert.match(pageHeader, /admin-page-header/);
  assert.match(workspace, /admin-workspace--\$\{width\}/);
});

test('mobile navigation owns focus trap, escape close, focus restore and body scroll', async () => {
  const shell = await source('../src/shell/AdminShell.tsx');

  assert.match(shell, /FOCUSABLE_SELECTOR/);
  assert.match(shell, /event\.key === 'Escape'/);
  assert.match(shell, /event\.key !== 'Tab'/);
  assert.match(shell, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(shell, /admin-mobile-nav-trigger'\)\?\.focus\(\)/);
  assert.match(shell, /aria-modal="true"/);
  assert.match(shell, /aria-label="后台导航"/);
});

test('responsive shell provides desktop, tablet and mobile layouts without clipping content', async () => {
  const shellCss = await source('../src/admin-shell.css');
  const sidebarCss = await source('../src/admin-sidebar.css');
  const workspaceCss = await source('../src/admin-workspace.css');
  const scrollCss = await source('../src/admin-scroll-ownership.css');
  const combined = `${shellCss}\n${sidebarCss}\n${workspaceCss}\n${scrollCss}`;

  assert.match(shellCss, /@media \(min-width: 1200px\)/);
  assert.match(shellCss, /grid-template-columns: 220px 200px minmax\(0, 1fr\)/);
  assert.match(shellCss, /@media \(min-width: 900px\) and \(max-width: 1199px\)/);
  assert.match(shellCss, /grid-template-columns: 88px 188px minmax\(0, 1fr\)/);
  assert.match(shellCss, /@media \(max-width: 899px\)/);
  assert.match(sidebarCss, /min-height: 44px/);
  assert.match(workspaceCss, /env\(safe-area-inset-top\)/);
  assert.match(workspaceCss, /env\(safe-area-inset-bottom\)/);
  assert.match(scrollCss, /\.admin-workspace-content[\s\S]*overflow-y: auto/);
  assert.doesNotMatch(scrollCss, /max-height: calc\(100dvh/);
  assert.doesNotMatch(combined, /!important/);
});

test('publish, rollback and logout controls remain in the global shell', async () => {
  const dashboard = await source('../src/Dashboard.tsx');
  const publishing = await source('../src/shell/AdminPublishingControls.tsx');

  assert.match(dashboard, /AdminPublishingControls/);
  assert.match(dashboard, /rollbackStorefront/);
  assert.match(dashboard, /requestLogout/);
  assert.match(publishing, /发布全部待更新/);
  assert.match(publishing, /onRequestRollback/);
  assert.match(publishing, /publish-version-popover/);
});
