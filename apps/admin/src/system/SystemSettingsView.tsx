import { useState, type FormEvent } from 'react';
import { AdminApiError, testMediaDomain } from '../api';
import { useAdminDirtySource } from '../admin-unsaved-state';
import { MediaPickerDialog } from '../asset-library/MediaPickerDialog';
import { Button } from '../components/ui/button';
import { AdminFieldRow } from '../components/ui/form-section';
import { Input } from '../components/ui/input';
import { AdminStatusBadge } from '../components/ui/status-badge';
import type { SiteSettingsWithHero } from '../site-hero-settings-api';
import {
  settingsValueEqual,
  toSiteSettingsUpdateInput,
} from '../settings/site-settings-state';
import { useSiteSettingsController } from '../settings/SiteSettingsProvider';
import { useBrandingImageDraft } from '../settings/useBrandingImageDraft';
import './system-settings.css';

type SystemDraft = {
  siteName: string;
  locationLabel: string;
  logoAssetId: string | null;
  mediaBaseUrl: string;
  ga4MeasurementId: string;
};

type DomainTestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

function createDraft(settings: SiteSettingsWithHero): SystemDraft {
  return {
    siteName: settings.siteName,
    locationLabel: settings.locationLabel,
    logoAssetId: settings.logoAssetId,
    mediaBaseUrl: settings.mediaBaseUrl ?? '',
    ga4MeasurementId: settings.ga4MeasurementId ?? '',
  };
}

