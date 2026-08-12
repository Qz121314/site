import {
  StorefrontBottomNavigation,
  StorefrontBrandBar,
  StorefrontHero,
  StorefrontProductCard,
} from '@site/storefront-ui';
import { storefrontThemeStyle } from '@site/storefront-ui/theme';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
} from 'react';
import { AdminApiError } from './api';
import { useAdminDirtySource } from './admin-unsaved-state';
import {
  fetchThemeCenter,
  importThemeFromJson,
  importThemeFromRegistry,
  updateThemeCenter,
  type ImportedThemeDefinition,
  type ResolvedTheme,
  type ThemeButtonStyle,
  type ThemeDensity,
  type ThemeFontPack,
  type ThemeInstallPrompt,
  type ThemeKey,
  type ThemeMediaStyle,
  type ThemeMotionStyle,
  type ThemeNavigationStyle,
  type ThemePreset,
} from './theme-center/api';

type ThemeCenterViewProps = {
  onSessionExpired: () => void;
};

type ThemeSourceTab = 'official' | 'registry' | 'json';
type ThemeMode = 'light' | 'dark';
type ThemeRecipeSelection = {
  density: ThemeDensity;
  fontPack: ThemeFontPack;
  buttonStyle: ThemeButtonStyle;
  mediaStyle: ThemeMediaStyle;
  motionStyle: ThemeMotionStyle;
  navigationStyle: ThemeNavigationStyle;
};

const FONT_PACK_LABELS: Record<ThemeFontPack, string> = {
  modern: 'Modern Sans · 现代',
  editorial: 'Soft Editorial · 高级生活方式',
  compact: 'Compact UI · 紧凑浏览',
  technical: 'Technical Sans · 科技',
};

const BUTTON_STYLE_LABELS: Record<ThemeButtonStyle, string> = {
  refined: 'Refined Rectangle · 精致矩形',
  minimal: 'Minimal Flat · 极简平面',
  'soft-pill': 'Soft Pill · 柔和胶囊',
};

const MEDIA_STYLE_LABELS: Record<ThemeMediaStyle, string> = {
  precise: 'Precise · 利落素材',
  soft: 'Soft · 适度圆角',
  editorial: 'Editorial · 摄影内容',
};

const MOTION_STYLE_LABELS: Record<ThemeMotionStyle, string> = {
  restrained: 'Restrained · 克制',
  gentle: 'Gentle · 柔和',
  active: 'Active · 活跃',
};

const NAVIGATION_STYLE_LABELS: Record<ThemeNavigationStyle, string> = {
  quiet: 'Quiet · 安静导航',
  tinted: 'Tinted · 品牌强调',
  solid: 'Solid · 强对比',
};

function recipeSelection(theme: ResolvedTheme | ThemePreset): ThemeRecipeSelection {
  return {
    density: theme.density,
    fontPack: theme.recipe.fontPack,
    buttonStyle: theme.recipe.buttonStyle,
    mediaStyle: theme.recipe.mediaStyle,
    motionStyle: theme.recipe.motionStyle,
    navigationStyle: theme.recipe.navigationStyle,
  };
}

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

function importedSignature(value: ImportedThemeDefinition | undefined): string {
  return value ? JSON.stringify(value) : '';
}

function PreviewLink({ children, className }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <span className={className}>{children}</span>;
}

