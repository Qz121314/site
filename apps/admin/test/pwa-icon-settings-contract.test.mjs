import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('system general and PWA keep logo and app icon as separate assets', () => {
  const generalSource = source('../src/system/SystemGeneralView.tsx');
  const pwaSource = source('../src/experience/PwaSettingsView.tsx');
  const brandingHookSource = source('../src/settings/useBrandingImageDraft.ts');
  const settingsApiSource = source('../src/site-hero-settings-api.ts');
  const brandingSource = source('../src/branding-media/local-branding-image.ts');

  assert.match(generalSource, /站点 Logo/u);
  assert.match(generalSource, /kind: 'logo'/u);
  assert.match(generalSource, /role="logo"/u);
  assert.match(pwaSource, /应用图标/u);
  assert.match(pwaSource, /kind: 'pwa-icon'/u);
  assert.match(pwaSource, /pwaIconAssetId/u);
  assert.match(pwaSource, /role="icon"/u);
  assert.match(brandingHookSource, /prepareBrandingImage\(file, kind\)/u);
  assert.match(
    brandingHookSource,
    /uploadBrandingImage\(kind, localImage\.compressedFile\)/u,
  );
  assert.match(settingsApiSource, /pwaIconAssetId/u);
  assert.match(brandingSource, /'pwa-icon'/u);
});
