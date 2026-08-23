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

export type StorefrontColorScheme = 'light' | 'dark';

export type StorefrontBrandContrast = {
  foreground: string;
  ratio: number | null;
};

function hexLuminance(value: string): number | null {
  const match = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/iu.exec(value.trim());
  if (!match?.[1]) return null;
  const channels = match[1]
    .match(/.{2}/gu)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  if (!channels || channels.length !== 3) return null;
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

export function storefrontBrandContrast(
  brand: string,
  colorScheme: StorefrontColorScheme,
): StorefrontBrandContrast {
  const luminance = hexLuminance(brand);
  if (luminance === null) {
    return {
      foreground: colorScheme === 'light' ? 'var(--text)' : 'var(--page-bg)',
      ratio: null,
    };
  }
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= blackContrast
    ? { foreground: '#ffffff', ratio: whiteContrast }
    : { foreground: '#000000', ratio: blackContrast };
}

export function storefrontBrandForeground(
  brand: string,
  colorScheme: StorefrontColorScheme,
): string {
  return storefrontBrandContrast(brand, colorScheme).foreground;
}

export function storefrontThemeStyle(
  tokens: StorefrontThemeTokens,
  accent?: string | null,
  colorScheme: StorefrontColorScheme = 'light',
): CSSProperties {
  const brand = accent || tokens.brand;
  return {
    '--brand': brand,
    '--brand-strong': accent || tokens.brandStrong,
    '--theme-on-brand': storefrontBrandForeground(brand, colorScheme),
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
