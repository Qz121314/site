import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminApiError } from './api';
import { useAdminDirtySource } from './admin-unsaved-state';
import {
  AdminSegmentedControl,
  AdminSegmentedItem,
} from './components/ui/segmented-control';
import { ThemeCenterPreview } from './ThemeCenterPreview';
import { themeDiagnostics } from './theme-center/diagnostics';
import {
  fetchThemeCenter,
  importThemeFromJson,
  importThemeFromRegistry,
  updateThemeCenter,
  type ImportedThemeDefinition,
  type ResolvedTheme,
  type ThemeKey,
  type ThemePreset,
} from './theme-center/api';

type ThemeCenterViewProps = {
  onSessionExpired: () => void;
};
type ThemeImportSource = 'url' | 'json';
const FONT_PACK_LABELS = {
  modern: 'Modern Sans',
  editorial: 'Soft Editorial',
  compact: 'Compact UI',
  technical: 'Technical Sans',
} as const;
const MOTION_LABELS = { restrained: '克制', gentle: '柔和', active: '活跃' } as const;
const READ_ONLY_METADATA = [
  [
    'Color Mode',
    (theme: ThemePreset) => (theme.colorScheme === 'dark' ? 'Dark' : 'Light'),
  ],
  ['Font Pack', (theme: ThemePreset) => FONT_PACK_LABELS[theme.recipe.fontPack]],
  ['Button Style', (theme: ThemePreset) => theme.recipe.buttonStyle],
  ['Media Style', (theme: ThemePreset) => theme.recipe.mediaStyle],
  ['Motion Style', (theme: ThemePreset) => MOTION_LABELS[theme.recipe.motionStyle]],
  ['Navigation Style', (theme: ThemePreset) => theme.recipe.navigationStyle],
  ['Density', (theme: ThemePreset) => theme.density],
] as const;
function isSessionError(error: unknown) {
  return (
    error instanceof AdminApiError &&
    (error.status === 401 || error.code === 'SESSION_INVALID')
  );
}
function normalizeHexColor(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/u.test(normalized) ? normalized : null;
}
function ThemeSwatch({ theme }: { theme: ThemePreset }) {
  return (
    <span
      className="theme-library-swatch"
      style={{
        color: theme.tokens.text,
        background: `linear-gradient(145deg, ${theme.tokens.heroStart}, ${theme.tokens.pageBg} 58%, ${theme.tokens.heroEnd})`,
      }}
      aria-hidden="true"
    >
      <i style={{ background: theme.tokens.surface }} />
      <i style={{ background: theme.tokens.brand }} />
    </span>
  );
}

