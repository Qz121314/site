import type { CSSProperties } from 'react';

export type StorefrontThemeTokens = {
  brand: string;
  brandStrong: string;
  text: string;
  muted: string;
  surface: string;
  surfaceSoft: string;
  line: string;
  pageBg: string;
  heroStart: string;
  heroEnd: string;
  heroGlow: string;
  shadow: string;
};

export type StorefrontThemeDensity = 'compact' | 'standard' | 'comfortable';

export type StorefrontThemeRecipeOptions = {
  key?: string;
  density?: StorefrontThemeDensity;
};

type RecipeStyle = Record<`--theme-${string}`, string>;

const densityRecipes: Record<StorefrontThemeDensity, RecipeStyle> = {
  compact: {
    '--theme-section-space': '20px',
    '--theme-card-gap-y': '14px',
    '--theme-card-gap-x': '8px',
    '--theme-control-height': '42px',
    '--theme-section-icon-size': '44px',
    '--theme-desktop-media-size': '144px',
    '--theme-desktop-media-size-large': '162px',
  },
  standard: {
    '--theme-section-space': '24px',
    '--theme-card-gap-y': '18px',
    '--theme-card-gap-x': '10px',
    '--theme-control-height': '44px',
    '--theme-section-icon-size': '48px',
    '--theme-desktop-media-size': '154px',
    '--theme-desktop-media-size-large': '176px',
  },
  comfortable: {
    '--theme-section-space': '30px',
    '--theme-card-gap-y': '22px',
    '--theme-card-gap-x': '12px',
    '--theme-control-height': '48px',
    '--theme-section-icon-size': '52px',
    '--theme-desktop-media-size': '168px',
    '--theme-desktop-media-size-large': '190px',
  },
};

const baseRecipe: RecipeStyle = {
  '--theme-radius-card': '18px',
  '--theme-radius-media': '16px',
  '--theme-radius-control': '15px',
  '--theme-radius-icon': '15px',
  '--theme-radius-chip': '999px',
  '--theme-card-background': 'var(--surface)',
  '--theme-card-border': 'var(--line)',
  '--theme-card-shadow': '0 4px 16px color-mix(in srgb, var(--text) 4%, transparent)',
  '--theme-card-hover-shadow': 'var(--shadow)',
  '--theme-media-background': 'var(--surface-soft)',
  '--theme-control-background': 'var(--surface)',
  '--theme-control-shadow': '0 6px 22px color-mix(in srgb, var(--text) 7%, transparent)',
  '--theme-header-background': 'color-mix(in srgb, var(--surface) 95%, transparent)',
  '--theme-tab-background': 'color-mix(in srgb, var(--surface) 96%, transparent)',
  '--theme-tab-shadow': '0 -8px 24px color-mix(in srgb, var(--text) 5%, transparent)',
  '--theme-filter-background': 'var(--surface)',
  '--theme-chip-background': 'var(--surface)',
};

