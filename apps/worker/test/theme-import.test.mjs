import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseThemeSettings,
  persistedThemeKey,
  resolveTheme,
  validateThemeUpdate,
} from '../src/theme/theme-center.ts';
import { importThemeJson } from '../src/theme/theme-import.ts';

const storedCustomTheme = {
  source: 'json',
  label: 'Stored Custom',
  description: 'Stored locally after import.',
  colorScheme: 'dark',
  tokens: {
    brand: '#ff3366',
    brandStrong: '#ff6688',
    text: '#ffffff',
    muted: '#a3a3a3',
    surface: '#171717',
    surfaceSoft: '#202020',
    line: '#333333',
    pageBg: '#0a0a0a',
    heroStart: '#4a1028',
    heroEnd: '#171717',
    heroGlow: '#ff3366',
    shadow: '0 16px 44px rgb(0 0 0 / 36%)',
  },
};

test('imports a shadcn registry theme into site tokens', () => {
  const result = importThemeJson(
    {
      type: 'registry:theme',
      name: 'ocean-mobile',
      title: 'Ocean Mobile',
      description: 'A clean mobile theme.',
      cssVars: {
        light: {
          background: 'oklch(0.98 0.01 240)',
          foreground: 'oklch(0.2 0.03 250)',
          primary: 'oklch(0.58 0.19 245)',
          'muted-foreground': 'oklch(0.5 0.04 250)',
          card: 'oklch(1 0 0)',
          muted: 'oklch(0.95 0.02 245)',
          border: 'oklch(0.9 0.02 245)',
          accent: 'oklch(0.7 0.16 220)',
          ring: 'oklch(0.62 0.18 245)',
        },
      },
    },
    'light',
  );

  assert.equal(result.ok, true);
  assert.equal(result.definition.label, 'Ocean Mobile');
  assert.equal(result.definition.tokens.brand, 'oklch(0.58 0.19 245)');
  assert.equal(result.definition.tokens.pageBg, 'oklch(0.98 0.01 240)');
});

test('normalizes legacy bare shadcn HSL triples', () => {
  const result = importThemeJson(
    {
      type: 'registry:theme',
      name: 'legacy-theme',
      cssVars: {
        dark: {
          background: '222.2 84% 4.9%',
          foreground: '210 40% 98%',
          primary: '217.2 91.2% 59.8%',
        },
      },
    },
    'dark',
  );

  assert.equal(result.ok, true);
  assert.equal(result.definition.tokens.brand, 'hsl(217.2 91.2% 59.8%)');
  assert.equal(result.definition.tokens.pageBg, 'hsl(222.2 84% 4.9%)');
});

test('rejects shadcn theme when requested mode is missing', () => {
  const result = importThemeJson(
    {
      type: 'registry:theme',
      name: 'light-only',
      cssVars: { light: { primary: '#3366ff' } },
    },
    'dark',
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, 'THEME_IMPORT_MODE_MISSING');
});

test('custom imported theme can be validated and resolved without external source', () => {
  const validation = validateThemeUpdate({
    themeKey: 'custom',
    overrides: {
      imported: storedCustomTheme,
      density: 'comfortable',
      fontPack: 'editorial',
      buttonStyle: 'refined',
      mediaStyle: 'soft',
      motionStyle: 'gentle',
      navigationStyle: 'quiet',
    },
  });
  assert.equal(validation.ok, true);
  const resolved = resolveTheme(validation.settings);
  assert.equal(resolved.key, 'custom');
  assert.equal(resolved.label, 'Stored Custom');
  assert.equal(resolved.tokens.brand, '#ff3366');
  assert.equal(resolved.recipe.version, 2);
  assert.equal(resolved.density, 'comfortable');
  assert.equal(resolved.recipe.fontPack, 'editorial');
  assert.equal(resolved.recipe.buttonStyle, 'refined');
  assert.equal(resolved.recipe.mediaStyle, 'soft');
  assert.equal(resolved.recipe.motionStyle, 'gentle');
  assert.equal(resolved.recipe.navigationStyle, 'quiet');
});

test('Premium Noir Dating V2 resolves a complete commercial UI recipe', () => {
  const resolved = resolveTheme({ key: 'noir', overrides: {} });
  assert.equal(resolved.label, 'Premium Noir Dating V2');
  assert.equal(resolved.colorScheme, 'dark');
  assert.deepEqual(resolved.recipe, {
    version: 2,
    fontPack: 'editorial',
    buttonStyle: 'refined',
    mediaStyle: 'soft',
    motionStyle: 'restrained',
    navigationStyle: 'quiet',
  });
  assert.equal(resolved.tokens.pageBg, '#0b080b');
  assert.equal(resolved.tokens.brand, '#e45594');
});

test('custom theme persists through the existing official-key D1 constraint', () => {
  const validation = validateThemeUpdate({
    themeKey: 'custom',
    overrides: { imported: storedCustomTheme },
  });
  assert.equal(validation.ok, true);
  assert.equal(persistedThemeKey(validation.settings), 'marketplace');

  const reloaded = parseThemeSettings(
    'marketplace',
    JSON.stringify(validation.settings.overrides),
  );
  assert.equal(reloaded.key, 'custom');
  assert.equal(reloaded.overrides.imported?.label, 'Stored Custom');
});

test('custom key is rejected unless imported tokens are present', () => {
  const result = validateThemeUpdate({ themeKey: 'custom', overrides: {} });
  assert.equal(result.ok, false);
  assert.equal(result.field, 'imported');
});
