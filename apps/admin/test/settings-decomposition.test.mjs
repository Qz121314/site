import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { toSiteSettingsUpdateInput } from '../src/settings/site-settings-state.ts';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const settings = {
  siteName: 'Site',
  locationLabel: 'Global',
  mediaBaseUrl: 'https://assets.example.com',
  logoAssetId: 'logo-1',
  ga4MeasurementId: 'G-ABC123',
  homeSectionLimit: 8,
  showHot: true,
  showLatest: true,
  showMore: true,
  showFaq: false,
  installPrompt: {
    enabled: true,
    delaySeconds: 30,
    title: 'Install',
    description: 'Desktop',
    iosDescription: 'iOS',
    installLabel: 'Install',
    dismissLabel: 'Later',
  },
  updatedAt: '2026-09-06T00:00:00.000Z',
  pwaIconAssetId: 'pwa-1',
  heroSlides: [
    {
      id: 'hero-1',
      mediaAssetId: 'media-1',
      mediaKind: 'image',
      mediaUrl: 'https://assets.example.com/hero.webp',
      title: 'Hero',
      description: null,
      ctaLabel: null,
      ctaHref: null,
      sortOrder: 0,
    },
  ],
  bottomNavigation: [
    {
      key: 'home',
      label: 'Home',
      iconType: 'builtin',
      iconValue: 'home',
      iconAssetId: null,
      enabled: true,
      sortOrder: 0,
    },
  ],
  homeLayout: {
    shortcutSectionIds: ['section-a'],
    recommendationSectionIds: ['section-b'],
  },
};

test('whole-payload input preserves unrelated settings slices', () => {
  const input = toSiteSettingsUpdateInput(settings);

  const homeSave = { ...input, showHot: false, homeSectionLimit: 4 };
  assert.equal(homeSave.siteName, 'Site');
  assert.equal(homeSave.pwaIconAssetId, 'pwa-1');
  assert.equal(homeSave.mediaBaseUrl, 'https://assets.example.com');
  assert.equal(homeSave.ga4MeasurementId, 'G-ABC123');
  assert.deepEqual(homeSave.bottomNavigation, input.bottomNavigation);
  assert.deepEqual(homeSave.installPrompt, input.installPrompt);

  const navigationSave = {
    ...input,
    bottomNavigation: input.bottomNavigation.map((item) => ({
      ...item,
      label: 'Start',
    })),
  };
  assert.equal(navigationSave.siteName, 'Site');
  assert.equal(navigationSave.pwaIconAssetId, 'pwa-1');
  assert.deepEqual(navigationSave.homeLayout, input.homeLayout);
  assert.deepEqual(navigationSave.heroSlides, input.heroSlides);

  const generalSave = { ...input, siteName: 'Updated' };
  assert.equal(generalSave.mediaBaseUrl, 'https://assets.example.com');
  assert.equal(generalSave.ga4MeasurementId, 'G-ABC123');
  assert.deepEqual(generalSave.bottomNavigation, input.bottomNavigation);
  assert.deepEqual(generalSave.installPrompt, input.installPrompt);
});

test('settings provider bounds reads and writes without polling', () => {
  const provider = source('../src/settings/SiteSettingsProvider.tsx');
  const workspace = source('../src/settings/SiteSettingsWorkspace.tsx');

  assert.equal((provider.match(/fetchSiteSettingsWithHero\(\)/g) ?? []).length, 1);
  assert.equal((provider.match(/updateSiteSettingsWithHero\(input\)/g) ?? []).length, 1);
  assert.doesNotMatch(provider, /setInterval|setTimeout|poll/i);
  assert.match(workspace, /SiteSettingsProvider/);
  assert.match(workspace, /view === 'home'/);
  assert.match(workspace, /view === 'navigation'/);
  assert.match(workspace, /view === 'messages'/);
  assert.match(workspace, /view === 'pwa'/);
  assert.match(workspace, /view === 'system-general'/);
  assert.match(workspace, /view === 'system-infrastructure'/);
  assert.match(workspace, /SystemAdvancedView/);
});

test('workspace ownership is decomposed by domain', () => {
  const home = source('../src/experience/HomeExperienceView.tsx');
  const navigation = source('../src/experience/NavigationSettingsView.tsx');
  const messages = source('../src/experience/MessagesExperienceView.tsx');
  const messagesArticles = source(
    '../src/experience/messages-articles/MessagesArticlesSection.tsx',
  );
  const pwa = source('../src/experience/PwaSettingsView.tsx');
  const general = source('../src/system/SystemGeneralView.tsx');
  const infrastructure = source('../src/system/SystemInfrastructureView.tsx');
  const advanced = source('../src/system/SystemAdvancedView.tsx');

  assert.match(home, /SiteHeroSettingsSection/);
  assert.match(home, /HomeLayoutSettingsSection/);
  assert.doesNotMatch(home, /showHot|showLatest|showMore|showFaq|homeSectionLimit/);
  assert.match(navigation, /BottomNavigationSettingsSection/);
  assert.match(pwa, /installPrompt/);
  assert.match(pwa, /pwaIconAssetId/);
  assert.match(general, /siteName/);
  assert.match(general, /locationLabel/);
  assert.match(general, /logoAssetId/);
  assert.match(infrastructure, /mediaBaseUrl/);
  assert.match(infrastructure, /testMediaDomain/);
  assert.match(advanced, /ga4MeasurementId/);

  assert.match(messages, /MessagesArticlesSection/);
  assert.match(messagesArticles, /Article Center/u);
  assert.doesNotMatch(messages, /ArticlePicker|background_media_id|messageArticleApi/i);
  assert.doesNotMatch(messages, /saveSettings/);
});

test('dirty ownership is workspace-specific', () => {
  const sources = [
    ['../src/experience/HomeExperienceView.tsx', 'homepage-settings'],
    ['../src/experience/NavigationSettingsView.tsx', 'navigation-settings'],
    [
      '../src/experience/messages-articles/MessagesArticlesSection.tsx',
      'messages-articles',
    ],
    ['../src/experience/PwaSettingsView.tsx', 'pwa-settings'],
    ['../src/system/SystemGeneralView.tsx', 'system-general'],
    ['../src/system/SystemInfrastructureView.tsx', 'system-infrastructure'],
    ['../src/system/SystemAdvancedView.tsx', 'system-advanced'],
  ];

  for (const [path, owner] of sources) {
    assert.match(source(path), new RegExp(`useAdminDirtySource\\('${owner}'`));
  }
});

test('navigation uses compact rows rather than the legacy four-card wall', () => {
  const navigation = source('../src/BottomNavigationSettingsSection.tsx');
  const css = source('../src/bottom-navigation-settings.css');

  assert.match(navigation, /admin-bottom-navigation-list/);
  assert.match(navigation, /admin-bottom-navigation-row/);
  assert.match(navigation, /aria-expanded/);
  assert.match(navigation, /role="img"/);
  assert.doesNotMatch(navigation, /admin-bottom-navigation-card/);
  assert.doesNotMatch(css, /admin-bottom-navigation-grid/);
  assert.match(css, /min-height: 60px/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.doesNotMatch(css, /!important/);
});
