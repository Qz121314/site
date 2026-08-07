import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AdminApiError,
  fetchSiteSettings,
  testMediaDomain,
  updateSiteSettings,
  type SiteSettings,
  type SiteSettingsUpdateInput,
} from './api';
import { brandingAssetPreviewUrl, uploadBrandingImage } from './branding-media/api';
import {
  formatBrandingBytes,
  prepareBrandingImage,
  releaseBrandingImage,
  type LocalBrandingImage,
} from './branding-media/local-branding-image';

type SiteSettingsViewProps = {
  onSessionExpired: () => void;
};

type SettingsDraft = Omit<
  SiteSettingsUpdateInput,
  | 'mediaBaseUrl'
  | 'ga4MeasurementId'
  | 'facebookPixelId'
  | 'affiliatePlatform'
  | 'affiliateDetectionConfig'
> & {
  logoAssetId: string | null;
  mediaBaseUrl: string;
  ga4MeasurementId: string;
  facebookPixelId: string;
  affiliatePlatform: string;
  affiliateDetectionConfig: string;
};

type SettingsPayload = SiteSettingsUpdateInput & { logoAssetId: string | null };
type SettingsPanel = 'basic' | 'tracking' | 'affiliate' | 'media' | 'navigation';

type DomainTestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

type SaveStage = 'idle' | 'uploading-logo' | 'saving';

const settingsPanels: Array<{ id: SettingsPanel; label: string }> = [
  { id: 'basic', label: '基础' },
  { id: 'tracking', label: '统计' },
  { id: 'affiliate', label: '联盟' },
  { id: 'media', label: '媒体' },
  { id: 'navigation', label: '导航' },
];

function createDraft(settings: SiteSettings): SettingsDraft {
  return {
    siteName: settings.siteName,
    locationLabel: settings.locationLabel,
    logoAssetId: settings.logoAssetId,
    mediaBaseUrl: settings.mediaBaseUrl ?? '',
    ga4MeasurementId: settings.ga4MeasurementId ?? '',
    facebookPixelId: settings.facebookPixelId ?? '',
    affiliateDetectionEnabled: settings.affiliateDetectionEnabled,
    affiliatePlatform: settings.affiliatePlatform ?? '',
    affiliateDetectionConfig: settings.affiliateDetectionConfig ?? '',
    homeSectionLimit: settings.homeSectionLimit,
    showHot: settings.showHot,
    showLatest: settings.showLatest,
    showMore: settings.showMore,
    showMessages: settings.showMessages,
    showFaq: settings.showFaq,
  };
}

