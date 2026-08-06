import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AdminApiError,
  fetchSiteSettings,
  testMediaDomain,
  updateSiteSettings,
  type SiteSettings,
  type SiteSettingsUpdateInput,
} from './api';

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
  mediaBaseUrl: string;
  ga4MeasurementId: string;
  facebookPixelId: string;
  affiliatePlatform: string;
  affiliateDetectionConfig: string;
};

type DomainTestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

function createDraft(settings: SiteSettings): SettingsDraft {
  return {
    siteName: settings.siteName,
    locationLabel: settings.locationLabel,
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

function toInput(draft: SettingsDraft): SiteSettingsUpdateInput {
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [domainTest, setDomainTest] = useState<DomainTestState>({ status: 'idle' });

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await fetchSiteSettings();
      setSettings(result);
      setDraft(createDraft(result));
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || saving) return;

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const updated = await updateSiteSettings(toInput(draft));
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
      setSaving(false);
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

  if (loading) {
    return <section className="settings-card">正在读取站点设置…</section>;
  }

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
              disabled={saving}
              onChange={(event) => updateDraft('siteName', event.target.value)}
            />
          </label>

          <label className="field-group">
            <span>位置文案</span>
            <input
              type="text"
              value={draft.locationLabel}
              disabled={saving}
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
              disabled={saving}
              onChange={(event) => updateDraft('homeSectionLimit', Number(event.target.value))}
            />
          </label>
        </div>

        <div className="settings-note">
          <strong>Logo</strong>
          <p>
            {settings.logoAssetId
              ? `当前 Logo 素材 ID：${settings.logoAssetId}`
              : '当前未设置 Logo。素材库扫描功能完成后，可在这里从 R2 已有对象中选择，不在素材库提供上传。'}
          </p>
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
              disabled={saving}
              onChange={(event) => updateDraft('ga4MeasurementId', event.target.value)}
            />
          </label>

          <label className="field-group">
            <span>Facebook Pixel ID</span>
            <input
              type="text"
              value={draft.facebookPixelId}
              placeholder="1234567890"
              disabled={saving}
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
            disabled={saving}
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
              disabled={saving}
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
            disabled={saving}
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
              disabled={saving || domainTest.status === 'testing'}
              onChange={(event) => updateDraft('mediaBaseUrl', event.target.value)}
            />
          </label>
          <button
            className="secondary-button domain-test-button"
            type="button"
            disabled={saving || domainTest.status === 'testing' || !draft.mediaBaseUrl.trim()}
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
                disabled={saving}
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
        <button className="primary-button settings-save-button" type="submit" disabled={saving}>
          {saving ? '正在保存…' : '保存站点设置'}
        </button>
      </div>
    </form>
  );
}
