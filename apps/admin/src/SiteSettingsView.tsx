import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  AdminApiError,
  fetchSections,
  testMediaDomain,
  type AdminSection,
} from './api';
import { useAdminDirtySource } from './admin-unsaved-state';
import { MediaPickerDialog } from './asset-library/MediaPickerDialog';
import { BottomNavigationSettingsSection } from './BottomNavigationSettingsSection';
import { brandingAssetPreviewUrl, uploadBrandingImage } from './branding-media/api';
import {
  formatBrandingBytes,
  prepareBrandingImage,
  releaseBrandingImage,
  type LocalBrandingImage,
} from './branding-media/local-branding-image';
import { HomeLayoutSettingsSection } from './HomeLayoutSettingsSection';
import { SiteHeroSettingsSection } from './SiteHeroSettingsSection';
import { StorefrontCopySettingsSection } from './StorefrontCopySettingsSection';
import {
  fetchSiteSettingsWithHero,
  updateSiteSettingsWithHero,
  type BottomNavigationItem,
  type SiteHeroSlide,
  type SiteSettingsWithHero,
  type SiteSettingsWithHeroUpdateInput,
} from './site-hero-settings-api';

type SiteSettingsViewProps = {
  onSessionExpired: () => void;
};

type SettingsDraft = Omit<
  SiteSettingsWithHeroUpdateInput,
  'mediaBaseUrl' | 'ga4MeasurementId' | 'heroSlides' | 'bottomNavigation'
> & {
  mediaBaseUrl: string;
  ga4MeasurementId: string;
  heroSlides: SiteHeroSlide[];
  bottomNavigation: BottomNavigationItem[];
};

type SettingsPayload = SiteSettingsWithHeroUpdateInput;

type DomainTestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

type SaveStage = 'idle' | 'uploading-logo' | 'saving';
type SettingsPanel = 'general' | 'home' | 'copy' | 'advanced';

const SETTINGS_PANELS: Array<{ id: SettingsPanel; label: string }> = [
  { id: 'general', label: '常用设置' },
  { id: 'home', label: '首页展示' },
  { id: 'copy', label: '前端文案' },
  { id: 'advanced', label: '高级设置' },
];

function createDraft(settings: SiteSettingsWithHero): SettingsDraft {
  return {
    siteName: settings.siteName,
    locationLabel: settings.locationLabel,
    logoAssetId: settings.logoAssetId,
    mediaBaseUrl: settings.mediaBaseUrl ?? '',
    ga4MeasurementId: settings.ga4MeasurementId ?? '',
    homeSectionLimit: settings.homeSectionLimit,
    showHot: settings.showHot,
    showLatest: settings.showLatest,
    showMore: settings.showMore,
    showFaq: settings.showFaq,
    storefrontCopy: structuredClone(settings.storefrontCopy),
    heroSlides: settings.heroSlides.map((slide) => ({ ...slide })),
    bottomNavigation: settings.bottomNavigation.map((item) => ({ ...item })),
    homeLayout: {
      shortcutSectionIds: [...settings.homeLayout.shortcutSectionIds],
      recommendationSectionIds: [...settings.homeLayout.recommendationSectionIds],
    },
  };
}

function optionalTrimmed(value: string | null): string | null {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}

function toInput(draft: SettingsDraft): SettingsPayload {
  return {
    siteName: draft.siteName,
    locationLabel: draft.locationLabel,
    logoAssetId: draft.logoAssetId,
    mediaBaseUrl: draft.mediaBaseUrl.trim() || null,
    ga4MeasurementId: draft.ga4MeasurementId.trim() || null,
    homeSectionLimit: draft.homeSectionLimit,
    showHot: draft.showHot,
    showLatest: draft.showLatest,
    showMore: draft.showMore,
    showFaq: draft.showFaq,
    storefrontCopy: draft.storefrontCopy,
    heroSlides: draft.heroSlides.map((slide, index) => ({
      id: slide.id,
      mediaAssetId: slide.mediaAssetId,
      title: optionalTrimmed(slide.title),
      description: optionalTrimmed(slide.description),
      ctaLabel: optionalTrimmed(slide.ctaLabel),
      ctaHref: optionalTrimmed(slide.ctaHref),
      sortOrder: index,
    })),
    bottomNavigation: draft.bottomNavigation.map(({ sortOrder: _sortOrder, ...item }) => item),
    homeLayout: {
      shortcutSectionIds: [...draft.homeLayout.shortcutSectionIds],
      recommendationSectionIds: [...draft.homeLayout.recommendationSectionIds],
    },
  };
}