export function ThemeCenterView({ onSessionExpired }: ThemeCenterViewProps) {
  const [presets, setPresets] = useState<ThemePreset[]>([]);
  const [currentTheme, setCurrentTheme] = useState<ResolvedTheme | null>(null);
  const [selectedKey, setSelectedKey] = useState<ThemeKey>('marketplace');
  const [importedTheme, setImportedTheme] = useState<ResolvedTheme | null>(null);
  const [sourceTab, setSourceTab] = useState<ThemeSourceTab>('official');
  const [registryUrl, setRegistryUrl] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [importMode, setImportMode] = useState<ThemeMode>('light');
  const [accent, setAccent] = useState('');
  const [recipe, setRecipe] = useState<ThemeRecipeSelection>({
    density: 'standard',
    fontPack: 'modern',
    buttonStyle: 'refined',
    mediaStyle: 'soft',
    motionStyle: 'restrained',
    navigationStyle: 'quiet',
  });
  const [installPrompt, setInstallPrompt] = useState<ThemeInstallPrompt>({
    enabled: true,
    delaySeconds: 30,
    title: 'Install app',
    description: 'Add it to your desktop for faster access.',
    iosDescription: 'Use Share, then Add to Home Screen.',
    installLabel: 'Install',
    dismissLabel: 'Not now',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const selectedImported =
    selectedKey === 'custom' ? importedTheme?.overrides.imported : undefined;
  const currentImported =
    currentTheme?.key === 'custom' ? currentTheme.overrides.imported : undefined;
  const themeIsDirty =
    currentTheme !== null &&
    (selectedKey !== currentTheme.key ||
      accent.trim().toLowerCase() !==
        (currentTheme.overrides.accent ?? '').toLowerCase() ||
      JSON.stringify(recipe) !== JSON.stringify(recipeSelection(currentTheme)) ||
      JSON.stringify(installPrompt) !== JSON.stringify(currentTheme.installPrompt) ||
      importedSignature(selectedImported) !== importedSignature(currentImported));
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
      setRecipe(recipeSelection(data.theme));
      setInstallPrompt(data.theme.installPrompt);
      if (data.theme.key === 'custom') {
        setImportedTheme(data.theme);
        setSourceTab(
          data.theme.overrides.imported?.source === 'shadcn' ? 'registry' : 'json',
        );
        setImportMode(data.theme.colorScheme);
        setRegistryUrl(data.theme.overrides.imported?.sourceUrl ?? '');
      }
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

  const selectedPreset = useMemo(() => {
    if (selectedKey === 'custom') return importedTheme;
    return presets.find((preset) => preset.key === selectedKey) ?? presets[0] ?? null;
  }, [importedTheme, presets, selectedKey]);
  const previewAccent =
    normalizeAccent(accent) ?? selectedPreset?.tokens.brand ?? '#ff5a1f';
  const colorInputValue =
    normalizeAccent(accent) ??
    normalizeAccent(selectedPreset?.tokens.brand ?? '') ??
    '#ff5a1f';

  function clearMessages() {
    setErrorMessage('');
    setSuccessMessage('');
  }

  function selectOfficialTheme(preset: ThemePreset) {
    setSelectedKey(preset.key);
    setImportedTheme(null);
    setAccent('');
    setRecipe(recipeSelection(preset));
    setInstallPrompt(preset.installPrompt);
    clearMessages();
  }

  async function importRegistryTheme() {
    if (importing || !registryUrl.trim()) return;
    setImporting(true);
    clearMessages();
    try {
      const theme = await importThemeFromRegistry(registryUrl.trim(), importMode);
      setImportedTheme(theme);
      setSelectedKey('custom');
      setAccent('');
      setRecipe(recipeSelection(theme));
      setInstallPrompt(theme.installPrompt);
      setSuccessMessage('主题已读取并转换。请先检查右侧移动端预览，再点击“保存并应用”。');
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : '主题库读取失败。');
    } finally {
      setImporting(false);
    }
  }

  async function importJsonTheme() {
    if (importing || !jsonText.trim()) return;
    setImporting(true);
    clearMessages();
    try {
      const theme = await importThemeFromJson(jsonText.trim(), importMode);
      setImportedTheme(theme);
      setSelectedKey('custom');
      setAccent('');
      setRecipe(recipeSelection(theme));
      setInstallPrompt(theme.installPrompt);
      setSuccessMessage('JSON 主题已转换。请检查右侧移动端预览，再点击“保存并应用”。');
    } catch (error) {
      if (isSessionError(error)) {
        onSessionExpired();
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : '主题 JSON 导入失败。');
    } finally {
      setImporting(false);
    }
  }

  async function saveTheme() {
    if (saving || !selectedPreset || !themeIsDirty) return;
    const normalizedAccent = accent.trim() ? normalizeAccent(accent) : null;
    if (accent.trim() && !normalizedAccent) {
      setErrorMessage('品牌强调色请输入 6 位十六进制颜色，例如 #ff5a1f。');
      return;
    }
    const imported =
      selectedKey === 'custom' ? importedTheme?.overrides.imported : undefined;
    if (selectedKey === 'custom' && !imported) {
      setErrorMessage('请先从主题库或 JSON 导入一个有效主题。');
      return;
    }

    setSaving(true);
    clearMessages();
    try {
      const updated = await updateThemeCenter(
        selectedKey,
        normalizedAccent,
        recipe,
        installPrompt,
        imported,
      );
      setCurrentTheme(updated);
      setSelectedKey(updated.key);
      setAccent(updated.overrides.accent ?? '');
      setRecipe(recipeSelection(updated));
      setInstallPrompt(updated.installPrompt);
      if (updated.key === 'custom') setImportedTheme(updated);
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

  return (
    <section className="theme-center" aria-labelledby="theme-center-title">
      <div className="theme-center-heading">
        <div className="theme-center-heading-copy">
          <p>用户前端视觉系统</p>
          <h2 id="theme-center-title">主题中心</h2>
          <span>
            以移动端为主要设计基准；PC 端作为响应式扩展。产品列表默认双列并使用 1:1
            方形封面。
          </span>
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

      <div className="theme-center-layout">
        <div className="theme-preset-panel">
          <div className="theme-source-tabs" role="tablist" aria-label="主题来源">
            <button
              type="button"
              className={sourceTab === 'official' ? 'is-active' : ''}
              onClick={() => setSourceTab('official')}
            >
              官方精选
            </button>
            <button
              type="button"
              className={sourceTab === 'registry' ? 'is-active' : ''}
              onClick={() => setSourceTab('registry')}
            >
              主题库
            </button>
            <button
              type="button"
              className={sourceTab === 'json' ? 'is-active' : ''}
              onClick={() => setSourceTab('json')}
            >
              JSON 导入
            </button>
          </div>

          {sourceTab === 'official' ? (
            <>
              <div className="theme-section-title">
                <strong>官方精选</strong>
                <span>经过移动端双列、触控和底部导航验证的内置主题。</span>
              </div>
              <div className="theme-preset-grid">
                {presets.map((preset) => (
                  <button
                    className={`theme-preset-card${selectedKey === preset.key ? ' is-selected' : ''}`}
                    type="button"
                    key={preset.key}
                    onClick={() => selectOfficialTheme(preset)}
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
                      <em>
                        {preset.colorScheme === 'dark' ? '深色' : '浅色'} ·{' '}
                        {FONT_PACK_LABELS[preset.recipe.fontPack].split(' · ')[0]} · V
                        {preset.recipe.version}
                      </em>
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {sourceTab === 'registry' ? (
            <div className="theme-import-panel">
              <div className="theme-section-title">
                <strong>shadcn Registry 主题库</strong>
                <span>
                  只读取公开 HTTPS 的 registry:theme JSON，并转换为本站 Theme
                  Tokens；不会执行外部 JS、React 或 CSS 文件。
                </span>
              </div>
              <label className="theme-import-field">
                <span>Theme JSON 地址</span>
                <input
                  type="url"
                  value={registryUrl}
                  placeholder="https://example.com/r/my-theme.json"
                  onChange={(event) => setRegistryUrl(event.target.value)}
                />
              </label>
              <div className="theme-import-row">
                <label className="theme-import-field">
                  <span>读取模式</span>
                  <select
                    value={importMode}
                    onChange={(event) => setImportMode(event.target.value as ThemeMode)}
                  >
                    <option value="light">浅色 light</option>
                    <option value="dark">深色 dark</option>
                  </select>
                </label>
                <button
                  className="primary-button theme-import-button"
                  type="button"
                  disabled={importing || !registryUrl.trim()}
                  onClick={() => void importRegistryTheme()}
                >
                  {importing ? '正在读取…' : '读取并预览'}
                </button>
              </div>
              <div className="theme-import-note">
                <strong>安全边界</strong>
                <span>
                  最多读取 256 KB JSON；拒绝 localhost、私网地址和非 HTTPS
                  地址。保存后前端只读取本站存储的标准化 Token，不依赖原主题 URL。
                </span>
              </div>
            </div>
          ) : null}

          {sourceTab === 'json' ? (
            <div className="theme-import-panel">
              <div className="theme-section-title">
                <strong>JSON 导入</strong>
                <span>支持 shadcn registry:theme JSON，也支持本站标准 Theme JSON。</span>
              </div>
              <label className="theme-import-field">
                <span>主题 JSON</span>
                <textarea
                  value={jsonText}
                  placeholder={
                    '{\n  "type": "registry:theme",\n  "name": "my-theme",\n  "cssVars": { "light": { ... } }\n}'
                  }
                  onChange={(event) => setJsonText(event.target.value)}
                />
              </label>
              <div className="theme-import-row">
                <label className="theme-import-field">
                  <span>读取模式</span>
                  <select
                    value={importMode}
                    onChange={(event) => setImportMode(event.target.value as ThemeMode)}
                  >
                    <option value="light">浅色 light</option>
                    <option value="dark">深色 dark</option>
                  </select>
                </label>
                <button
                  className="primary-button theme-import-button"
                  type="button"
                  disabled={importing || !jsonText.trim()}
                  onClick={() => void importJsonTheme()}
                >
                  {importing ? '正在解析…' : '解析并预览'}
                </button>
              </div>
            </div>
          ) : null}

          {selectedKey === 'custom' && selectedPreset ? (
            <div className="theme-imported-summary">
              <span className="theme-imported-badge">外部主题</span>
              <div>
                <strong>{selectedPreset.label}</strong>
                <small>{selectedPreset.description}</small>
              </div>
              <span>
                {selectedPreset.colorScheme === 'dark' ? '深色' : '浅色'} · 已标准化
              </span>
            </div>
          ) : null}
        </div>

        <aside className="theme-preview-panel">
          <div className="theme-preview-panel-heading">
            <div className="theme-section-title">
              <strong>移动端实时预览</strong>
              <span>模拟用户主要访问场景；品牌色可选，留空使用主题原色。</span>
            </div>
            {themeIsDirty ? (
              <span className="theme-unsaved-pill">待保存</span>
            ) : (
              <span className="theme-saved-pill">已保存</span>
            )}
          </div>

          <label className="theme-accent-field">
            <span>品牌强调色</span>
            <div>
              <input
                type="color"
                value={colorInputValue}
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
              {accent ? (
                <button type="button" onClick={() => setAccent('')}>
                  恢复主题色
                </button>
              ) : null}
            </div>
          </label>

          {selectedPreset ? (
            <div className="theme-recipe-editor" aria-label="主题模板设置">
              <div className="theme-recipe-heading">
                <div>
                  <strong>UI Recipe</strong>
                  <span>模板已做好完整搭配，只开放安全范围内的品牌调整。</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRecipe(recipeSelection(selectedPreset))}
                >
                  恢复模板
                </button>
              </div>

              <div className="theme-recipe-grid">
                <label>
                  <span>字体方案</span>
                  <select
                    value={recipe.fontPack}
                    onChange={(event) =>
                      setRecipe((current) => ({
                        ...current,
                        fontPack: event.target.value as ThemeFontPack,
                      }))
                    }
                  >
                    {Object.entries(FONT_PACK_LABELS).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>页面密度</span>
                  <select
                    value={recipe.density}
                    onChange={(event) =>
                      setRecipe((current) => ({
                        ...current,
                        density: event.target.value as ThemeDensity,
                      }))
                    }
                  >
                    <option value="compact">Compact · 紧凑</option>
                    <option value="standard">Standard · 标准</option>
                    <option value="comfortable">Comfortable · 宽松</option>
                  </select>
                </label>

                <label>
                  <span>按钮方案</span>
                  <select
                    value={recipe.buttonStyle}
                    onChange={(event) =>
                      setRecipe((current) => ({
                        ...current,
                        buttonStyle: event.target.value as ThemeButtonStyle,
                      }))
                    }
                  >
                    {Object.entries(BUTTON_STYLE_LABELS).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>素材方案</span>
                  <select
                    value={recipe.mediaStyle}
                    onChange={(event) =>
                      setRecipe((current) => ({
                        ...current,
                        mediaStyle: event.target.value as ThemeMediaStyle,
                      }))
                    }
                  >
                    {Object.entries(MEDIA_STYLE_LABELS).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>点击与转场</span>
                  <select
                    value={recipe.motionStyle}
                    onChange={(event) =>
                      setRecipe((current) => ({
                        ...current,
                        motionStyle: event.target.value as ThemeMotionStyle,
                      }))
                    }
                  >
                    {Object.entries(MOTION_STYLE_LABELS).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>导航风格</span>
                  <select
                    value={recipe.navigationStyle}
                    onChange={(event) =>
                      setRecipe((current) => ({
                        ...current,
                        navigationStyle: event.target.value as ThemeNavigationStyle,
                      }))
                    }
                  >
                    {Object.entries(NAVIGATION_STYLE_LABELS).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          ) : null}

          {selectedPreset ? (
            <div className="theme-install-editor" aria-label="安装应用提示设置">
              <div className="theme-recipe-heading">
                <div>
                  <strong>安装应用提示</strong>
                  <span>用户停留指定时间后，在可安装设备上显示轻量提示。</span>
                </div>
                <label className="theme-install-switch">
                  <input
                    type="checkbox"
                    checked={installPrompt.enabled}
                    onChange={(event) =>
                      setInstallPrompt((current) => ({
                        ...current,
                        enabled: event.target.checked,
                      }))
                    }
                  />
                  <span>{installPrompt.enabled ? '已开启' : '已关闭'}</span>
                </label>
              </div>

              <div className="theme-install-grid">
                <label>
                  <span>延迟显示（秒）</span>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={installPrompt.delaySeconds}
                    disabled={!installPrompt.enabled}
                    onChange={(event) =>
                      setInstallPrompt((current) => ({
                        ...current,
                        delaySeconds: Math.max(
                          5,
                          Math.min(120, Number(event.target.value) || 30),
                        ),
                      }))
                    }
                  />
                </label>
                <label>
                  <span>提示标题</span>
                  <input
                    type="text"
                    maxLength={80}
                    value={installPrompt.title}
                    disabled={!installPrompt.enabled}
                    onChange={(event) =>
                      setInstallPrompt((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="is-wide">
                  <span>桌面端说明</span>
                  <input
                    type="text"
                    maxLength={160}
                    value={installPrompt.description}
                    disabled={!installPrompt.enabled}
                    onChange={(event) =>
                      setInstallPrompt((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="is-wide">
                  <span>iPhone / iPad 说明</span>
                  <input
                    type="text"
                    maxLength={160}
                    value={installPrompt.iosDescription}
                    disabled={!installPrompt.enabled}
                    onChange={(event) =>
                      setInstallPrompt((current) => ({
                        ...current,
                        iosDescription: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>安装按钮</span>
                  <input
                    type="text"
                    maxLength={32}
                    value={installPrompt.installLabel}
                    disabled={!installPrompt.enabled}
                    onChange={(event) =>
                      setInstallPrompt((current) => ({
                        ...current,
                        installLabel: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>关闭提示</span>
                  <input
                    type="text"
                    maxLength={32}
                    value={installPrompt.dismissLabel}
                    disabled={!installPrompt.enabled}
                    onChange={(event) =>
                      setInstallPrompt((current) => ({
                        ...current,
                        dismissLabel: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          ) : null}

          {selectedPreset ? (
            <div className="theme-preview-device-shell">
              <div
                className="theme-live-preview storefront-ui-preview storefront-theme-root"
                data-color-scheme={selectedPreset.colorScheme}
                data-density={recipe.density}
                data-theme={selectedPreset.key}
                data-font-pack={recipe.fontPack}
                data-button-style={recipe.buttonStyle}
                data-media-style={recipe.mediaStyle}
                data-motion-style={recipe.motionStyle}
                data-navigation-style={recipe.navigationStyle}
                style={storefrontThemeStyle(selectedPreset.tokens, previewAccent)}
              >
                <div className="theme-preview-statusbar" aria-hidden="true">
                  <span>9:41</span>
                  <span>● ● ▰</span>
                </div>
                <StorefrontBrandBar
                  LinkComponent={PreviewLink}
                  locationLabel="Explore nearby"
                  logo="S"
                  siteName="Service"
                />
                <div className="theme-preview-content">
                  <StorefrontHero
                    description="Fast browsing designed for one-hand mobile use."
                    eyebrow={selectedPreset.label}
                    locationLabel="Nearby"
                    title="Discover what fits you"
                  />
                  <div className="theme-preview-section-row">
                    <strong>Featured</strong>
                    <span>See all</span>
                  </div>
                  <div className="theme-preview-products product-grid">
                    {[1, 2].map((item) => (
                      <StorefrontProductCard
                        categoryName="Category"
                        href="#"
                        key={item}
                        LinkComponent={PreviewLink}
                        media={
                          <div className="theme-preview-media image-fallback">
                            <span>1:1</span>
                          </div>
                        }
                        modeLabel="Online"
                        sectionName="Featured"
                        tags={[{ id: `preview-${item}`, name: 'Popular' }]}
                        title={item === 1 ? 'Product title' : 'Featured item'}
                      />
                    ))}
                  </div>
                </div>
                <StorefrontBottomNavigation
                  LinkComponent={PreviewLink}
                  items={[
                    { href: '/', icon: '⌂', label: 'Home' },
                    { href: '/#hot', icon: '◆', label: 'Hot' },
                    { href: '/#latest', icon: '◷', label: 'Latest' },
                    { href: '/#faq', icon: '?', label: 'FAQ' },
                  ]}
                />
              </div>
            </div>
          ) : null}

          <div className="theme-ratio-note">
            <strong>外部主题也必须服从本站移动端结构</strong>
            <p>
              外部来源只能改变经过校验的颜色
              Token。字体、按钮、素材、动效和导航会先映射到本站安全的 UI
              Recipe；产品双列和业务结构保持不变。
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
