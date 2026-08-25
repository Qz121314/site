import { storefrontBrandContrast } from '@site/storefront-ui/theme';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminApiError } from './api';
import { useAdminDirtySource } from './admin-unsaved-state';
import {
  fetchThemeCenter,
  updateThemeCenter,
  type ResolvedTheme,
  type ThemeKey,
  type ThemePreset,
} from './theme-center/api';

type ThemeCenterViewProps = {
  onSessionExpired: () => void;
};

const FONT_PACK_LABELS = {
  modern: 'Modern Sans',
  editorial: 'Soft Editorial',
  compact: 'Compact UI',
  technical: 'Technical Sans',
} as const;

function isSessionError(error: unknown): boolean {
  return (
    error instanceof AdminApiError &&
    (error.status === 401 || error.code === 'SESSION_INVALID')
  );
}

function normalizeAccent(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/u.test(normalized) ? normalized : null;
}

export function ThemeCenterView({ onSessionExpired }: ThemeCenterViewProps) {
  const [presets, setPresets] = useState<ThemePreset[]>([]);
  const [currentTheme, setCurrentTheme] = useState<ResolvedTheme | null>(null);
  const [selectedKey, setSelectedKey] = useState<ThemeKey>('marketplace');
  const [accent, setAccent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const selectedPreset = useMemo<ResolvedTheme | ThemePreset | null>(() => {
    if (selectedKey === 'custom') {
      return currentTheme?.key === 'custom' ? currentTheme : null;
    }
    return presets.find((preset) => preset.key === selectedKey) ?? null;
  }, [currentTheme, presets, selectedKey]);

  const themeIsDirty = Boolean(
    currentTheme &&
    (selectedKey !== currentTheme.key ||
      accent.trim().toLowerCase() !== (currentTheme.overrides.accent ?? '')),
  );
  useAdminDirtySource('theme-center', '主题中心', themeIsDirty);

  const loadThemeCenter = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const data = await fetchThemeCenter();
      setPresets(data.presets);
      setCurrentTheme(data.theme);
      setSelectedKey(data.theme.key);
      setAccent(data.theme.overrides.accent ?? '');
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : '主题中心加载失败。');
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    void loadThemeCenter();
  }, [loadThemeCenter]);

  function clearMessages() {
    setErrorMessage('');
    setSuccessMessage('');
  }

  function selectOfficialTheme(preset: ThemePreset) {
    setSelectedKey(preset.key);
    setAccent('');
    clearMessages();
  }

  function restoreSavedTheme() {
    if (!currentTheme) return;
    setSelectedKey(currentTheme.key);
    setAccent(currentTheme.overrides.accent ?? '');
    clearMessages();
  }

  async function saveTheme() {
    if (saving || !selectedPreset || !themeIsDirty) return;
    const normalizedAccent = accent.trim() ? normalizeAccent(accent) : null;
    if (accent.trim() && !normalizedAccent) {
      setErrorMessage('品牌强调色请输入 6 位十六进制颜色，例如 #e3486d。');
      return;
    }

    setSaving(true);
    clearMessages();
    try {
      const updated = await updateThemeCenter(
        selectedKey,
        normalizedAccent,
        selectedKey === 'custom' ? currentTheme?.overrides.imported : undefined,
      );
      setCurrentTheme(updated);
      setSelectedKey(updated.key);
      setAccent(updated.overrides.accent ?? '');
      setSuccessMessage('主题已保存并应用。用户前端刷新后即可看到新视觉。');
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : '主题保存失败。');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="theme-center">
        <div className="theme-center-state">正在读取主题…</div>
      </section>
    );
  }

  if (!currentTheme || presets.length === 0) {
    return (
      <section className="theme-center">
        <div className="settings-card settings-error-state" role="alert">
          <strong>无法读取主题中心</strong>
          <p>{errorMessage || '主题配置返回数据不完整，请重新加载。'}</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void loadThemeCenter()}
          >
            重新加载
          </button>
        </div>
      </section>
    );
  }

  const previewAccent =
    normalizeAccent(accent) ?? selectedPreset?.tokens.brand ?? '#e3486d';
  const colorInputValue =
    normalizeAccent(accent) ??
    normalizeAccent(selectedPreset?.tokens.brand ?? '') ??
    '#e3486d';
  const brandContrast = selectedPreset
    ? storefrontBrandContrast(previewAccent, selectedPreset.colorScheme)
    : null;

  return (
    <section className="theme-center" aria-labelledby="theme-center-title">
      <header className="theme-center-heading">
        <div className="theme-center-heading-copy">
          <p>用户前端视觉系统</p>
          <h2 id="theme-center-title">主题中心</h2>
          <span>选择一套完整视觉方案，只保留品牌强调色作为安全调整项。</span>
        </div>
        <div className="theme-center-current">
          <small>当前已应用</small>
          <strong>{currentTheme.label}</strong>
        </div>
        <div className="theme-center-actions">
          {themeIsDirty ? (
            <span className="theme-unsaved-pill">待保存</span>
          ) : (
            <span className="theme-saved-pill">已保存</span>
          )}
          <button
            className="secondary-button"
            type="button"
            disabled={!themeIsDirty || saving}
            onClick={restoreSavedTheme}
          >
            恢复当前设置
          </button>
          <a className="secondary-button" href="/" target="_blank" rel="noreferrer">
            打开用户前端
          </a>
          <button
            className="primary-button theme-save-button"
            type="button"
            disabled={saving || !themeIsDirty}
            onClick={() => void saveTheme()}
          >
            {saving ? '正在保存…' : themeIsDirty ? '保存并应用' : '已保存'}
          </button>
        </div>
      </header>

      {errorMessage ? (
        <div className="notice notice-error" role="alert">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="notice notice-success" role="status">
          {successMessage}
        </div>
      ) : null}

      <div className="theme-center-surface">
        <div className="theme-section-title">
          <strong>官方精选</strong>
          <span>
            每套主题包含固定字体、按钮、素材、动效与导航方案，避免组合后互相打架。
          </span>
        </div>

        <div className="theme-preset-grid">
          {presets.map((preset) => (
            <button
              className={`theme-preset-card${selectedKey === preset.key ? ' is-selected' : ''}`}
              type="button"
              key={preset.key}
              aria-pressed={selectedKey === preset.key}
              onClick={() => selectOfficialTheme(preset)}
            >
              <span
                className="theme-preset-swatch"
                style={{
                  color: preset.tokens.text,
                  background: `radial-gradient(circle at 78% 12%, color-mix(in srgb, ${preset.tokens.heroGlow} 44%, transparent), transparent 52%), linear-gradient(145deg, ${preset.tokens.heroStart}, ${preset.tokens.pageBg} 58%, ${preset.tokens.heroEnd})`,
                }}
              >
                <span className="theme-preset-swatch-bar" />
                <span className="theme-preset-swatch-content">
                  <i style={{ background: preset.tokens.surface }} />
                  <i style={{ background: preset.tokens.surfaceSoft }} />
                  <b style={{ background: preset.tokens.brand }} />
                </span>
              </span>
              <span className="theme-preset-copy">
                <span className="theme-preset-title">
                  <strong>{preset.label}</strong>
                  {selectedKey === preset.key ? <em>已选择</em> : null}
                </span>
                <small>{preset.description}</small>
                <span className="theme-preset-meta">
                  {preset.colorScheme === 'dark' ? '深色' : '浅色'} ·{' '}
                  {FONT_PACK_LABELS[preset.recipe.fontPack]} ·{' '}
                  {preset.recipe.motionStyle === 'restrained'
                    ? '克制动效'
                    : preset.recipe.motionStyle === 'gentle'
                      ? '柔和动效'
                      : '活跃动效'}
                </span>
              </span>
            </button>
          ))}
        </div>

        {currentTheme.key === 'custom' ? (
          <button
            className={`theme-preset-card theme-custom-current${selectedKey === 'custom' ? ' is-selected' : ''}`}
            type="button"
            aria-pressed={selectedKey === 'custom'}
            onClick={() => {
              setSelectedKey('custom');
              setAccent(currentTheme.overrides.accent ?? '');
              clearMessages();
            }}
          >
            <span
              className="theme-preset-swatch"
              style={{
                color: currentTheme.tokens.text,
                background: `radial-gradient(circle at 78% 12%, color-mix(in srgb, ${currentTheme.tokens.heroGlow} 44%, transparent), transparent 52%), linear-gradient(145deg, ${currentTheme.tokens.heroStart}, ${currentTheme.tokens.pageBg} 58%, ${currentTheme.tokens.heroEnd})`,
              }}
            />
            <span className="theme-preset-copy">
              <strong>{currentTheme.label}</strong>
              <small>当前保留的外部主题。选择官方主题并保存后将替换它。</small>
            </span>
          </button>
        ) : null}
      </div>

      {selectedPreset ? (
        <div className="theme-center-surface theme-accent-surface">
          <div className="theme-accent-copy">
            <span>当前草稿</span>
            <strong>{selectedPreset.label}</strong>
            <p>
              整套视觉方案由主题中心统一维护。这里只调整品牌强调色，不会破坏页面层级、字体和交互质感。
            </p>
          </div>

          <label className="theme-accent-field">
            <span>品牌强调色</span>
            <div>
              <input
                type="color"
                value={colorInputValue}
                onChange={(event) => {
                  setAccent(event.target.value.toLowerCase());
                  clearMessages();
                }}
                aria-label="选择品牌强调色"
              />
              <input
                type="text"
                value={accent}
                placeholder={selectedPreset.tokens.brand}
                maxLength={7}
                onChange={(event) => {
                  setAccent(event.target.value);
                  clearMessages();
                }}
              />
              {accent ? (
                <button
                  type="button"
                  onClick={() => {
                    setAccent('');
                    clearMessages();
                  }}
                >
                  恢复主题色
                </button>
              ) : null}
            </div>
          </label>

          <div
            className="theme-accent-status"
            data-status={
              brandContrast?.ratio === null || (brandContrast?.ratio ?? 0) >= 4.5
                ? 'pass'
                : 'warning'
            }
          >
            <i style={{ background: previewAccent }} aria-hidden="true" />
            <span>
              {brandContrast === null || brandContrast.ratio === null
                ? '按钮文字会按主题明暗自动匹配'
                : `按钮文字对比度 ${brandContrast.ratio.toFixed(1)}:1 · AA`}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