function settingsDirty(
  settings: SiteSettingsWithHero | null,
  draft: SettingsDraft | null,
  localLogo: LocalBrandingImage | null,
): boolean {
  if (!settings || !draft) return false;
  if (localLogo) return true;
  return JSON.stringify(toInput(draft)) !== JSON.stringify(toInput(createDraft(settings)));
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

export function SiteSettingsView({ onSessionExpired }: SiteSettingsViewProps) {
  const [settings, setSettings] = useState<SiteSettingsWithHero | null>(null);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [sections, setSections] = useState<AdminSection[]>([]);
  const [activePanel, setActivePanel] = useState<SettingsPanel>('general');
  const [localLogo, setLocalLogo] = useState<LocalBrandingImage | null>(null);
  const [logoPickerOpen, setLogoPickerOpen] = useState(false);
  const [processingLogo, setProcessingLogo] = useState(false);
  const [saveStage, setSaveStage] = useState<SaveStage>('idle');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [domainTest, setDomainTest] = useState<DomainTestState>({ status: 'idle' });

  useAdminDirtySource('site-settings', '站点设置', settingsDirty(settings, draft, localLogo));

  useEffect(() => () => releaseBrandingImage(localLogo), [localLogo]);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [result, activeSections] = await Promise.all([
        fetchSiteSettingsWithHero(),
        fetchSections('active'),
      ]);
      setSettings(result);
      setDraft(createDraft(result));
      setSections(activeSections);
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
      const updated = await updateSiteSettingsWithHero(input);
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
    <>
      <form className="settings-form admin-settings-page admin-settings-workbench" onSubmit={(event) => void handleSubmit(event)}>
        <section className="settings-card admin-settings-surface" aria-label="站点设置">
          <div className="admin-settings-toolbar">
            <div className="admin-settings-tabs" role="tablist" aria-label="站点设置分组">
              {SETTINGS_PANELS.map((panel) => (
                <button
                  key={panel.id}
                  className={`admin-settings-tab${activePanel === panel.id ? ' is-active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={activePanel === panel.id}
                  aria-controls={`settings-panel-${panel.id}`}
                  id={`settings-tab-${panel.id}`}
                  onClick={() => setActivePanel(panel.id)}
                >
                  {panel.label}
                </button>
              ))}
            </div>
            <span className="admin-settings-updated">更新于 {formatUpdatedAt(settings.updatedAt)}</span>
          </div>

          <div
            className="admin-settings-panel"
            id={`settings-panel-${activePanel}`}
            role="tabpanel"
            aria-labelledby={`settings-tab-${activePanel}`}
          >
            {activePanel === 'general' ? (
              <>
                <section className="admin-settings-section admin-settings-general" aria-labelledby="settings-basic-title">
                  <h2 id="settings-basic-title">基础信息</h2>
                  <div className="admin-settings-row admin-settings-basic-row">
                    <label className="field-group admin-field-site-name">
                      <span>站点名称</span>
                      <input type="text" value={draft.siteName} disabled={busy} onChange={(event) => updateDraft('siteName', event.target.value)} />
                    </label>

                    <label className="field-group admin-field-location">
                      <span>站点说明</span>
                      <input type="text" value={draft.locationLabel} disabled={busy} onChange={(event) => updateDraft('locationLabel', event.target.value)} />
                    </label>

                    <div className="admin-logo-field">
                      <span className="admin-field-label">站点 Logo</span>
                      <div className="admin-logo-control">
                        <div className="admin-logo-preview">
                          {logoPreviewUrl ? <img src={logoPreviewUrl} alt="站点 Logo 预览" /> : <span>Logo</span>}
                        </div>
                        <div className="admin-logo-state">
                          <strong>{localLogo ? '待保存' : draft.logoAssetId ? '已设置' : '未设置'}</strong>
                          {localLogo ? <small>{localLogo.width} × {localLogo.height} · {formatBrandingBytes(localLogo.compressedFile.size)}</small> : null}
                        </div>
                        <div className="admin-logo-actions">
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
                            {processingLogo ? '处理中…' : logoPreviewUrl ? '上传替换' : '上传'}
                          </label>
                          <button type="button" className="admin-text-button" disabled={busy} onClick={() => setLogoPickerOpen(true)}>
                            从素材中心选择
                          </button>
                          {logoPreviewUrl ? (
                            <button
                              type="button"
                              className="admin-text-button"
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
                    </div>
                  </div>
                </section>

                <SiteHeroSettingsSection
                  slides={draft.heroSlides}
                  busy={busy}
                  onChange={(heroSlides) => updateDraft('heroSlides', heroSlides)}
                  onSessionExpired={onSessionExpired}
                />
              </>
            ) : null}

            {activePanel === 'home' ? (
              <>
                <HomeLayoutSettingsSection
                  value={draft.homeLayout}
                  sections={sections}
                  busy={busy}
                  onChange={(homeLayout) => updateDraft('homeLayout', homeLayout)}
                />

                <BottomNavigationSettingsSection
                  value={draft.bottomNavigation}
                  busy={busy}
                  onChange={(bottomNavigation) => updateDraft('bottomNavigation', bottomNavigation)}
                  onSessionExpired={onSessionExpired}
                />
              </>
            ) : null}

            {activePanel === 'copy' ? (
              <StorefrontCopySettingsSection
                value={draft.storefrontCopy}
                busy={busy}
                onChange={(storefrontCopy) => updateDraft('storefrontCopy', storefrontCopy)}
              />
            ) : null}

            {activePanel === 'advanced' ? (
              <div className="admin-settings-advanced-grid">
                <section className="admin-settings-section" aria-labelledby="settings-frontend-title">
                  <h2 id="settings-frontend-title">统计</h2>
                  <div className="admin-settings-row admin-settings-frontend-row">
                    <label className="field-group admin-field-ga4">
                      <span>GA4 Measurement ID</span>
                      <input type="text" value={draft.ga4MeasurementId} placeholder="G-XXXXXXXXXX" disabled={busy} onChange={(event) => updateDraft('ga4MeasurementId', event.target.value)} />
                    </label>
                  </div>
                </section>

                <section className="admin-settings-section" aria-labelledby="settings-media-title">
                  <h2 id="settings-media-title">媒体域名</h2>
                  <div className="admin-settings-row admin-settings-media-row">
                    <label className="field-group admin-field-media-domain">
                      <span>R2 自定义域名</span>
                      <input type="url" value={draft.mediaBaseUrl} placeholder="https://assets.example.com" disabled={busy || domainTest.status === 'testing'} onChange={(event) => updateDraft('mediaBaseUrl', event.target.value)} />
                    </label>
                    <button className="secondary-button domain-test-button" type="button" disabled={busy || domainTest.status === 'testing' || !draft.mediaBaseUrl.trim()} onClick={() => void handleDomainTest()}>
                      {domainTest.status === 'testing' ? '测试中…' : '测试连接'}
                    </button>
                  </div>
                  {domainTest.status === 'success' ? <p className="inline-status is-success">{domainTest.message}</p> : null}
                  {domainTest.status === 'error' ? <p className="inline-status is-error">{domainTest.message}</p> : null}
                </section>
              </div>
            ) : null}
          </div>
        </section>

        {errorMessage ? <p className="inline-status is-error settings-toast">{errorMessage}</p> : null}
        {successMessage ? <p className="inline-status is-success settings-toast">{successMessage}</p> : null}

        <div className="settings-actions admin-settings-actions">
          <button className="primary-button settings-save-button" type="submit" disabled={busy}>
            {saveStage === 'uploading-logo' ? '上传 Logo…' : saveStage === 'saving' ? '保存中…' : '保存站点设置'}
          </button>
        </div>
      </form>

      {logoPickerOpen ? (
        <MediaPickerDialog
          title="选择站点 Logo"
          role="logo"
          allowedKinds={['image']}
          selectedIds={draft.logoAssetId ? [draft.logoAssetId] : []}
          onSessionExpired={onSessionExpired}
          onClose={() => setLogoPickerOpen(false)}
          onSelect={(asset) => {
            setLocalLogo(null);
            updateDraft('logoAssetId', asset.id);
            setLogoPickerOpen(false);
            setSuccessMessage('已从素材中心选择 Logo，保存站点设置后生效。');
          }}
        />
      ) : null}
    </>
  );
}
