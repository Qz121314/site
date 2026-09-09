import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AdminApiError } from './api';
import { useAdminDirtySource } from './admin-unsaved-state';
import {
  AdminSegmentedControl,
  AdminSegmentedItem,
} from './components/ui/segmented-control';
import { Button } from './components/ui/button';
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
  type ThemeVisualOverrides,
} from './theme-center/api';

type ThemeCenterViewProps = {
  onSessionExpired: () => void;
  onActionsChange: (actions: ReactNode | null) => void;
};
type ThemeImportSource = 'url' | 'json';
type PreviewViewport = 'desktop' | 'mobile';
type PreviewSize = { width: number; height: number };
const PREVIEW_PRESETS: Record<
  PreviewViewport,
  readonly { label: string; size: PreviewSize }[]
> = {
  desktop: [
    { label: '1440 × 900', size: { width: 1440, height: 900 } },
    { label: '1280 × 800', size: { width: 1280, height: 800 } },
    { label: '1024 × 768', size: { width: 1024, height: 768 } },
  ],
  mobile: [
    { label: 'iPhone 15 · 393 × 852', size: { width: 393, height: 852 } },
    { label: 'Pixel 8 · 412 × 915', size: { width: 412, height: 915 } },
    { label: 'iPhone SE · 375 × 667', size: { width: 375, height: 667 } },
  ],
};
const FONT_PACK_LABELS = {
  modern: 'Modern Sans',
  editorial: 'Soft Editorial',
  compact: 'Compact UI',
  technical: 'Technical Sans',
} as const;
const VISUAL_RULE_OPTIONS = {
  density: [
    ['compact', '紧凑'],
    ['standard', '标准'],
    ['comfortable', '舒展'],
  ],
  fontPack: [
    ['modern', '现代无衬线'],
    ['editorial', '柔和编辑'],
    ['compact', '紧凑界面'],
    ['technical', '技术感'],
  ],
  buttonStyle: [
    ['refined', '精致'],
    ['minimal', '极简'],
    ['soft-pill', '柔和圆角'],
  ],
  mediaStyle: [
    ['precise', '规整'],
    ['soft', '柔和'],
    ['editorial', '编辑感'],
  ],
  motionStyle: [
    ['restrained', '克制'],
    ['gentle', '柔和'],
    ['active', '活跃'],
  ],
  navigationStyle: [
    ['quiet', '安静'],
    ['tinted', '轻着色'],
    ['solid', '实色'],
  ],
} as const;
function visualOverridesFor(theme: ThemePreset): Required<ThemeVisualOverrides> {
  return {
    density: theme.density,
    fontPack: theme.recipe.fontPack,
    buttonStyle: theme.recipe.buttonStyle,
    mediaStyle: theme.recipe.mediaStyle,
    motionStyle: theme.recipe.motionStyle,
    navigationStyle: theme.recipe.navigationStyle,
  };
}
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

