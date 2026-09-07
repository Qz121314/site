import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

test('shared button hierarchy exposes primary secondary ghost and danger with explicit busy state', async () => {
  const variants = await source('../src/components/ui/button-variants.ts');
  const button = await source('../src/components/ui/button.tsx');
  const css = await source('../src/admin-ui-system.css');

  for (const variant of ['primary', 'secondary', 'ghost', 'danger']) {
    assert.match(variants, new RegExp(`${variant}:\\s*'ui-button--${variant}'`));
  }
  assert.match(variants, /destructive:\s*'ui-button--danger'/);
  assert.match(button, /loading\?: boolean/);
  assert.match(button, /aria-busy=\{loading \|\| undefined\}/);
  assert.match(button, /disabled=\{asChild \? undefined : loading \|\| disabled\}/);
  assert.match(button, /LoaderCircle/);
  assert.match(css, /\.ui-button--danger/);
  assert.match(css, /\.ui-button:disabled[\s\S]*cursor:\s*not-allowed/);
  assert.match(css, /\.ui-button:focus-visible/);
});

test('segmented control and selected navigation use strong non-color-only state', async () => {
  const segmented = await source('../src/components/ui/segmented-control.tsx');
  const sharedCss = await source('../src/admin-ui-system.css');
  const sidebarCss = await source('../src/admin-sidebar.css');
  const navigationCss = await source('../src/bottom-navigation-settings.css');

  assert.match(segmented, /AdminSegmentedControl/);
  assert.match(segmented, /AdminSegmentedItem/);
  assert.match(segmented, /aria-pressed=\{selected\}/);
  assert.match(segmented, /aria-current=\{current \? 'page' : undefined\}/);
  assert.match(sharedCss, /\.ui-segmented-control[\s\S]*overflow-x:\s*auto/);
  assert.match(sharedCss, /\.ui-segmented-item[^\{]*\.is-selected[\s\S]*background:/);
  assert.match(sharedCss, /\.ui-segmented-item[^\{]*\.is-selected[\s\S]*border-color:/);
  assert.match(sharedCss, /\.ui-segmented-item[^\{]*\.is-selected[\s\S]*font-weight:/);
  assert.match(sharedCss, /\.ui-segmented-item:focus-visible/);
  assert.match(sharedCss, /\.ui-segmented-item[^\{]*\{[\s\S]*min-height:\s*44px/);

  assert.match(sidebarCss, /\.admin-primary-link\.ui-button\.is-active[\s\S]*background:/);
  assert.match(sidebarCss, /\.admin-primary-link\.ui-button\.is-active[\s\S]*box-shadow:/);
  assert.match(sidebarCss, /\.admin-secondary-link\.ui-button\.is-active[\s\S]*background:/);
  assert.match(sidebarCss, /\.admin-secondary-link\.ui-button\.is-active[\s\S]*box-shadow:/);
  assert.match(navigationCss, /\.admin-bottom-navigation-row\.is-selected[\s\S]*background:/);
  assert.match(navigationCss, /\.admin-bottom-navigation-row\.is-selected[\s\S]*box-shadow:/);
});

test('shared status form feedback dialog drawer and action-bar patterns are semantic', async () => {
  const badge = await source('../src/components/ui/status-badge.tsx');
  const form = await source('../src/components/ui/form-section.tsx');
  const feedback = await source('../src/components/ui/feedback-state.tsx');
  const dialog = await source('../src/components/ui/dialog.tsx');
  const actions = await source('../src/components/ui/action-bar.tsx');
  const shell = await source('../src/shell/AdminShell.tsx');
  const css = await source('../src/admin-ui-system.css');

  for (const tone of ['default', 'success', 'warning', 'danger', 'info']) {
    assert.match(badge, new RegExp(`'${tone}'`));
  }
  assert.match(badge, /ui-status-badge/);
  assert.match(form, /AdminFormSection/);
  assert.match(form, /AdminFieldRow/);
  assert.match(form, /htmlFor=\{htmlFor\}/);
  assert.match(feedback, /AdminFeedbackState/);
  assert.match(feedback, /'empty' \| 'loading' \| 'error'/);
  assert.match(feedback, /role=\{kind === 'error' \? 'alert' : 'status'\}/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /event\.key === 'Escape'/);
  assert.match(dialog, /event\.key !== 'Tab'/);
  assert.match(dialog, /previousFocus\.current\?\.focus\(\)/);
  assert.match(actions, /AdminActionBar/);
  assert.match(actions, /is-sticky/);
  assert.match(shell, /ui-drawer-backdrop/);
  assert.match(shell, /ui-drawer/);
  assert.match(css, /\.ui-dialog-backdrop/);
  assert.match(css, /\.ui-dialog-footer/);
  assert.match(css, /\.ui-drawer/);
  assert.match(css, /\.ui-action-bar\.is-sticky/);
});

test('reference pages adopt the shared patterns without adding request behavior', async () => {
  const navigation = await source('../src/experience/NavigationSettingsView.tsx');
  const bottomNavigation = await source('../src/BottomNavigationSettingsSection.tsx');
  const general = await source('../src/system/SystemGeneralView.tsx');
  const infrastructure = await source('../src/system/SystemInfrastructureView.tsx');
  const catalog = await source('../src/catalog/CatalogWorkspaceSwitcher.tsx');
  const faq = await source('../src/FaqManagementView.tsx');
  const mediaPicker = await source('../src/asset-library/MediaPickerDialog.tsx');

  assert.match(navigation, /<AdminActionBar/);
  assert.match(navigation, /<Button[\s\S]*variant="primary"/);
  assert.match(bottomNavigation, /AdminStatusBadge/);
  assert.match(bottomNavigation, /is-selected/);

  assert.match(general, /AdminFormSection/);
  assert.match(general, /AdminFieldRow/);
  assert.match(general, /<Button[\s\S]*variant="primary"/);
  assert.match(general, /<AdminActionBar/);

  assert.match(infrastructure, /AdminFormSection/);
  assert.match(infrastructure, /AdminFieldRow/);
  assert.match(infrastructure, /AdminStatusBadge/);
  assert.match(infrastructure, /variant="secondary"/);
  assert.match(infrastructure, /variant="primary"/);

  assert.match(catalog, /AdminSegmentedControl/);
  assert.match(catalog, /AdminSegmentedItem/);
  assert.match(catalog, /selected=\{active\}/);

  assert.match(faq, /AdminDialog/);
  assert.match(faq, /AdminSegmentedControl/);
  assert.match(faq, /AdminSegmentedItem/);
  assert.match(faq, /AdminFeedbackState/);
  assert.match(faq, /variant="primary"/);
  assert.match(faq, /variant="secondary"/);
  assert.match(faq, /variant="danger"/);
  assert.match(mediaPicker, /AdminDialog/);

  for (const sharedSource of [navigation, bottomNavigation, general, catalog]) {
    assert.doesNotMatch(sharedSource, /fetch\(|setInterval\(|setTimeout\(/);
  }
});

test('Phase C shared CSS adds no important overrides or oversized radii', async () => {
  const css = await source('../src/admin-ui-system.css');
  const marker = '/* ---------- Commercial patterns ---------- */';
  const start = css.indexOf(marker);
  assert.notEqual(start, -1);
  const phaseC = css.slice(start);

  assert.doesNotMatch(phaseC, /!important/);
  assert.doesNotMatch(phaseC, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
  assert.match(phaseC, /prefers-reduced-motion/);
  assert.match(phaseC, /safe-area-inset-bottom/);
});