function toInput(draft: SettingsDraft): SettingsPayload {
  return {
    ...draft,
    mediaBaseUrl: draft.mediaBaseUrl.trim() || null,
    ga4MeasurementId: draft.ga4MeasurementId.trim() || null,
    facebookPixelId: draft.facebookPixelId.trim() || null,
    affiliatePlatform: draft.affiliatePlatform.trim() || null,
    affiliateDetectionConfig: draft.affiliateDetectionConfig.trim() || null,
  };
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

export function SiteSettingsView({ onSessionExpired }: SiteSettingsViewProps) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [activePanel, setActivePanel] = useState<SettingsPanel>('basic');
  const [localLogo, setLocalLogo] = useState<LocalBrandingImage | null>(null);
  const [processingLogo, setProcessingLogo] = useState(false);
  const [saveStage, setSaveStage] = useState<SaveStage>('idle');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [domainTest, setDomainTest] = useState<DomainTestState>({ status: 'idle' });

  useEffect(() => () => releaseBrandingImage(localLogo), [localLogo]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await fetchSiteSettings();
      setSettings(result);
      setDraft(createDraft(result));
      setLocalLogo(null);
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        onSessionExpired();
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : '无法读取站点设置。');
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  function updateDraft<K extends keyof SettingsDraft>(field: K, value: SettingsDraft[K]) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
    setSuccessMessage(null);
    if (field === 'mediaBaseUrl') setDomainTest({ status: 'idle' });
  }

  async function selectLogo(file: File) {
    if (processingLogo || saveStage !== 'idle') return;
    setProcessingLogo(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const prepared = await prepareBrandingImage(file, 'logo');
      setLocalLogo(prepared);
      updateDraft('logoAssetId', null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Logo 本地处理失败。');
    } finally {
      setProcessingLogo(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saveStage !== 'idle' || processingLogo) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    let input = toInput(draft);
    try {
      if (localLogo) {
        setSaveStage('uploading-logo');
        const uploaded = await uploadBrandingImage('logo', localLogo.compressedFile);
        input = { ...input, logoAssetId: uploaded.media.id };
        setDraft((current) => (current ? { ...current, logoAssetId: uploaded.media.id } : current));
        setLocalLogo(null);
      }

      setSaveStage('saving');
      const updated = await updateSiteSettings(input);
      setSettings(updated);
      setDraft(createDraft(updated));
      setSuccessMessage('站点设置已保存。');
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        onSessionExpired();
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : '保存站点设置失败。');
    } finally {
      setSaveStage('idle');
    }
  }

  async function handleDomainTest() {
    if (!draft || domainTest.status === 'testing') return;
    const mediaBaseUrl = draft.mediaBaseUrl.trim();
    if (!mediaBaseUrl) {
      setDomainTest({ status: 'error', message: '请先填写 R2 自定义域名。' });
      return;
    }

    setDomainTest({ status: 'testing' });
    try {
      const result = await testMediaDomain(mediaBaseUrl);
      updateDraft('mediaBaseUrl', result.mediaBaseUrl);
      setDomainTest({
        status: 'success',
        message: `连接成功 · HTTP ${result.responseStatus}`,
      });
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        onSessionExpired();
        return;
      }
      setDomainTest({
        status: 'error',
        message: error instanceof Error ? error.message : 'R2 自定义域名连接测试失败。',
      });
    }
  }

  if (loading) return <section className="settings-card settings-loading">正在读取站点设置…</section>;

  if (!draft || !settings) {
    return (
      <section className="settings-card settings-error-state">
        <strong>无法读取站点设置</strong>
        <p>{errorMessage ?? '请检查 D1 数据库和后台接口。'}</p>
        <button className="secondary-button" type="button" onClick={() => void loadSettings()}>
          重新加载
        </button>
      </section>
    );
  }

  const busy = saveStage !== 'idle' || processingLogo;
  const logoPreviewUrl = localLogo?.previewUrl ??
    (draft.logoAssetId ? brandingAssetPreviewUrl(draft.logoAssetId) : null);

  return (
    <form className="settings-form settings-workbench" onSubmit={(event) => void handleSubmit(event)}>
      <div className="settings-workbench-bar">
        <div className="settings-tabs" role="tablist" aria-label="站点设置分组">
          {settingsPanels.map((panel) => (
            <button
              key={panel.id}
              type="button"
              className={activePanel === panel.id ? 'is-active' : undefined}
              aria-selected={activePanel === panel.id}
              onClick={() => setActivePanel(panel.id)}
            >
              {panel.label}
            </button>
          ))}
        </div>
        <small>更新于 {formatUpdatedAt(settings.updatedAt)}</small>
      </div>

      <div className="settings-panel-frame">
        {activePanel === 'basic' ? (
          <section className="settings-card settings-panel" aria-label="基础设置">
            <div className="settings-grid settings-basic-grid">
              <label className="field-group">
                <span>站点名称</span>
                <input
                  type="text"
                  value={draft.siteName}
                  disabled={busy}
                  onChange={(event) => updateDraft('siteName', event.target.value)}
                />
              </label>

              <label className="field-group">
                <span>位置文案</span>
                <input
                  type="text"
                  value={draft.locationLabel}
                  disabled={busy}
                  onChange={(event) => updateDraft('locationLabel', event.target.value)}
                />
              </label>

              <label className="field-group">
                <span>首页分区数量</span>
                <input
                  type="number"
                  value={draft.homeSectionLimit}
                  min={1}
                  max={20}
                  step={1}
                  disabled={busy}
                  onChange={(event) => updateDraft('homeSectionLimit', Number(event.target.value))}
                />
              </label>
            </div>

            <div className="branding-upload-card branding-upload-compact">
              <div className="branding-preview branding-logo-preview">
                {logoPreviewUrl ? <img src={logoPreviewUrl} alt="站点 Logo 预览" /> : <span>Logo</span>}
              </div>
              <div className="branding-upload-copy">
                <strong>站点 Logo</strong>
                {localLogo ? (
                  <small>
                    {localLogo.width} × {localLogo.height} · {formatBrandingBytes(localLogo.compressedFile.size)}
                  </small>
                ) : draft.logoAssetId ? (
                  <small>已设置</small>
                ) : (
                  <small>未设置</small>
                )}
              </div>
              <div className="branding-upload-actions">
                <label className={`branding-file-button${busy ? ' is-disabled' : ''}`}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = '';
                      if (file) void selectLogo(file);
                    }}
                  />
                  {processingLogo ? '处理中…' : logoPreviewUrl ? '更换' : '上传'}
                </label>
                {logoPreviewUrl ? (
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => {
                      setLocalLogo(null);
                      updateDraft('logoAssetId', null);
                    }}
                  >
                    移除
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {activePanel === 'tracking' ? (
          <section className="settings-card settings-panel" aria-label="统计设置">
            <div className="settings-grid">
              <label className="field-group">
                <span>GA4 Measurement ID</span>
                <input
                  type="text"
                  value={draft.ga4MeasurementId}
                  placeholder="G-XXXXXXXXXX"
                  disabled={busy}
                  onChange={(event) => updateDraft('ga4MeasurementId', event.target.value)}
                />
              </label>

              <label className="field-group">
                <span>Facebook Pixel ID</span>
                <input
                  type="text"
                  value={draft.facebookPixelId}
                  placeholder="1234567890"
                  disabled={busy}
                  onChange={(event) => updateDraft('facebookPixelId', event.target.value)}
                />
              </label>
            </div>
          </section>
        ) : null}

        {activePanel === 'affiliate' ? (
          <section className="settings-card settings-panel settings-affiliate-panel" aria-label="联盟设置">
            <div className="settings-affiliate-topline">
              <label className="toggle-row">
                <span><strong>联盟检测</strong></span>
                <input
                  type="checkbox"
                  checked={draft.affiliateDetectionEnabled}
                  disabled={busy}
                  onChange={(event) => updateDraft('affiliateDetectionEnabled', event.target.checked)}
                />
              </label>
              <label className="field-group">
                <span>联盟平台</span>
                <input
                  type="text"
                  value={draft.affiliatePlatform}
                  placeholder="Impact / CJ / 自定义"
                  disabled={busy}
                  onChange={(event) => updateDraft('affiliatePlatform', event.target.value)}
                />
              </label>
            </div>

            <label className="field-group settings-config-field">
              <span>检测配置 JSON</span>
              <textarea
                rows={10}
                value={draft.affiliateDetectionConfig}
                placeholder={'{\n  "scriptSelector": "..."\n}'}
                spellCheck={false}
                disabled={busy}
                onChange={(event) => updateDraft('affiliateDetectionConfig', event.target.value)}
              />
            </label>
          </section>
        ) : null}

        {activePanel === 'media' ? (
          <section className="settings-card settings-panel" aria-label="媒体设置">
            <div className="domain-field-row">
              <label className="field-group">
                <span>R2 自定义域名</span>
                <input
                  type="url"
                  value={draft.mediaBaseUrl}
                  placeholder="https://assets.example.com"
                  disabled={busy || domainTest.status === 'testing'}
                  onChange={(event) => updateDraft('mediaBaseUrl', event.target.value)}
                />
              </label>
              <button
                className="secondary-button domain-test-button"
                type="button"
                disabled={busy || domainTest.status === 'testing' || !draft.mediaBaseUrl.trim()}
                onClick={() => void handleDomainTest()}
              >
                {domainTest.status === 'testing' ? '测试中…' : '测试连接'}
              </button>
            </div>

            {domainTest.status === 'success' ? (
              <p className="inline-status is-success">{domainTest.message}</p>
            ) : null}
            {domainTest.status === 'error' ? (
              <p className="inline-status is-error">{domainTest.message}</p>
            ) : null}
          </section>
        ) : null}

        {activePanel === 'navigation' ? (
          <section className="settings-card settings-panel" aria-label="导航设置">
            <div className="toggle-grid settings-navigation-grid">
              {(
                [
                  ['showHot', 'Hot'],
                  ['showLatest', 'Latest'],
                  ['showMore', 'More'],
                  ['showMessages', 'Messages'],
                  ['showFaq', 'FAQ'],
                ] as const
              ).map(([field, label]) => (
                <label className="toggle-row" key={field}>
                  <span><strong>{label}</strong></span>
                  <input
                    type="checkbox"
                    checked={draft[field]}
                    disabled={busy}
                    onChange={(event) => updateDraft(field, event.target.checked)}
                  />
                </label>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {errorMessage ? <p className="inline-status is-error settings-toast">{errorMessage}</p> : null}
      {successMessage ? <p className="inline-status is-success settings-toast">{successMessage}</p> : null}

      <div className="settings-actions settings-workbench-actions">
        <button className="primary-button settings-save-button" type="submit" disabled={busy}>
          {saveStage === 'uploading-logo'
            ? '上传 Logo…'
            : saveStage === 'saving'
              ? '保存中…'
              : '保存站点设置'}
        </button>
      </div>
    </form>
  );
}
