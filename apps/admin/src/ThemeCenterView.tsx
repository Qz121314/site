import { useEffect, useMemo, useState, type CSSProperties } from 'react';
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

function isSessionError(error: unknown): boolean {
  return error instanceof AdminApiError && (error.status === 401 || error.code === 'SESSION_INVALID');
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

  const themeIsDirty = currentTheme !== null && (
    selectedKey !== currentTheme.key ||
    accent.trim().toLowerCase() !== (currentTheme.overrides.accent ?? '').toLowerCase()
  );
  useAdminDirtySource('theme-center', '主题中心', themeIsDirty);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchThemeCenter();
        if (!active) return;
        setPresets(data.presets);
        setCurrentTheme(data.theme);
        setSelectedKey(data.theme.key);
        setAccent(data.theme.overrides.accent ?? '');
      } catch (error) {
        if (!active) return;
        if (isSessionError(error)) {
          onSessionExpired();
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : '主题中心加载失败。');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [onSessionExpired]);

  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.key === selectedKey) ?? presets[0] ?? null,
    [presets, selectedKey],
  );
  const previewAccent = normalizeAccent(accent) ?? selectedPreset?.tokens.brand ?? '#ff5a1f';

  async function saveTheme() {
    if (saving || !selectedPreset || !themeIsDirty) return;
    const normalizedAccent = accent.trim() ? normalizeAccent(accent) : null;
    if (accent.trim() && !normalizedAccent) {
      setErrorMessage('品牌强调色请输入 6 位十六进制颜色，例如 #ff5a1f。');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const updated = await updateThemeCenter(selectedKey, normalizedAccent);
      setCurrentTheme(updated);
      setSelectedKey(updated.key);
      setAccent(updated.overrides.accent ?? '');
      setSuccessMessage('主题已保存并应用到用户前端。前端刷新后即可看到新主题。');
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
    return <section className="theme-center"><div className="theme-center-state">正在读取主题…</div></section>;
  }

  return (
    <section className="theme-center" aria-labelledby="theme-center-title">
      <div className="theme-center-heading">
        <div className="theme-center-heading-copy">
          <p>用户前端视觉系统</p>
          <h2 id="theme-center-title">主题中心</h2>
          <span>以移动端为主要设计基准；PC 端作为响应式扩展。产品列表默认双列并使用 1:1 方形封面。</span>
        </div>

        <div className="theme-mobile-baseline" aria-label="主题设计基准">
          <strong>移动端优先</strong>
          <span>双列 1:1 · 触控操作 · 底部导航</span>
        </div>

        <div className="theme-center-actions">
          <div className="theme-center-current">
            <small>当前已保存主题</small>
            <strong>{currentTheme?.label ?? '未配置'}</strong>
          </div>
          <button
            className="primary-button theme-save-button"
            type="button"
            disabled={saving || !selectedPreset || !themeIsDirty}
            onClick={() => void saveTheme()}
          >
            {saving ? '正在保存…' : themeIsDirty ? '保存并应用' : '已保存'}
          </button>
        </div>
      </div>

      {errorMessage ? <div className="notice notice-error" role="alert">{errorMessage}</div> : null}
      {successMessage ? <div className="notice notice-success" role="status">{successMessage}</div> : null}

      <div className="theme-center-layout">
        <div className="theme-preset-panel">
          <div className="theme-section-title">
            <strong>主题预设</strong>
            <span>选择后先在右侧查看手机端效果，再保存应用到前端。</span>
          </div>
          <div className="theme-preset-grid">
            {presets.map((preset) => (
              <button
                className={`theme-preset-card${selectedKey === preset.key ? ' is-selected' : ''}`}
                type="button"
                key={preset.key}
                onClick={() => {
                  setSelectedKey(preset.key);
                  setAccent('');
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
              >
                <span
                  className="theme-preset-swatch"
                  style={{
                    background: `linear-gradient(135deg, ${preset.tokens.heroStart}, ${preset.tokens.heroEnd})`,
                  }}
                >
                  <i style={{ background: preset.tokens.brand }} />
                  <i style={{ background: preset.tokens.surface }} />
                  <i style={{ background: preset.tokens.pageBg }} />
                </span>
                <span className="theme-preset-copy">
                  <strong>{preset.label}</strong>
                  <small>{preset.description}</small>
                  <em>{preset.colorScheme === 'dark' ? '深色' : '浅色'} · 移动端双列 1:1</em>
                </span>
              </button>
            ))}
          </div>
        </div>

        <aside className="theme-preview-panel">
          <div className="theme-preview-panel-heading">
            <div className="theme-section-title">
              <strong>移动端实时预览</strong>
              <span>模拟用户主要访问场景；品牌色可选，留空使用预设色。</span>
            </div>
            {themeIsDirty ? <span className="theme-unsaved-pill">待保存</span> : <span className="theme-saved-pill">已保存</span>}
          </div>

          <label className="theme-accent-field">
            <span>品牌强调色</span>
            <div>
              <input
                type="color"
                value={previewAccent}
                onChange={(event) => setAccent(event.target.value.toLowerCase())}
                aria-label="选择品牌强调色"
              />
              <input
                type="text"
                value={accent}
                placeholder={selectedPreset?.tokens.brand ?? '#ff5a1f'}
                maxLength={7}
                onChange={(event) => setAccent(event.target.value)}
              />
              {accent ? <button type="button" onClick={() => setAccent('')}>恢复预设</button> : null}
            </div>
          </label>

          {selectedPreset ? (
            <div className="theme-preview-device-shell">
              <div
                className={`theme-live-preview is-${selectedPreset.colorScheme}`}
                style={{
                  '--preview-brand': previewAccent,
                  '--preview-text': selectedPreset.tokens.text,
                  '--preview-muted': selectedPreset.tokens.muted,
                  '--preview-surface': selectedPreset.tokens.surface,
                  '--preview-page': selectedPreset.tokens.pageBg,
                  '--preview-line': selectedPreset.tokens.line,
                  '--preview-hero-start': selectedPreset.tokens.heroStart,
                  '--preview-hero-end': selectedPreset.tokens.heroEnd,
                } as CSSProperties}
              >
                <div className="theme-preview-statusbar" aria-hidden="true">
                  <span>9:41</span><span>● ● ▰</span>
                </div>
                <div className="theme-preview-appbar">
                  <span className="theme-preview-logo">S</span>
                  <div>
                    <strong>Service</strong>
                    <small>Explore nearby</small>
                  </div>
                  <span className="theme-preview-app-action">•••</span>
                </div>
                <div className="theme-preview-hero">
                  <span>{selectedPreset.label}</span>
                  <strong>Discover what fits you</strong>
                  <small>Fast browsing designed for one-hand mobile use.</small>
                </div>
                <div className="theme-preview-chips" aria-hidden="true">
                  <span className="is-active">For you</span><span>Popular</span><span>Nearby</span>
                </div>
                <div className="theme-preview-section-row">
                  <strong>Featured</strong><span>See all</span>
                </div>
                <div className="theme-preview-products">
                  {[1, 2].map((item) => (
                    <div className="theme-preview-product" key={item}>
                      <div className="theme-preview-media"><span>1:1</span></div>
                      <strong>{item === 1 ? 'Product title' : 'Featured item'}</strong>
                      <small>Category · Tag</small>
                      <button type="button" tabIndex={-1}>View</button>
                    </div>
                  ))}
                </div>
                <div className="theme-preview-bottom-nav" aria-hidden="true">
                  <span className="is-active">⌂<small>Home</small></span>
                  <span>▦<small>Browse</small></span>
                  <span>♡<small>Saved</small></span>
                  <span>●<small>More</small></span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="theme-ratio-note">
            <strong>移动端是主题验收基准</strong>
            <p>优先检查手机双列卡片、文字可读性、触控按钮和底部导航。PC 只做响应式扩展。Logo、Hero、正文图片和视频仍保留各自合适比例。</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
