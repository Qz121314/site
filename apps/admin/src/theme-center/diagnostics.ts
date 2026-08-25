import {
  storefrontBrandContrast,
  storefrontContrastRatio,
  storefrontRelativeLuminance,
} from '@site/storefront-ui/theme';
import type { ThemePreset } from './api';

export type ThemeDiagnosticStatus = 'pass' | 'warning';

export type ThemeDiagnostic = {
  id: 'text' | 'cta' | 'surface' | 'darkness' | 'border';
  label: string;
  detail: string;
  status: ThemeDiagnosticStatus;
};

function ratioLabel(ratio: number | null): string {
  return ratio === null ? '无法计算' : `${ratio.toFixed(1)}:1`;
}

export function themeDiagnostics(
  preset: Pick<ThemePreset, 'colorScheme' | 'tokens'>,
  accent?: string | null,
): ThemeDiagnostic[] {
  const brand = accent || preset.tokens.brand;
  const textRatio = storefrontContrastRatio(preset.tokens.text, preset.tokens.pageBg);
  const cta = storefrontBrandContrast(brand, preset.colorScheme);
  const surfaceRatio = storefrontContrastRatio(preset.tokens.surface, preset.tokens.pageBg);
  const borderRatio = storefrontContrastRatio(preset.tokens.line, preset.tokens.surface);
  const pageLuminance = storefrontRelativeLuminance(preset.tokens.pageBg);
  const darkEnoughToLoseDepth =
    preset.colorScheme === 'dark' && pageLuminance !== null && pageLuminance < 0.004;

  return [
    {
      id: 'text',
      label: '文字 / 背景',
      detail: `正文对比度 ${ratioLabel(textRatio)}`,
      status: textRatio === null || textRatio >= 4.5 ? 'pass' : 'warning',
    },
    {
      id: 'cta',
      label: 'CTA 可读性',
      detail:
        cta.ratio === null
          ? '按钮文字会按主题明暗自动匹配'
          : `按钮文字对比度 ${ratioLabel(cta.ratio)}`,
      status: cta.ratio === null || cta.ratio >= 4.5 ? 'pass' : 'warning',
    },
    {
      id: 'surface',
      label: 'Surface 层级',
      detail: `Surface / 页面 ${ratioLabel(surfaceRatio)}`,
      status: surfaceRatio === null || surfaceRatio >= 1.08 ? 'pass' : 'warning',
    },
    {
      id: 'darkness',
      label: '深色亮度',
      detail:
        preset.colorScheme === 'dark'
          ? darkEnoughToLoseDepth
            ? '页面底色过暗，层级可能丢失'
            : '深色底仍保留可辨识层级'
          : '浅色主题无需深色亮度检查',
      status: darkEnoughToLoseDepth ? 'warning' : 'pass',
    },
    {
      id: 'border',
      label: '边框可见性',
      detail: `Line / Surface ${ratioLabel(borderRatio)}`,
      status: borderRatio === null || borderRatio >= 1.12 ? 'pass' : 'warning',
    },
  ];
}