const themeRecipes: Record<string, RecipeStyle> = {
  marketplace: {
    '--theme-radius-card': '18px',
    '--theme-radius-media': '16px',
    '--theme-radius-control': '15px',
    '--theme-radius-icon': '15px',
    '--theme-card-shadow': '0 4px 16px rgb(31 35 40 / 4%)',
    '--theme-card-hover-shadow': '0 12px 28px rgb(31 35 40 / 8%)',
  },
  noir: {
    '--theme-radius-card': '22px',
    '--theme-radius-media': '20px',
    '--theme-radius-control': '18px',
    '--theme-radius-icon': '18px',
    '--theme-card-background': 'color-mix(in srgb, var(--surface) 94%, var(--brand) 6%)',
    '--theme-card-border': 'color-mix(in srgb, var(--line) 78%, var(--brand) 22%)',
    '--theme-card-shadow': '0 12px 30px rgb(0 0 0 / 22%)',
    '--theme-card-hover-shadow': 'var(--shadow)',
    '--theme-media-background': 'color-mix(in srgb, var(--surface-soft) 92%, black 8%)',
    '--theme-control-background': 'color-mix(in srgb, var(--surface) 90%, var(--brand) 10%)',
    '--theme-control-shadow': '0 10px 28px rgb(0 0 0 / 22%)',
    '--theme-header-background': 'color-mix(in srgb, var(--surface) 88%, transparent)',
    '--theme-tab-background': 'color-mix(in srgb, var(--surface) 92%, transparent)',
  },
  live: {
    '--theme-radius-card': '14px',
    '--theme-radius-media': '14px',
    '--theme-radius-control': '12px',
    '--theme-radius-icon': '14px',
    '--theme-radius-chip': '10px',
    '--theme-card-background': 'color-mix(in srgb, var(--surface) 92%, var(--brand) 8%)',
    '--theme-card-border': 'color-mix(in srgb, var(--line) 68%, var(--brand) 32%)',
    '--theme-card-shadow': '0 8px 24px rgb(0 0 0 / 22%)',
    '--theme-card-hover-shadow': '0 14px 34px color-mix(in srgb, var(--brand) 16%, black 84%)',
    '--theme-control-background': 'color-mix(in srgb, var(--surface) 90%, var(--brand) 10%)',
    '--theme-control-shadow': '0 8px 24px rgb(0 0 0 / 20%)',
  },
  saas: {
    '--theme-radius-card': '14px',
    '--theme-radius-media': '12px',
    '--theme-radius-control': '10px',
    '--theme-radius-icon': '12px',
    '--theme-card-shadow': '0 2px 8px color-mix(in srgb, var(--brand) 8%, transparent)',
    '--theme-card-hover-shadow': '0 10px 24px color-mix(in srgb, var(--brand) 12%, transparent)',
    '--theme-control-shadow': '0 4px 14px color-mix(in srgb, var(--brand) 8%, transparent)',
  },
  travel: {
    '--theme-radius-card': '24px',
    '--theme-radius-media': '22px',
    '--theme-radius-control': '18px',
    '--theme-radius-icon': '18px',
    '--theme-card-background': 'color-mix(in srgb, var(--surface) 96%, var(--surface-soft) 4%)',
    '--theme-card-shadow': '0 8px 22px rgb(57 72 65 / 8%)',
    '--theme-card-hover-shadow': 'var(--shadow)',
    '--theme-control-background': 'color-mix(in srgb, var(--surface) 94%, var(--surface-soft) 6%)',
    '--theme-control-shadow': '0 8px 20px rgb(57 72 65 / 8%)',
  },
  tech: {
    '--theme-radius-card': '16px',
    '--theme-radius-media': '14px',
    '--theme-radius-control': '12px',
    '--theme-radius-icon': '12px',
    '--theme-card-background': 'color-mix(in srgb, var(--surface) 82%, transparent)',
    '--theme-card-border': 'color-mix(in srgb, var(--line) 72%, var(--brand) 28%)',
    '--theme-card-shadow': '0 10px 28px rgb(0 0 0 / 22%)',
    '--theme-card-hover-shadow': '0 16px 38px color-mix(in srgb, var(--brand) 10%, black 90%)',
    '--theme-control-background': 'color-mix(in srgb, var(--surface) 82%, transparent)',
    '--theme-control-shadow': '0 8px 24px rgb(0 0 0 / 20%)',
    '--theme-header-background': 'color-mix(in srgb, var(--surface) 78%, transparent)',
    '--theme-tab-background': 'color-mix(in srgb, var(--surface) 82%, transparent)',
  },
};

export function storefrontThemeStyle(
  tokens: StorefrontThemeTokens,
  accent?: string | null,
  options: StorefrontThemeRecipeOptions = {},
): CSSProperties {
  const brand = accent || tokens.brand;
  const density = options.density ?? 'standard';
  const recipe = themeRecipes[options.key ?? 'custom'] ?? {};
  return {
    '--brand': brand,
    '--brand-strong': accent || tokens.brandStrong,
    '--text': tokens.text,
    '--muted': tokens.muted,
    '--surface': tokens.surface,
    '--surface-soft': tokens.surfaceSoft,
    '--line': tokens.line,
    '--page-bg': tokens.pageBg,
    '--hero-start': tokens.heroStart,
    '--hero-end': tokens.heroEnd,
    '--hero-glow': tokens.heroGlow,
    '--shadow': tokens.shadow,
    ...baseRecipe,
    ...densityRecipes[density],
    ...recipe,
  } as CSSProperties;
}