export function ThemeCenterView({ onSessionExpired }: ThemeCenterViewProps) {
  const [presets, setPresets] = useState<ThemePreset[]>([]);
  const [currentTheme, setCurrentTheme] = useState<ResolvedTheme | null>(null);
  const [selectedKey, setSelectedKey] = useState<ThemeKey>('marketplace');
  const [accent, setAccent] = useState('');
  const [textColor, setTextColor] = useState('');
  const [importedDraft, setImportedDraft] = useState<
    ImportedThemeDefinition | undefined
  >();
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [previewRevision, setPreviewRevision] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importSource, setImportSource] = useState<ThemeImportSource>('url');
  const [importMode, setImportMode] = useState<'light' | 'dark'>('light');
  const [importValue, setImportValue] = useState('');
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const selectedPreset = useMemo<ResolvedTheme | ThemePreset | null>(
    () =>
      selectedKey === 'custom'
        ? importedDraft
          ? ({
              ...(currentTheme?.key === 'custom' ? currentTheme : presets[0]),
              key: 'custom',
              label: importedDraft.label,
              description: importedDraft.description,
              colorScheme: importedDraft.colorScheme,
              tokens: importedDraft.tokens,
            } as ResolvedTheme)
          : currentTheme?.key === 'custom'
            ? currentTheme
            : null
        : (presets.find((preset) => preset.key === selectedKey) ?? null),
    [currentTheme, importedDraft, presets, selectedKey],
  );
  const themeIsDirty = Boolean(
    currentTheme &&
    (selectedKey !== currentTheme.key ||
      accent.trim().toLowerCase() !== (currentTheme.overrides.accent ?? '') ||
      textColor.trim().toLowerCase() !== (currentTheme.overrides.textColor ?? '') ||
      JSON.stringify(importedDraft ?? null) !==
        JSON.stringify(currentTheme.overrides.imported ?? null)),
  );
  useAdminDirtySource('theme-center', 'Theme Studio', themeIsDirty);
  const loadThemeCenter = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const data = await fetchThemeCenter();
      setPresets(data.presets);
      setCurrentTheme(data.theme);
      setSelectedKey(data.theme.key);
      setAccent(data.theme.overrides.accent ?? '');
      setTextColor(data.theme.overrides.textColor ?? '');
      setImportedDraft(data.theme.overrides.imported);
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
  function selectTheme(theme: ThemePreset) {
    setSelectedKey(theme.key);
    setAccent('');
    setTextColor('');
    setImportedDraft(undefined);
    clearMessages();
  }
  function restoreSavedTheme() {
    if (!currentTheme) return;
    setSelectedKey(currentTheme.key);
    setAccent(currentTheme.overrides.accent ?? '');
    setTextColor(currentTheme.overrides.textColor ?? '');
    setImportedDraft(currentTheme.overrides.imported);
    clearMessages();
  }
  async function saveTheme() {
    if (saving || !selectedPreset || !themeIsDirty) return;
    const normalizedAccent = accent.trim() ? normalizeHexColor(accent) : null;
    const normalizedTextColor = textColor.trim() ? normalizeHexColor(textColor) : null;
    if (accent.trim() && !normalizedAccent) {
      setErrorMessage('品牌强调色请输入 6 位十六进制颜色，例如 #e3486d。');
      return;
    }
    if (textColor.trim() && !normalizedTextColor) {
      setErrorMessage('主文字颜色请输入 6 位十六进制颜色，例如 #f6f0f3。');
      return;
    }
    setSaving(true);
    clearMessages();
    try {
      const updated = await updateThemeCenter(
        selectedKey,
        normalizedAccent,
        normalizedTextColor,
        selectedKey === 'custom' ? importedDraft : undefined,
      );
      setCurrentTheme(updated);
      setSelectedKey(updated.key);
      setAccent(updated.overrides.accent ?? '');
      setTextColor(updated.overrides.textColor ?? '');
      setImportedDraft(updated.overrides.imported);
      setSuccessMessage('主题已保存并应用。');
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
  async function importTheme() {
    if (importing || !importValue.trim()) return;
    setImporting(true);
    clearMessages();
    try {
      const imported =
        importSource === 'url'
          ? await importThemeFromRegistry(importValue.trim(), importMode)
          : await importThemeFromJson(importValue, importMode);
      if (!imported.overrides.imported) {
        throw new Error('导入主题未返回可用的视觉 Token。');
      }
      setImportedDraft(imported.overrides.imported);
      setSelectedKey('custom');
      setAccent('');
      setTextColor('');
      setImportOpen(false);
      setImportValue('');
      setSuccessMessage('主题已导入到草稿预览；保存后才会应用到用户前端。');
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : '主题导入失败。');
    } finally {
      setImporting(false);
    }
  }
  if (loading)
    return (
      <section className="theme-center">
        <div className="theme-center-state">正在读取 Theme Studio…</div>
      </section>
    );
  if (!currentTheme || presets.length === 0)
    return (
      <section className="theme-center">
        <div className="settings-card settings-error-state" role="alert">
          <strong>无法读取 Theme Studio</strong>
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
  const previewAccent = normalizeHexColor(accent);
  const previewTextColor = normalizeHexColor(textColor);
  const accentInputValue =
    previewAccent ?? normalizeHexColor(selectedPreset?.tokens.brand ?? '') ?? '#e3486d';
  const textColorInputValue =
    previewTextColor ?? normalizeHexColor(selectedPreset?.tokens.text ?? '') ?? '#ffffff';
  const diagnostics = selectedPreset
    ? themeDiagnostics(selectedPreset, previewAccent, previewTextColor)
    : [];
  const libraryThemes =
    currentTheme.key === 'custom' ? [currentTheme, ...presets] : presets;
  return (
    <section className="theme-center theme-studio" aria-labelledby="theme-center-title">
      <header className="theme-studio-heading">
        <div>
          <p>站点 / 主题</p>
          <h2 id="theme-center-title">站点设计</h2>
          <span>在草稿中调整前端视觉；保存后才会应用到用户前端。</span>
        </div>
        <div className="theme-studio-heading-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => setImportOpen(true)}
          >
            导入主题
          </button>
          <button
            className="secondary-button theme-studio-panel-toggle"
            type="button"
            aria-expanded={libraryOpen}
            onClick={() => setLibraryOpen((value) => !value)}
          >
            主题库
          </button>
          <button
            className="secondary-button theme-studio-panel-toggle"
            type="button"
            aria-expanded={inspectorOpen}
            onClick={() => setInspectorOpen((value) => !value)}
          >
            检查器
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
      <div className="theme-studio-workspace">
        <aside className="theme-library" data-open={libraryOpen}>
          <div className="theme-studio-pane-heading">
            <div>
              <span>Theme Library</span>
              <strong>主题方案库</strong>
            </div>
            <small>{libraryThemes.length} 个可用方案</small>
          </div>
          <div className="theme-library-list">
            {libraryThemes.map((theme) => (
              <button
                className={`theme-library-item${selectedKey === theme.key ? ' is-selected' : ''}`}
                key={theme.key}
                type="button"
                aria-pressed={selectedKey === theme.key}
                onClick={() => {
                  if (theme.key === 'custom') {
                    setSelectedKey('custom');
                    setAccent(currentTheme.overrides.accent ?? '');
                    setTextColor(currentTheme.overrides.textColor ?? '');
                  } else selectTheme(theme);
                  clearMessages();
                }}
              >
                <ThemeSwatch theme={theme} />
                <span className="theme-library-copy">
                  <span>
                    <strong>{theme.label}</strong>
                    {currentTheme.key === theme.key ? <em>当前使用</em> : null}
                  </span>
                  <small>
                    {theme.colorScheme === 'dark' ? 'Dark' : 'Light'} ·{' '}
                    {FONT_PACK_LABELS[theme.recipe.fontPack]} ·{' '}
                    {MOTION_LABELS[theme.recipe.motionStyle]}
                  </small>
                </span>
                <i className="theme-library-selection" aria-hidden="true" />
              </button>
            ))}
          </div>
        </aside>
        <main className="theme-live-preview">
          <div className="theme-studio-pane-heading">
            <div>
              <span>Live Storefront Preview</span>
              <strong>实时用户前端预览</strong>
            </div>
            <div className="theme-preview-toolbar" role="group" aria-label="预览控制">
              <button
                type="button"
                aria-pressed={viewport === 'desktop'}
                onClick={() => setViewport('desktop')}
              >
                Desktop
              </button>
              <button
                type="button"
                aria-pressed={viewport === 'mobile'}
                onClick={() => setViewport('mobile')}
              >
                Mobile
              </button>
              <span>100%</span>
              <button
                type="button"
                onClick={() => setPreviewRevision((value) => value + 1)}
              >
                Refresh
              </button>
            </div>
          </div>
          {selectedPreset ? (
            <ThemeCenterPreview
              key={`${selectedPreset.key}-${previewRevision}`}
              accent={previewAccent}
              textColor={previewTextColor}
              theme={selectedPreset}
              viewport={viewport}
            />
          ) : null}
        </main>
        <aside className="theme-inspector" data-open={inspectorOpen}>
          <div className="theme-studio-pane-heading">
            <div>
              <span>Theme Inspector</span>
              <strong>主题检查器</strong>
            </div>
            <small>草稿编辑</small>
          </div>
          {selectedPreset ? (
            <>
              <div className="theme-inspector-section">
                <div className="theme-inspector-label">
                  <strong>安全 Override</strong>
                  <span>可保存</span>
                </div>
                <label>
                  品牌强调色
                  <div className="theme-color-control">
                    <input
                      type="color"
                      value={accentInputValue}
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
                      <button type="button" onClick={() => setAccent('')}>
                        恢复
                      </button>
                    ) : null}
                  </div>
                </label>
                <label>
                  主文字颜色
                  <div className="theme-color-control">
                    <input
                      type="color"
                      value={textColorInputValue}
                      onChange={(event) => {
                        setTextColor(event.target.value.toLowerCase());
                        clearMessages();
                      }}
                      aria-label="选择主文字颜色"
                    />
                    <input
                      type="text"
                      value={textColor}
                      placeholder={selectedPreset.tokens.text}
                      maxLength={7}
                      onChange={(event) => {
                        setTextColor(event.target.value);
                        clearMessages();
                      }}
                    />
                    {textColor ? (
                      <button type="button" onClick={() => setTextColor('')}>
                        恢复
                      </button>
                    ) : null}
                  </div>
                </label>
              </div>
              <div className="theme-inspector-section">
                <div className="theme-inspector-label">
                  <strong>Theme metadata</strong>
                  <span>只读</span>
                </div>
                <dl className="theme-metadata">
                  {READ_ONLY_METADATA.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value(selectedPreset)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div
                className="theme-inspector-section theme-diagnostics"
                aria-label="视觉检查"
              >
                <div className="theme-inspector-label">
                  <strong>Visual Diagnostics</strong>
                  <span>实时</span>
                </div>
                <div className="theme-diagnostic-list">
                  {diagnostics.map((diagnostic) => (
                    <div
                      className="theme-diagnostic-item"
                      data-status={diagnostic.status}
                      key={diagnostic.id}
                    >
                      <span className="theme-diagnostic-mark" aria-hidden="true">
                        {diagnostic.status === 'pass' ? '✓' : '!'}
                      </span>
                      <span>
                        <strong>
                          {diagnostic.label === '文字 / 背景'
                            ? '主要文字对比度'
                            : diagnostic.label === 'Surface 层级'
                              ? 'Product Card 层级'
                              : diagnostic.label === '边框可见性'
                                ? '导航可读性'
                                : diagnostic.label}
                        </strong>
                        <small>{diagnostic.detail}</small>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </aside>
      </div>
      <footer className="theme-action-bar">
        <div>
          <span>当前主题</span>
          <strong>{currentTheme.label}</strong>
          <em data-dirty={themeIsDirty}>{themeIsDirty ? '未保存' : '已保存'}</em>
        </div>
        <div>
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
            className="primary-button"
            type="button"
            disabled={saving || !themeIsDirty}
            onClick={() => void saveTheme()}
          >
            {saving ? '正在保存…' : '保存并应用'}
          </button>
        </div>
      </footer>
      {importOpen ? (
        <div
          className="theme-import-backdrop"
          role="presentation"
          onMouseDown={() => !importing && setImportOpen(false)}
        >
          <section
            className="theme-import-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="theme-import-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div>
              <span>Theme Import</span>
              <h3 id="theme-import-title">导入 shadcn 主题</h3>
            </div>
            <AdminSegmentedControl ariaLabel="导入方式">
              <AdminSegmentedItem
                selected={importSource === 'url'}
                type="button"
                onClick={() => setImportSource('url')}
              >
                主题地址
              </AdminSegmentedItem>
              <AdminSegmentedItem
                selected={importSource === 'json'}
                type="button"
                onClick={() => setImportSource('json')}
              >
                主题 JSON
              </AdminSegmentedItem>
            </AdminSegmentedControl>
            <label>
              {importSource === 'url'
                ? '公开 HTTPS Registry 地址'
                : 'registry:theme 或完整 Theme Tokens JSON'}
              {importSource === 'url' ? (
                <input
                  value={importValue}
                  onChange={(event) => setImportValue(event.target.value)}
                  placeholder="https://…/theme.json"
                  autoFocus
                />
              ) : (
                <textarea
                  value={importValue}
                  onChange={(event) => setImportValue(event.target.value)}
                  placeholder="{ … }"
                  autoFocus
                />
              )}
            </label>
            <label>
              导入模式
              <select
                value={importMode}
                onChange={(event) =>
                  setImportMode(event.target.value as 'light' | 'dark')
                }
              >
                <option value="light">浅色</option>
                <option value="dark">深色</option>
              </select>
            </label>
            <div className="theme-import-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={importing}
                onClick={() => setImportOpen(false)}
              >
                取消
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={importing || !importValue.trim()}
                onClick={() => void importTheme()}
              >
                {importing ? '正在导入…' : '导入到预览'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
