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

type DomainTestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

type SaveStage = 'idle' | 'uploading-logo' | 'saving';

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
      setSuccessMessage('Logo 已在浏览器压缩并预览，点击保存站点设置后才会上传到 R2。');
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
      setSuccessMessage('站点设置与 Logo 已保存。');
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
        message: `连接成功，测试对象返回 HTTP ${result.responseStatus}。`,
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

  if (loading) return <section className="settings-card">正在读取站点设置…</section>;

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
    <form className="settings-form" onSubmit={(event) => void handleSubmit(event)}>
      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <p className="eyebrow">基础设置</p>
            <h2>站点与 Logo</h2>
          </div>
          <small>最后更新：{formatUpdatedAt(settings.updatedAt)}</small>
        </div>

        <div className="settings-grid">
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

          <label className="field-group field-group-compact">
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

        <div className="branding-upload-card">
          <div className="branding-preview branding-logo-preview">
            {logoPreviewUrl ? <img src={logoPreviewUrl} alt="站点 Logo 预览" /> : <span>未设置 Logo</span>}
          </div>
          <div className="branding-upload-copy">
            <strong>站点 Logo</strong>
            <p>支持 JPG、PNG、WebP。浏览器最长边压缩至 1200px，原图不会上传。</p>
            {localLogo ? (
              <small>
                压缩后 {localLogo.width} × {localLogo.height} · {formatBrandingBytes(localLogo.compressedFile.size)}
                {'；'}原图 {formatBrandingBytes(localLogo.originalByteSize)}
              </small>
            ) : draft.logoAssetId ? (
              <small>已绑定 R2 图片素材。</small>
            ) : null}
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
                {processingLogo ? '浏览器压缩中…' : logoPreviewUrl ? '更换 Logo' : '上传 Logo'}
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
                  移除 Logo
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <p className="eyebrow">统计代码</p>
            <h2>GA4 与 Facebook Pixel</h2>
          </div>
        </div>

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

      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <p className="eyebrow">联盟平台</p>
            <h2>联盟检测</h2>
          </div>
          <span className={draft.affiliateDetectionEnabled ? 'status-chip is-configured' : 'status-chip'}>
            {draft.affiliateDetectionEnabled ? '已启用' : '未启用'}
          </span>
        </div>

        <label className="toggle-row">
          <span>
            <strong>启用联盟平台检测</strong>
            <small>用于前端检测联盟脚本或平台配置是否正确加载。</small>
          </span>
          <input
            type="checkbox"
            checked={draft.affiliateDetectionEnabled}
            disabled={busy}
            onChange={(event) => updateDraft('affiliateDetectionEnabled', event.target.checked)}
          />
        </label>

        <div className="settings-grid">
          <label className="field-group">
            <span>联盟平台名称</span>
            <input
              type="text"
              value={draft.affiliatePlatform}
              placeholder="例如：Impact / CJ / 自定义"
              disabled={busy}
              onChange={(event) => updateDraft('affiliatePlatform', event.target.value)}
            />
          </label>
        </div>

        <label className="field-group">
          <span>检测配置 JSON</span>
          <textarea
            rows={7}
            value={draft.affiliateDetectionConfig}
            placeholder={'{\n  "scriptSelector": "..."\n}'}
            spellCheck={false}
            disabled={busy}
            onChange={(event) => updateDraft('affiliateDetectionConfig', event.target.value)}
          />
        </label>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <p className="eyebrow">R2 公共媒体</p>
            <h2>图片自定义域名</h2>
          </div>
          <span className={draft.mediaBaseUrl ? 'status-chip is-configured' : 'status-chip'}>
            {draft.mediaBaseUrl ? '已填写' : '未配置'}
          </span>
        </div>

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
            {domainTest.status === 'testing' ? '正在测试…' : '测试连接'}
          </button>
        </div>

        {domainTest.status === 'success' ? (
          <p className="inline-status is-success">{domainTest.message}</p>
        ) : null}
        {domainTest.status === 'error' ? (
          <p className="inline-status is-error">{domainTest.message}</p>
        ) : null}
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <div>
            <p className="eyebrow">用户前端入口</p>
            <h2>导航显示开关</h2>
          </div>
        </div>
        <div className="toggle-grid">
          {(
            [
              ['showHot', 'Hot', '显示热门产品入口'],
              ['showLatest', 'Latest', '显示最新产品入口'],
              ['showMore', 'More', '显示更多分区入口'],
              ['showMessages', 'Messages', '显示客服入口'],
              ['showFaq', 'FAQ', '显示 FAQ 入口'],
            ] as const
          ).map(([field, label, description]) => (
            <label className="toggle-row" key={field}>
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
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

      {errorMessage ? <p className="inline-status is-error">{errorMessage}</p> : null}
      {successMessage ? <p className="inline-status is-success">{successMessage}</p> : null}

      <div className="settings-actions">
        <span>站点级配置统一在此保存。</span>
        <button className="primary-button settings-save-button" type="submit" disabled={busy}>
          {saveStage === 'uploading-logo'
            ? '正在上传压缩 Logo…'
            : saveStage === 'saving'
              ? '正在保存…'
              : '保存站点设置'}
        </button>
      </div>
    </form>
  );
}