export function SystemSettingsView({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const { settings, saveSettings } = useSiteSettingsController();
  const [draft, setDraft] = useState(() => createDraft(settings));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [domainTest, setDomainTest] = useState<DomainTestState>({ status: 'idle' });
  const branding = useBrandingImageDraft({
    kind: 'logo',
    assetId: draft.logoAssetId,
    onAssetIdChange: (logoAssetId) =>
      setDraft((current) => ({ ...current, logoAssetId })),
  });
  const dirty =
    Boolean(branding.localImage) || !settingsValueEqual(draft, createDraft(settings));
  const busy = saving || branding.processing || domainTest.status === 'testing';

  useAdminDirtySource('system-settings', '系统设置', dirty);

  async function testDomain() {
    const mediaBaseUrl = draft.mediaBaseUrl.trim();
    if (!mediaBaseUrl || domainTest.status === 'testing') return;
    setDomainTest({ status: 'testing' });
    try {
      const result = await testMediaDomain(mediaBaseUrl);
      setDraft((current) => ({ ...current, mediaBaseUrl: result.mediaBaseUrl }));
      setDomainTest({
        status: 'success',
        message: `连接成功 · HTTP ${result.responseStatus}`,
      });
    } catch (error) {
      if (
        error instanceof AdminApiError &&
        (error.status === 401 || error.code === 'SESSION_INVALID')
      ) {
        onSessionExpired();
        return;
      }
      setDomainTest({
        status: 'error',
        message: error instanceof Error ? error.message : 'R2 自定义域名连接测试失败。',
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || busy) return;
    setSaving(true);
    setMessage(null);
    try {
      const base = toSiteSettingsUpdateInput(settings);
      const updated = await saveSettings({
        ...base,
        siteName: draft.siteName,
        locationLabel: draft.locationLabel,
        logoAssetId: await branding.uploadPending(),
        mediaBaseUrl: draft.mediaBaseUrl.trim() || null,
        ga4MeasurementId: draft.ga4MeasurementId.trim() || null,
      });
      setDraft(createDraft(updated));
      setDomainTest({ status: 'idle' });
      setMessage({ type: 'success', text: '系统设置已保存。' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '系统设置保存失败。',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form
        className="settings-workspace system-settings-form is-medium"
        onSubmit={handleSubmit}
      >
        <section
          className="settings-workspace-section system-settings-panel"
          aria-label="系统设置"
        >
          <div className="system-settings-top-row">
            <div className="system-settings-logo-control">
              <button
                className="system-settings-logo-button"
                type="button"
                aria-label="选择站点 Logo"
                disabled={busy}
                onClick={() => setPickerOpen(true)}
              >
                {branding.previewUrl ? (
                  <img src={branding.previewUrl} alt="站点 Logo 预览" />
                ) : (
                  <span aria-hidden="true">+</span>
                )}
              </button>
              {branding.previewUrl ? (
                <Button
                  variant="ghost"
                  size="compact"
                  type="button"
                  disabled={busy}
                  onClick={branding.clear}
                >
                  清除 Logo
                </Button>
              ) : null}
            </div>
            <div className="system-settings-top-actions">
              {message ? (
                <AdminStatusBadge
                  tone={message.type === 'success' ? 'success' : 'danger'}
                  role={message.type === 'error' ? 'alert' : 'status'}
                >
                  {message.text}
                </AdminStatusBadge>
              ) : dirty ? (
                <AdminStatusBadge tone="warning">未保存更改</AdminStatusBadge>
              ) : null}
              <Button
                variant="primary"
                type="submit"
                loading={saving}
                disabled={!dirty || busy}
              >
                保存系统设置
              </Button>
            </div>
          </div>

          <div className="system-settings-fields">
            <div className="system-settings-row system-settings-row--identity">
              <div className="system-settings-row-title">站点身份</div>
              <div className="system-settings-row-content system-settings-two-column">
                <AdminFieldRow label="站点名称" htmlFor="system-site-name">
                  <Input
                    id="system-site-name"
                    type="text"
                    value={draft.siteName}
                    disabled={busy}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        siteName: event.target.value,
                      }))
                    }
                  />
                </AdminFieldRow>
                <AdminFieldRow label="站点说明" htmlFor="system-location-label">
                  <Input
                    id="system-location-label"
                    type="text"
                    value={draft.locationLabel}
                    disabled={busy}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        locationLabel: event.target.value,
                      }))
                    }
                  />
                </AdminFieldRow>
              </div>
            </div>

            <div className="system-settings-row system-settings-row--logo">
              <div className="system-settings-row-title">站点 Logo</div>
              <div className="system-settings-row-content">
                <div className="settings-media-control">
                  <div className="settings-media-preview">
                    {branding.previewUrl ? (
                      <img src={branding.previewUrl} alt="站点 Logo 预览" />
                    ) : (
                      <span>Logo</span>
                    )}
                  </div>
                  <div className="settings-media-copy">
                    <p>{draft.logoAssetId ? '已设置站点 Logo。' : '当前未设置 Logo。'}</p>
                    <div className="settings-media-actions">
                      <Button
                        variant="secondary"
                        size="compact"
                        type="button"
                        disabled={busy}
                        onClick={() => setPickerOpen(true)}
                      >
                        选择素材
                      </Button>
                      {branding.previewUrl ? (
                        <Button
                          variant="ghost"
                          size="compact"
                          type="button"
                          disabled={busy}
                          onClick={branding.clear}
                        >
                          移除
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="system-settings-row">
              <div className="system-settings-row-title">媒体域名</div>
              <div className="system-settings-row-content">
                <AdminFieldRow
                  label="R2 自定义域名"
                  htmlFor="system-media-base-url"
                  status={
                    domainTest.status === 'success' || domainTest.status === 'error' ? (
                      <AdminStatusBadge
                        tone={domainTest.status === 'success' ? 'success' : 'danger'}
                        role={domainTest.status === 'error' ? 'alert' : 'status'}
                      >
                        {domainTest.message}
                      </AdminStatusBadge>
                    ) : null
                  }
                >
                  <div className="system-domain-control">
                    <Input
                      id="system-media-base-url"
                      type="url"
                      value={draft.mediaBaseUrl}
                      placeholder="https://assets.example.com"
                      disabled={busy}
                      onChange={(event) => {
                        setDraft((current) => ({
                          ...current,
                          mediaBaseUrl: event.target.value,
                        }));
                        setDomainTest({ status: 'idle' });
                        setMessage(null);
                      }}
                    />
                    <Button
                      variant="secondary"
                      size="compact"
                      type="button"
                      loading={domainTest.status === 'testing'}
                      disabled={saving || !draft.mediaBaseUrl.trim()}
                      onClick={() => void testDomain()}
                    >
                      测试连接
                    </Button>
                  </div>
                </AdminFieldRow>
              </div>
            </div>

            <div className="system-settings-row">
              <div className="system-settings-row-title">统计集成</div>
              <div className="system-settings-row-content">
                <AdminFieldRow label="GA4 Measurement ID" htmlFor="system-ga4-id">
                  <Input
                    id="system-ga4-id"
                    type="text"
                    value={draft.ga4MeasurementId}
                    placeholder="G-XXXXXXXXXX"
                    disabled={busy}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        ga4MeasurementId: event.target.value,
                      }))
                    }
                  />
                </AdminFieldRow>
              </div>
            </div>
          </div>
        </section>
      </form>

      {pickerOpen ? (
        <MediaPickerDialog
          title="选择站点 Logo"
          role="logo"
          allowedKinds={['image']}
          selectedIds={draft.logoAssetId ? [draft.logoAssetId] : []}
          onSessionExpired={onSessionExpired}
          onClose={() => setPickerOpen(false)}
          onSelect={(asset) => {
            branding.chooseAsset(asset.id);
            setPickerOpen(false);
            setMessage(null);
          }}
        />
      ) : null}
    </>
  );
}