export function ThemeCenterView({
  onSessionExpired,
  onActionsChange,
}: ThemeCenterViewProps) {
  const [presets, setPresets] = useState<ThemePreset[]>([]);
  const [currentTheme, setCurrentTheme] = useState<ResolvedTheme | null>(null);
  const [selectedKey, setSelectedKey] = useState<ThemeKey>('marketplace');
  const [accent, setAccent] = useState('');
  const [textColor, setTextColor] = useState('');
  const [importedDraft, setImportedDraft] = useState<
    ImportedThemeDefinition | undefined
  >();
  const [visualOverrides, setVisualOverrides] = useState<Required<ThemeVisualOverrides>>({
    density: 'standard',
    fontPack: 'modern',
    buttonStyle: 'refined',
    mediaStyle: 'soft',
    motionStyle: 'restrained',
    navigationStyle: 'quiet',
  });
  const [viewport, setViewport] = useState<PreviewViewport>('desktop');
  const [previewPreset, setPreviewPreset] = useState('1440 × 900');
  const [previewSize, setPreviewSize] = useState<PreviewSize>({
    width: 1440,
    height: 900,
  });
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importSource, setImportSource] = useState<ThemeImportSource>('url');
  const [importMode, setImportMode] = useState<'light' | 'dark'>('light');
  const themeActionsRef = useRef<{ save: () => void; restore: () => void }>({
    save: () => undefined,
    restore: () => undefined,
  });
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
        JSON.stringify(currentTheme.overrides.imported ?? null) ||
      JSON.stringify(visualOverrides) !==
        JSON.stringify(visualOverridesFor(currentTheme))),
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
      setVisualOverrides(visualOverridesFor(data.theme));
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
    setVisualOverrides(visualOverridesFor(theme));
    clearMessages();
  }
  function restoreSavedTheme() {
    if (!currentTheme) return;
    setSelectedKey(currentTheme.key);
    setAccent(currentTheme.overrides.accent ?? '');
    setTextColor(currentTheme.overrides.textColor ?? '');
    setImportedDraft(currentTheme.overrides.imported);
    setVisualOverrides(visualOverridesFor(currentTheme));
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
        visualOverrides,
      );
      setCurrentTheme(updated);
      setSelectedKey(updated.key);
      setAccent(updated.overrides.accent ?? '');
      setTextColor(updated.overrides.textColor ?? '');
      setImportedDraft(updated.overrides.imported);
      setVisualOverrides(visualOverridesFor(updated));
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
  themeActionsRef.current = {
    save: () => void saveTheme(),
    restore: restoreSavedTheme,
  };
  useEffect(() => {
    onActionsChange(
      <div className="theme-global-actions">
        <Button
          variant="secondary"
          size="compact"
          type="button"
          disabled={!themeIsDirty || saving}
          onClick={() => themeActionsRef.current.restore()}
        >
          恢复修改
        </Button>
        <Button
          size="compact"
          type="button"
          disabled={saving || !themeIsDirty}
          onClick={() => themeActionsRef.current.save()}
        >
          {saving ? '正在保存…' : '保存主题'}
        </Button>
      </div>,
    );
    return () => onActionsChange(null);
  }, [onActionsChange, saving, themeIsDirty]);

  function selectViewport(nextViewport: PreviewViewport) {
    const defaultPreset = PREVIEW_PRESETS[nextViewport][0];
    if (!defaultPreset) return;
    setViewport(nextViewport);
    setPreviewPreset(defaultPreset.label);
    setPreviewSize(defaultPreset.size);
  }

  function selectPreviewPreset(value: string) {
    setPreviewPreset(value);
    const preset = PREVIEW_PRESETS[viewport].find((item) => item.label === value);
    if (preset) setPreviewSize(preset.size);
  }

  function updatePreviewSize(key: keyof PreviewSize, value: string) {
    const parsed = Number.parseInt(value, 10);
    setPreviewPreset('自定义尺寸');
    setPreviewSize((current) => ({
      ...current,
      [key]: Number.isFinite(parsed)
        ? Math.min(Math.max(parsed, 280), 2560)
        : current[key],
    }));
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
      setVisualOverrides(visualOverridesFor(imported));
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
  const hasDiagnosticWarning = diagnostics.some((item) => item.status === 'warning');
  const previewTheme = selectedPreset
    ? {
        ...selectedPreset,
        density: visualOverrides.density,
        recipe: { ...selectedPreset.recipe, ...visualOverrides },
      }
    : null;
  const libraryThemes =
    currentTheme.key === 'custom' ? [currentTheme, ...presets] : presets;
  return (
    <section className="theme-center theme-studio" aria-labelledby="theme-center-title">
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
        <aside className="theme-library">
          <div className="theme-studio-pane-heading">
            <div>
              <span>主题</span>
              <strong id="theme-center-title">主题库</strong>
            </div>
            <button
              className="theme-library-add"
              type="button"
              aria-label="上传主题"
              onClick={() => setImportOpen(true)}
            >
              上传主题
            </button>
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
                    {FONT_PACK_LABELS[theme.recipe.fontPack]}
                  </small>
                </span>
                <i className="theme-library-selection" aria-hidden="true" />
              </button>
            ))}
          </div>
        </aside>
        <main className="theme-live-preview">
          {previewTheme ? (
            <ThemeCenterPreview
              key={previewTheme.key}
              accent={previewAccent}
              textColor={previewTextColor}
              theme={previewTheme}
              viewport={viewport}
              previewSize={previewSize}
            />
          ) : null}
        </main>
        <aside className="theme-inspector">
          <div className="theme-studio-pane-heading">
            <div>
              <span>视觉系统</span>
              <strong>样式设置</strong>
            </div>
            <small>草稿编辑</small>
          </div>
          {selectedPreset ? (
            <>
              <div className="theme-inspector-section">
                <div className="theme-inspector-label">
                  <strong>预览</strong>
                </div>
                <AdminSegmentedControl ariaLabel="预览设备">
                  <AdminSegmentedItem
                    selected={viewport === 'desktop'}
                    type="button"
                    onClick={() => selectViewport('desktop')}
                  >
                    桌面
                  </AdminSegmentedItem>
                  <AdminSegmentedItem
                    selected={viewport === 'mobile'}
                    type="button"
                    onClick={() => selectViewport('mobile')}
                  >
                    移动端
                  </AdminSegmentedItem>
                </AdminSegmentedControl>
                <label>
                  {viewport === 'desktop' ? 'PC 模板' : '手机模板'}
                  <select
                    value={previewPreset}
                    onChange={(event) => selectPreviewPreset(event.target.value)}
                  >
                    {PREVIEW_PRESETS[viewport].map((preset) => (
                      <option key={preset.label} value={preset.label}>
                        {preset.label}
                      </option>
                    ))}
                    <option value="自定义尺寸">自定义尺寸</option>
                  </select>
                </label>
                <div className="theme-preview-size-inputs" aria-label="自定义预览尺寸">
                  <label>
                    宽
                    <input
                      type="number"
                      min="280"
                      max="2560"
                      value={previewSize.width}
                      onChange={(event) => updatePreviewSize('width', event.target.value)}
                    />
                  </label>
                  <span aria-hidden="true">×</span>
                  <label>
                    高
                    <input
                      type="number"
                      min="280"
                      max="2560"
                      value={previewSize.height}
                      onChange={(event) =>
                        updatePreviewSize('height', event.target.value)
                      }
                    />
                  </label>
                </div>
              </div>
              <div className="theme-inspector-section">
                <div className="theme-inspector-label">
                  <strong>外观</strong>
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
                  <strong>组件</strong>
                  <span>可保存</span>
                </div>
                <div className="theme-rule-grid">
                  <label>
                    页面密度
                    <select
                      value={visualOverrides.density}
                      onChange={(event) =>
                        setVisualOverrides((current) => ({
                          ...current,
                          density: event.target
                            .value as Required<ThemeVisualOverrides>['density'],
                        }))
                      }
                    >
                      {VISUAL_RULE_OPTIONS.density.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    字体体系
                    <select
                      value={visualOverrides.fontPack}
                      onChange={(event) =>
                        setVisualOverrides((current) => ({
                          ...current,
                          fontPack: event.target
                            .value as Required<ThemeVisualOverrides>['fontPack'],
                        }))
                      }
                    >
                      {VISUAL_RULE_OPTIONS.fontPack.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    按钮样式
                    <select
                      value={visualOverrides.buttonStyle}
                      onChange={(event) =>
                        setVisualOverrides((current) => ({
                          ...current,
                          buttonStyle: event.target
                            .value as Required<ThemeVisualOverrides>['buttonStyle'],
                        }))
                      }
                    >
                      {VISUAL_RULE_OPTIONS.buttonStyle.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    媒体呈现
                    <select
                      value={visualOverrides.mediaStyle}
                      onChange={(event) =>
                        setVisualOverrides((current) => ({
                          ...current,
                          mediaStyle: event.target
                            .value as Required<ThemeVisualOverrides>['mediaStyle'],
                        }))
                      }
                    >
                      {VISUAL_RULE_OPTIONS.mediaStyle.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    动效节奏
                    <select
                      value={visualOverrides.motionStyle}
                      onChange={(event) =>
                        setVisualOverrides((current) => ({
                          ...current,
                          motionStyle: event.target
                            .value as Required<ThemeVisualOverrides>['motionStyle'],
                        }))
                      }
                    >
                      {VISUAL_RULE_OPTIONS.motionStyle.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    导航外观
                    <select
                      value={visualOverrides.navigationStyle}
                      onChange={(event) =>
                        setVisualOverrides((current) => ({
                          ...current,
                          navigationStyle: event.target
                            .value as Required<ThemeVisualOverrides>['navigationStyle'],
                        }))
                      }
                    >
                      {VISUAL_RULE_OPTIONS.navigationStyle.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div
                className="theme-inspector-section theme-diagnostics"
                aria-label="视觉检查"
                data-open={diagnosticsOpen || hasDiagnosticWarning}
              >
                <div className="theme-inspector-label">
                  <strong>视觉诊断</strong>
                  <button
                    type="button"
                    onClick={() => setDiagnosticsOpen((value) => !value)}
                  >
                    {hasDiagnosticWarning ? '需检查' : '良好'}
                  </button>
                </div>
                {diagnosticsOpen || hasDiagnosticWarning ? (
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
                ) : null}
              </div>
            </>
          ) : null}
        </aside>
      </div>
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
