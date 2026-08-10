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

export function storefrontThemeStyle(
  tokens: StorefrontThemeTokens,
  accent?: string | null,
): CSSProperties {
  const brand = accent || tokens.brand;
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
  } as CSSProperties;
}
